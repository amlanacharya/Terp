import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

function resolveExistingPath(...candidates: string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const DEFAULT_MIGRATIONS_DIR = resolveExistingPath(
  path.join(__dirname, 'migrations-sqlite'),
  path.join(__dirname, '../../db/migrations-sqlite')
);

export function runMigrations(
  db: Database.Database,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): void {
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: string }).version)
  );

  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES ($version, $applied_at)'
  );

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      insertMigration.run({
        version: file,
        applied_at: new Date().toISOString(),
      });
    })();
  }
}
