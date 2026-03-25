import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import type { Pool, PoolClient } from 'pg';
import { closeDb, getDb, reconnect } from '../../db/db';
import { runMigrations } from '../../db/migrate-sqlite';

function resolveExistingPath(...candidates: string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const SCHEMA_PATH = resolveExistingPath(
  path.resolve(__dirname, '../../db/schema-sqlite.sql'),
  path.resolve(__dirname, '../../../db/schema-sqlite.sql')
);

interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

function translateSql(text: string): string {
  return text
    .replace(/\$([0-9]+)/g, '?$1')
    .replace(/\bnow\(\)/gi, "datetime('now')")
    .replace(/::\s*[a-z_][a-z0-9_]*/gi, '')
    .replace(/\bjson_build_object\s*\(/gi, 'json_object(')
    .replace(/\bILIKE\b/gi, 'LIKE');
}

function normalizeBindings(params?: unknown[] | Record<string, unknown>) {
  if (!params) {
    return {};
  }

  const normalizeValue = (value: unknown): unknown => {
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    return value;
  };

  if (Array.isArray(params)) {
    return Object.fromEntries(params.map((value, index) => [String(index + 1), normalizeValue(value)]));
  }

  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, normalizeValue(value)])
  );
}

function executeQuery<T = any>(
  db: Database.Database,
  text: string,
  params?: unknown[] | Record<string, unknown>
): QueryResult<T> {
  const trimmed = text.trim();
  if (/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(trimmed)) {
    db.exec(trimmed);
    return { rows: [], rowCount: 0 };
  }

  const statement = db.prepare(translateSql(text));
  const bindings = normalizeBindings(params);
  if (/^\s*SELECT\b/i.test(trimmed) || /\bRETURNING\b/i.test(trimmed)) {
    const rows = statement.all(bindings) as T[];
    return { rows, rowCount: rows.length };
  }

  const result = statement.run(bindings);
  return { rows: [], rowCount: result.changes };
}

export function initDb(): void {
  const db = getDb();
  const hasMigrations = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();

  if (!hasMigrations) {
    db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    console.log('[db] Schema applied');
  }

  runMigrations(db);
}

export async function query<T = any>(
  text: string,
  params?: unknown[] | Record<string, unknown>
): Promise<QueryResult<T>> {
  return executeQuery<T>(getDb(), text, params);
}

const pool = {
  async connect(): Promise<PoolClient> {
    const db = getDb();
    return {
      async query<T = any>(
        text: string,
        params?: unknown[] | Record<string, unknown>
      ) {
        return executeQuery<T>(db, text, params);
      },
      release() {
        // no-op for SQLite singleton
      },
    } as unknown as PoolClient;
  },
  async query<T = any>(
    text: string,
    params?: unknown[] | Record<string, unknown>
  ) {
    return executeQuery<T>(getDb(), text, params);
  },
  on() {
    // no-op for compatibility with pg Pool event hooks
  },
} as unknown as Pool;

export { closeDb, getDb, reconnect };
export default pool;
