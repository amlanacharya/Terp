# FleetSync Lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PostgreSQL with SQLite and package TravelERP as a Windows .exe (Electron) that serves 3-4 LAN browser users from a single laptop.

**Architecture:** Electron shells an in-process Express server. `better-sqlite3` replaces `pg` — the same route files are kept but rewritten from async pg queries to synchronous SQLite calls. A db singleton (`server/db/db.ts`) is the single source of the database handle, enabling hot-swap on restore. Optimistic locking uses a `version` integer column on all mutable tables.

**Tech Stack:** Electron 28+, better-sqlite3, electron-builder (NSIS), multicast-dns, Vitest (tests), existing Express/React/TypeScript stack unchanged.

---

## File Map

### New files
| File | Purpose |
|---|---|
| `server/db/db.ts` | SQLite singleton — `getDb()`, `reconnect()`, startup PRAGMAs |
| `server/db/schema-sqlite.sql` | Hand-authored SQLite schema (mirrors schema.sql with type mappings) |
| `server/db/migrate-sqlite.ts` | Migration runner — applies unapplied files from migrations-sqlite/ |
| `server/db/migrations-sqlite/` | Directory for incremental .sql migration files |
| `server/src/utils/money.ts` | `toDb(n)` (×100, round) and `fromDb(n)` (÷100) for monetary values |
| `server/src/config/db-sqlite.ts` | Drop-in replacement for `config/db.ts` — re-exports `getDb()` as `query`-compatible wrapper |
| `electron/main.js` | Electron entry — single-instance lock, server startup, tray, mDNS, lifecycle |
| `electron/tray.js` | System tray menu construction and update helpers |
| `electron/backup.js` | Backup/Restore logic using SQLite Online Backup API |
| `electron/config.js` | Read/write `%APPDATA%/FleetSyncLite/config.json` (JWT secret, port) |
| `electron/mdns.js` | mDNS announce/stop via `multicast-dns` |
| `electron/package.json` | Electron package config with electron-builder NSIS target |

### Modified files
| File | Change |
|---|---|
| `server/src/config/db.ts` | Replaced entirely by `db-sqlite.ts` (kept for reference, then deleted) |
| `server/src/index.ts` | Export `app` and `server` for Electron; remove `process.exit`; accept port from caller |
| `server/src/utils/sql.ts` | Update `buildUpdateClause` for SQLite named params (`$key`) instead of positional (`$1`) |
| `server/src/routes/*.routes.ts` | All 15 route files: replace `pool`/`query` with `getDb()`, make synchronous, fix SQL |
| `server/src/utils/rate-engine.ts` | Replace `Queryable` (pg type) with SQLite-compatible query interface |
| `server/src/utils/auto-code.ts` | Replace pg query with SQLite synchronous call |
| `server/src/utils/ledger.ts` | Replace pg query with SQLite synchronous call |
| `server/src/utils/gst.ts` | Replace pg query with SQLite synchronous call (if any) |
| `server/src/utils/tax-engine.ts` | Replace pg query with SQLite synchronous call |

---

## Phase 1 — Foundation

### Task 1: Install dependencies and set up Vitest

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1.1: Install SQLite and Electron dependencies**

```bash
cd C:/travelerp/.worktrees/fslite/server
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3 vitest
```

- [ ] **Step 1.2: Add test script to server/package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 1.3: Verify install**

```bash
cd C:/travelerp/.worktrees/fslite/server
node -e "require('better-sqlite3'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 1.4: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore(lite): install better-sqlite3 and vitest"
```

---

### Task 2: SQLite db singleton

**Files:**
- Create: `server/db/db.ts`
- Create: `server/db/db.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `server/db/db.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// We test the factory function directly, not the singleton
import { openDb } from './db';

let testDbPath: string;

beforeEach(() => {
  testDbPath = path.join(os.tmpdir(), `test-${Date.now()}.db`);
});

afterEach(() => {
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

describe('openDb', () => {
  it('returns a Database instance', () => {
    const db = openDb(testDbPath);
    expect(db).toBeInstanceOf(Database);
    db.close();
  });

  it('enables WAL mode', () => {
    const db = openDb(testDbPath);
    const row = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    expect(row.journal_mode).toBe('wal');
    db.close();
  });

  it('enables foreign keys', () => {
    const db = openDb(testDbPath);
    const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
    db.close();
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd C:/travelerp/.worktrees/fslite/server
npm test -- db/db.test.ts
```
Expected: FAIL — `Cannot find module './db'`

- [ ] **Step 2.3: Create server/db/db.ts**

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const DEFAULT_DB_PATH = path.join(
  process.env.APPDATA || os.homedir(),
  'FleetSyncLite',
  'fleetsync.db'
);

export function openDb(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = process.env.FLEETSYNC_DB_PATH || DEFAULT_DB_PATH;
    _db = openDb(dbPath);
  }
  return _db;
}

export function reconnect(filePath: string): void {
  if (_db) {
    _db.close();
  }
  _db = openDb(filePath);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
```

- [ ] **Step 2.4: Run test to verify it passes**

```bash
cd C:/travelerp/.worktrees/fslite/server
npm test -- db/db.test.ts
```
Expected: 3 passing

- [ ] **Step 2.5: Commit**

```bash
git add server/db/db.ts server/db/db.test.ts
git commit -m "feat(lite): SQLite db singleton with WAL, FK, reconnect"
```

---

### Task 3: Money utility

**Files:**
- Create: `server/src/utils/money.ts`
- Create: `server/src/utils/money.test.ts`

- [ ] **Step 3.1: Write the failing test**

Create `server/src/utils/money.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { toDb, fromDb } from './money';

describe('toDb', () => {
  it('converts rupees to integer paise', () => {
    expect(toDb(1234.50)).toBe(123450);
  });

  it('rounds values with more than 2 decimal places', () => {
    expect(toDb(18.333)).toBe(1833);
    expect(toDb(18.335)).toBe(1834);
  });

  it('handles zero', () => {
    expect(toDb(0)).toBe(0);
  });

  it('handles null/undefined gracefully', () => {
    expect(toDb(null)).toBe(0);
    expect(toDb(undefined)).toBe(0);
  });
});

describe('fromDb', () => {
  it('converts integer paise to rupees with 2dp', () => {
    expect(fromDb(123450)).toBe(1234.50);
  });

  it('handles zero', () => {
    expect(fromDb(0)).toBe(0);
  });

  it('handles null/undefined gracefully', () => {
    expect(fromDb(null)).toBe(0);
    expect(fromDb(undefined)).toBe(0);
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
cd C:/travelerp/.worktrees/fslite/server
npm test -- utils/money.test.ts
```
Expected: FAIL

- [ ] **Step 3.3: Create server/src/utils/money.ts**

```typescript
/**
 * Monetary value conversion utilities for FleetSync Lite.
 * All monetary values are stored in the SQLite database as integer paise
 * (1 rupee = 100 paise) to avoid IEEE 754 floating-point rounding errors.
 *
 * Use toDb() before any INSERT/UPDATE of monetary values.
 * Use fromDb() when reading monetary values from the database.
 */

export function toDb(value: number | null | undefined): number {
  if (value == null) return 0;
  return Math.round(value * 100);
}

export function fromDb(paise: number | null | undefined): number {
  if (paise == null) return 0;
  return paise / 100;
}
```

- [ ] **Step 3.4: Run test to verify it passes**

```bash
cd C:/travelerp/.worktrees/fslite/server
npm test -- utils/money.test.ts
```
Expected: 8 passing

- [ ] **Step 3.5: Commit**

```bash
git add server/src/utils/money.ts server/src/utils/money.test.ts
git commit -m "feat(lite): money.ts toDb/fromDb for paise storage"
```

---

### Task 4: Update sql.ts for SQLite named parameters

The existing `buildUpdateClause` generates `key = $1, key2 = $2` (pg positional). SQLite uses named params: `key = $key, key2 = $key2`.

**Files:**
- Modify: `server/src/utils/sql.ts`
- Create: `server/src/utils/sql.test.ts`

- [ ] **Step 4.1: Write the failing test**

Create `server/src/utils/sql.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildUpdateClause, pickDefinedFields } from './sql';

describe('buildUpdateClause', () => {
  it('generates named parameter SQL for SQLite', () => {
    const result = buildUpdateClause({ name: 'Alice', age: 30 });
    expect(result.clause).toBe('name = $name, age = $age');
    expect(result.params).toEqual({ name: 'Alice', age: 30 });
  });

  it('handles a single field', () => {
    const result = buildUpdateClause({ status: 'active' });
    expect(result.clause).toBe('status = $status');
    expect(result.params).toEqual({ status: 'active' });
  });
});

describe('pickDefinedFields', () => {
  it('keeps only allowed fields that are defined', () => {
    const result = pickDefinedFields(
      { name: 'Alice', age: undefined, extra: 'ignored' },
      ['name', 'age'] as const
    );
    expect(result).toEqual({ name: 'Alice' });
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails** (old `values` key, not `params`)

```bash
cd C:/travelerp/.worktrees/fslite/server
npm test -- utils/sql.test.ts
```
Expected: FAIL

- [ ] **Step 4.3: Update server/src/utils/sql.ts**

Replace the entire file:
```typescript
export function pickDefinedFields(
  source: Record<string, unknown>,
  allowedFields: readonly string[]
): Record<string, unknown> {
  return allowedFields.reduce<Record<string, unknown>>((acc, field) => {
    const value = source[field];
    if (value !== undefined) acc[field] = value;
    return acc;
  }, {});
}

/**
 * Builds a SQLite-compatible SET clause using named parameters.
 * Returns { clause: "key = $key, ...", params: { key: value, ... } }
 *
 * Usage:
 *   const { clause, params } = buildUpdateClause(fields);
 *   db.prepare(`UPDATE t SET ${clause} WHERE id = $id`).run({ ...params, id });
 */
export function buildUpdateClause(fields: Record<string, unknown>): {
  clause: string;
  params: Record<string, unknown>;
} {
  const entries = Object.entries(fields);
  return {
    clause: entries.map(([key]) => `${key} = $${key}`).join(', '),
    params: Object.fromEntries(entries),
  };
}
```

- [ ] **Step 4.4: Run test to verify it passes**

```bash
cd C:/travelerp/.worktrees/fslite/server
npm test -- utils/sql.test.ts
```
Expected: 3 passing

- [ ] **Step 4.5: Commit**

```bash
git add server/src/utils/sql.ts server/src/utils/sql.test.ts
git commit -m "feat(lite): update buildUpdateClause for SQLite named params"
```

---

### Task 5: SQLite schema

**Files:**
- Create: `server/db/schema-sqlite.sql`

The schema mirrors `server/db/schema.sql` with these rules applied (see spec §3):
- `uuid` / `uuid_generate_v4()` → `TEXT` (ID generated in JS)
- `BOOLEAN` → `INTEGER`
- `DECIMAL`/monetary → `NUMERIC`
- `ENUM` → `TEXT CHECK(...)`
- `TIMESTAMPTZ` → `TEXT`
- Remove all `CREATE EXTENSION` and PostgreSQL-specific syntax
- Add `version INTEGER NOT NULL DEFAULT 1` to all mutable tables
- Add `schema_migrations` table

- [ ] **Step 5.1: Read the PostgreSQL schema**

```bash
cat C:/travelerp/.worktrees/fslite/server/db/schema.sql | head -200
```
Read it fully to understand all tables and types before writing the SQLite version.

- [ ] **Step 5.2: Create server/db/schema-sqlite.sql**

Begin with the migrations table and then translate each table from schema.sql:
```sql
-- FleetSync Lite SQLite Schema
-- Hand-authored translation of schema.sql for SQLite

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- (translate every table from schema.sql here, applying type mappings)
-- Example pattern:
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ...
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);
```

Translate ALL tables. Cross-check: count of tables in schema-sqlite.sql must match schema.sql.

- [ ] **Step 5.3: Validate schema loads without errors**

```bash
cd C:/travelerp/.worktrees/fslite
node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
const sql = fs.readFileSync('server/db/schema-sqlite.sql', 'utf8');
db.exec(sql);
console.log('Schema loaded OK');
console.log('Tables:', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(r => r.name).join(', '));
"
```
Expected: `Schema loaded OK` with all table names listed.

- [ ] **Step 5.4: Commit**

```bash
git add server/db/schema-sqlite.sql
git commit -m "feat(lite): SQLite schema with version column on all mutable tables"
```

---

### Task 6: Migration runner

**Files:**
- Create: `server/db/migrate-sqlite.ts`
- Create: `server/db/migrate-sqlite.test.ts`

- [ ] **Step 6.1: Write the failing test**

Create `server/db/migrate-sqlite.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { openDb } from './db';
import { runMigrations } from './migrate-sqlite';

let testDbPath: string;
let testMigrationsDir: string;

beforeEach(() => {
  testDbPath = path.join(os.tmpdir(), `migrate-test-${Date.now()}.db`);
  testMigrationsDir = path.join(os.tmpdir(), `migrations-${Date.now()}`);
  fs.mkdirSync(testMigrationsDir);
});

afterEach(() => {
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  fs.rmSync(testMigrationsDir, { recursive: true });
});

describe('runMigrations', () => {
  it('applies unapplied migration files in order', () => {
    const db = openDb(testDbPath);
    db.exec(`CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
    fs.writeFileSync(path.join(testMigrationsDir, '20260101_001_create_foo.sql'),
      'CREATE TABLE foo (id TEXT PRIMARY KEY)');
    fs.writeFileSync(path.join(testMigrationsDir, '20260101_002_create_bar.sql'),
      'CREATE TABLE bar (id TEXT PRIMARY KEY)');

    runMigrations(db, testMigrationsDir);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
      .map((r: any) => r.name);
    expect(tables).toContain('foo');
    expect(tables).toContain('bar');

    const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()
      .map((r: any) => r.version);
    expect(applied).toEqual(['20260101_001_create_foo.sql', '20260101_002_create_bar.sql']);
    db.close();
  });

  it('does not re-apply already applied migrations', () => {
    const db = openDb(testDbPath);
    db.exec(`CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
    const migFile = path.join(testMigrationsDir, '20260101_001_create_foo.sql');
    fs.writeFileSync(migFile, 'CREATE TABLE foo (id TEXT PRIMARY KEY)');

    runMigrations(db, testMigrationsDir); // first run
    runMigrations(db, testMigrationsDir); // second run — should not throw "table already exists"

    const count = (db.prepare('SELECT count(*) as c FROM schema_migrations').get() as any).c;
    expect(count).toBe(1);
    db.close();
  });
});
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
cd C:/travelerp/.worktrees/fslite/server
npm test -- db/migrate-sqlite.test.ts
```
Expected: FAIL

- [ ] **Step 6.3: Create server/db/migrate-sqlite.ts**

```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, 'migrations-sqlite');

export function runMigrations(
  db: Database.Database,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): void {
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all()
      .map((r: any) => r.version as string)
  );

  const insertMigration = db.prepare(
    `INSERT INTO schema_migrations (version, applied_at) VALUES ($version, $applied_at)`
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      insertMigration.run({ version: file, applied_at: new Date().toISOString() });
    })();
    console.log(`[migrate] Applied: ${file}`);
  }
}
```

- [ ] **Step 6.4: Run test to verify it passes**

```bash
cd C:/travelerp/.worktrees/fslite/server
npm test -- db/migrate-sqlite.test.ts
```
Expected: 2 passing

- [ ] **Step 6.5: Create migrations directory**

```bash
mkdir -p C:/travelerp/.worktrees/fslite/server/db/migrations-sqlite
touch C:/travelerp/.worktrees/fslite/server/db/migrations-sqlite/.gitkeep
```

- [ ] **Step 6.6: Commit**

```bash
git add server/db/migrate-sqlite.ts server/db/migrate-sqlite.test.ts server/db/migrations-sqlite/
git commit -m "feat(lite): SQLite migration runner with schema_migrations table"
```

---

## Phase 2 — Server Integration

### Task 7: Replace config/db.ts with SQLite adapter

The route files import `pool` and `query` from `../config/db`. We create a new `db-sqlite.ts` that provides a compatible interface backed by SQLite, then update `index.ts`.

**Files:**
- Create: `server/src/config/db-sqlite.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 7.1: Create server/src/config/db-sqlite.ts**

This file re-exports `getDb()` and provides a synchronous `query()` shim that routes use during transition. It also initialises the schema and migrations on first call.

```typescript
import path from 'path';
import fs from 'fs';
import { getDb, openDb } from '../../db/db';
import { runMigrations } from '../../db/migrate-sqlite';

const SCHEMA_PATH = path.join(__dirname, '../../db/schema-sqlite.sql');

export function initDb(): void {
  const db = getDb();
  // Apply schema if tables don't exist yet
  const hasMigrations = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
  ).get();
  if (!hasMigrations) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
    console.log('[db] Schema applied');
  }
  runMigrations(db);
}

export { getDb } from '../../db/db';
export { reconnect, closeDb } from '../../db/db';
```

- [ ] **Step 7.2: Update server/src/index.ts**

Replace the pg-based startup with SQLite-based startup. Export `app` and `server` so Electron can control them.

```typescript
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import http from 'http';
import { initDb } from './config/db-sqlite';

// ... (same route imports as before) ...

const app = express();
app.use(cors());
app.use(express.json());

// ... (same route mounting as before) ...

// Serve React frontend in production
const staticPath = path.join(__dirname, '../../dist');
app.use(express.static(staticPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

export const server = http.createServer(app);

export function startServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    initDb();
    server.listen(port, '0.0.0.0', () => {
      console.log(`FleetSync Lite listening on port ${port}`);
      resolve();
    });
    server.on('error', reject);
  });
}

// Only auto-start when run directly (not required by Electron)
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  startServer(port).catch(err => {
    console.error('Server start failed:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 7.3: Test server starts**

```bash
cd C:/travelerp/.worktrees/fslite
FLEETSYNC_DB_PATH=/tmp/test-fslite.db node -e "
const { startServer } = require('./server/src/index');
startServer(3099).then(() => {
  console.log('Server started OK');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"
```
Expected: `Server started OK`

- [ ] **Step 7.4: Commit**

```bash
git add server/src/config/db-sqlite.ts server/src/index.ts
git commit -m "feat(lite): SQLite server integration, export startServer for Electron"
```

---

## Phase 3 — Route Migration

### Migration pattern (read this before starting any route task)

Every route file currently:
1. Imports `pool, { query }` from `'../config/db'`
2. Uses `await query(sql, [params])` with positional `$1, $2...`
3. Uses `RETURNING *` on INSERT
4. Uses `pool.connect()` / `client.query()` for transactions
5. Returns `rows[0]` or `rows`

After migration, each route file:
1. Imports `getDb` from `'../config/db-sqlite'`
2. Uses `db.prepare(sql).get(params)` / `.all(params)` / `.run(params)` synchronously
3. Uses `db.prepare(sql).run(params).lastInsertRowid` then `SELECT WHERE id = $id`
4. Uses `db.transaction(() => { ... })()` for transactions
5. SQL uses `$paramName` instead of `$1, $2`
6. `buildUpdateClause` now returns `{ clause, params }` not `{ clause, values }`
7. Every UPDATE uses `WHERE id = $id AND version = $version` and checks `changes === 0` → 409
8. Every mutable record returned by GET includes `version` field
9. Every PUT/PATCH expects `version` in request body

**Synchronous route handler pattern:**
```typescript
// Before (pg):
router.get('/:id', authRequired, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// After (SQLite):
router.get('/:id', authRequired, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM customers WHERE id = $id').get({ id: req.params.id });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});
```

**INSERT pattern:**
```typescript
const id = crypto.randomUUID();
const now = new Date().toISOString();
db.prepare(`INSERT INTO customers (id, name, created_at, updated_at, version) VALUES ($id, $name, $now, $now, 1)`)
  .run({ id, name, now });
const created = db.prepare('SELECT * FROM customers WHERE id = $id').get({ id });
res.status(201).json(created);
```

**UPDATE with optimistic locking:**
```typescript
const { clause, params } = buildUpdateClause({ ...fields, updated_at: now, version: existing.version + 1 });
// Note: do NOT include version in buildUpdateClause — handle it separately
const result = db.prepare(
  `UPDATE customers SET ${clause} WHERE id = $id AND version = $clientVersion`
).run({ ...params, id, clientVersion: req.body.version });
if (result.changes === 0) {
  return res.status(409).json({ error: 'Record was modified by another user', code: 'CONFLICT' });
}
const updated = db.prepare('SELECT * FROM customers WHERE id = $id').get({ id });
res.json(updated);
```

---

### Task 8: Migrate customers, vehicles, vehicle-categories routes

These are the simplest CRUD routes — a good starting point to validate the pattern.

**Files:**
- Modify: `server/src/routes/customers.routes.ts`
- Modify: `server/src/routes/vehicles.routes.ts`
- Modify: `server/src/routes/vehicle-categories.routes.ts`

- [ ] **Step 8.1: Read each route file fully**

Read all three files before touching any of them.

- [ ] **Step 8.2: Migrate customers.routes.ts**

Apply the migration pattern:
- Remove `pg` imports, import `getDb` from `'../config/db-sqlite'`
- Remove all `async`/`await`
- Replace `await query(...)` with synchronous `db.prepare().get/all/run()`
- Replace `$1, $2` with named params
- Add `version` to INSERT (default 1)
- Add optimistic locking to all UPDATE handlers
- Add `version` to all SELECT queries (it's already in `SELECT *`)

- [ ] **Step 8.3: Migrate vehicles.routes.ts** (same steps as 8.2)

- [ ] **Step 8.4: Migrate vehicle-categories.routes.ts** (same steps as 8.2)

- [ ] **Step 8.5: Smoke test the routes**

Start the server and make a test request:
```bash
cd C:/travelerp/.worktrees/fslite
FLEETSYNC_DB_PATH=/tmp/fslite-smoke.db node -e "
const { startServer } = require('./server/src/index');
startServer(3099).then(async () => {
  const r = await fetch('http://localhost:3099/api/customers');
  console.log('customers status:', r.status);
  process.exit(0);
});
"
```
Expected: status 401 (auth required, not a server crash)

- [ ] **Step 8.6: Commit**

```bash
git add server/src/routes/customers.routes.ts server/src/routes/vehicles.routes.ts server/src/routes/vehicle-categories.routes.ts
git commit -m "feat(lite): migrate customers, vehicles, vehicle-categories routes to SQLite"
```

---

### Task 9: Migrate drivers, owners, leads routes

**Files:**
- Modify: `server/src/routes/drivers.routes.ts`
- Modify: `server/src/routes/owners.routes.ts`
- Modify: `server/src/routes/leads.routes.ts`

- [ ] **Step 9.1: Read each route file**
- [ ] **Step 9.2: Migrate drivers.routes.ts** (follow migration pattern)
- [ ] **Step 9.3: Migrate owners.routes.ts**
- [ ] **Step 9.4: Migrate leads.routes.ts**
- [ ] **Step 9.5: Smoke test** (curl or node fetch to each route, expect 401 not crash)
- [ ] **Step 9.6: Commit**

```bash
git add server/src/routes/drivers.routes.ts server/src/routes/owners.routes.ts server/src/routes/leads.routes.ts
git commit -m "feat(lite): migrate drivers, owners, leads routes to SQLite"
```

---

### Task 10: Migrate auth and settings routes

**Files:**
- Modify: `server/src/routes/auth.routes.ts`
- Modify: `server/src/routes/settings.routes.ts`

Auth is special: JWT secret now comes from `electron/config.js` (passed via env var `JWT_SECRET`), not `.env`. The route itself doesn't change — just the secret source.

- [ ] **Step 10.1: Read auth.routes.ts fully**
- [ ] **Step 10.2: Migrate auth.routes.ts** (synchronous db calls, same pattern)
- [ ] **Step 10.3: Migrate settings.routes.ts**
- [ ] **Step 10.4: Commit**

```bash
git add server/src/routes/auth.routes.ts server/src/routes/settings.routes.ts
git commit -m "feat(lite): migrate auth, settings routes to SQLite"
```

---

### Task 11: Migrate tax-components, gst, rate-charts routes

**Files:**
- Modify: `server/src/routes/tax-components.routes.ts`
- Modify: `server/src/routes/gst.routes.ts`
- Modify: `server/src/routes/rate-charts.routes.ts`

Rate charts may use the `Queryable` type from `rate-engine.ts`. After migration, `Queryable` must be updated to accept a `better-sqlite3` Database instance.

- [ ] **Step 11.1: Read rate-engine.ts to understand the `Queryable` interface**

```bash
grep -n "Queryable" C:/travelerp/.worktrees/fslite/server/src/utils/rate-engine.ts | head -20
```

- [ ] **Step 11.2: Update `Queryable` in rate-engine.ts**

Replace the pg-based `Queryable` type with a SQLite-compatible interface. `Queryable` is used to pass either a pool or a transaction client. In SQLite, this becomes the `Database` instance directly:

```typescript
// Before:
export type Queryable = Pool | PoolClient;

// After:
import Database from 'better-sqlite3';
export type Queryable = Database.Database;
```

Update all internal uses of `Queryable` in rate-engine.ts to use synchronous db calls.

- [ ] **Step 11.3: Migrate tax-components.routes.ts**
- [ ] **Step 11.4: Migrate gst.routes.ts**
- [ ] **Step 11.5: Migrate rate-charts.routes.ts**
- [ ] **Step 11.6: Commit**

```bash
git add server/src/utils/rate-engine.ts server/src/routes/tax-components.routes.ts server/src/routes/gst.routes.ts server/src/routes/rate-charts.routes.ts
git commit -m "feat(lite): migrate rate-charts, tax, gst routes and update Queryable type"
```

---

### Task 12: Migrate trips and annexures routes

Trips is the most complex route — it uses transactions, the rate engine, ledger writes, and PDF generation.

**Files:**
- Modify: `server/src/routes/trips.routes.ts`
- Modify: `server/src/routes/annexures.routes.ts`
- Modify: `server/src/utils/auto-code.ts`
- Modify: `server/src/utils/ledger.ts`

- [ ] **Step 12.1: Read trips.routes.ts fully** (it's long — read all of it)
- [ ] **Step 12.2: Migrate auto-code.ts** (helper used by trips for trip number generation)
- [ ] **Step 12.3: Migrate ledger.ts** (helper used by trips and invoices)
- [ ] **Step 12.4: Migrate trips.routes.ts**

Key considerations:
- `pool.connect()` / `client.query()` transaction blocks → `db.transaction(() => { ... })()`
- The rate engine calls (`loadActiveRateChartDetail`, `calculateRateFromChart`) now receive a `Database` instance instead of a `PoolClient`
- Monetary fields (trip_amount, charges) must use `toDb()`/`fromDb()` from `money.ts`

- [ ] **Step 12.5: Migrate annexures.routes.ts**
- [ ] **Step 12.6: Smoke test trips endpoint** (expect 401, not crash)
- [ ] **Step 12.7: Commit**

```bash
git add server/src/routes/trips.routes.ts server/src/routes/annexures.routes.ts server/src/utils/auto-code.ts server/src/utils/ledger.ts
git commit -m "feat(lite): migrate trips, annexures routes to SQLite"
```

---

### Task 13: Migrate invoices and collections routes

Invoices write to multiple tables atomically — use `db.transaction()`.

**Files:**
- Modify: `server/src/routes/invoices.routes.ts`
- Modify: `server/src/routes/collections.routes.ts`
- Modify: `server/src/utils/tax-engine.ts`

- [ ] **Step 13.1: Read invoices.routes.ts fully**
- [ ] **Step 13.2: Migrate tax-engine.ts** (used for invoice tax calculations)
- [ ] **Step 13.3: Migrate invoices.routes.ts**

Key: invoice creation inserts into `invoices` AND `invoice_items` AND `invoice_tax_snapshots` — wrap all three in a single `db.transaction()`. All monetary fields (subtotal, cgst_amount, etc.) go through `toDb()`/`fromDb()`.

- [ ] **Step 13.4: Migrate collections.routes.ts**
- [ ] **Step 13.5: Smoke test** (expect 401, not crash)
- [ ] **Step 13.6: Commit**

```bash
git add server/src/routes/invoices.routes.ts server/src/routes/collections.routes.ts server/src/utils/tax-engine.ts
git commit -m "feat(lite): migrate invoices, collections routes to SQLite with atomic transactions"
```

---

### Task 14: Migrate settlements, reports, dashboard routes

**Files:**
- Modify: `server/src/routes/settlements.routes.ts`
- Modify: `server/src/routes/reports.routes.ts`
- Modify: `server/src/routes/dashboard.routes.ts`

Reports and dashboard use aggregate queries — these are typically read-only and translate directly. No monetary writes, but monetary reads still need `fromDb()`.

- [ ] **Step 14.1: Read all three route files**
- [ ] **Step 14.2: Migrate settlements.routes.ts**
- [ ] **Step 14.3: Migrate reports.routes.ts**
- [ ] **Step 14.4: Migrate dashboard.routes.ts**
- [ ] **Step 14.5: Full smoke test — all routes return 401 or 200, none crash**

```bash
cd C:/travelerp/.worktrees/fslite
FLEETSYNC_DB_PATH=/tmp/fslite-full.db node -e "
const { startServer } = require('./server/src/index');
startServer(3099).then(async () => {
  const endpoints = ['/api/customers', '/api/trips', '/api/invoices', '/api/reports/summary', '/api/dashboard'];
  for (const ep of endpoints) {
    const r = await fetch('http://localhost:3099' + ep);
    console.log(ep, r.status);
  }
  process.exit(0);
});
"
```
Expected: all return 401 (not 500)

- [ ] **Step 14.6: Commit**

```bash
git add server/src/routes/settlements.routes.ts server/src/routes/reports.routes.ts server/src/routes/dashboard.routes.ts
git commit -m "feat(lite): migrate settlements, reports, dashboard routes to SQLite"
```

---

## Phase 4 — Electron Packaging

### Task 15: Electron project setup

**Files:**
- Create: `electron/package.json`
- Create: `electron/main.js`

- [ ] **Step 15.1: Install Electron dependencies**

```bash
cd C:/travelerp/.worktrees/fslite
npm install --save-dev electron electron-builder
npm install multicast-dns
```

- [ ] **Step 15.2: Create electron/package.json**

```json
{
  "name": "fleetsync-lite",
  "version": "1.0.0",
  "description": "FleetSync Lite — Offline travel operator ERP",
  "main": "electron/main.js",
  "scripts": {
    "electron": "electron .",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.fleetsync.lite",
    "productName": "FleetSync Lite",
    "directories": { "output": "dist-electron" },
    "npmRebuild": true,
    "win": {
      "target": "nsis",
      "icon": "electron/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    },
    "files": [
      "dist/**/*",
      "server/**/*",
      "electron/**/*",
      "node_modules/**/*"
    ]
  }
}
```

- [ ] **Step 15.3: Create electron/config.js**

```javascript
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const CONFIG_DIR = path.join(process.env.APPDATA || os.homedir(), 'FleetSyncLite');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    const config = {
      jwtSecret: crypto.randomBytes(64).toString('hex'),
      port: 3000,
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return config;
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(updates) {
  const config = loadConfig();
  Object.assign(config, updates);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

module.exports = { loadConfig, saveConfig, CONFIG_DIR };
```

- [ ] **Step 15.4: Commit**

```bash
git add electron/ package.json
git commit -m "chore(lite): Electron project scaffold with electron-builder NSIS config"
```

---

### Task 16: Electron main.js — server lifecycle and tray

**Files:**
- Create: `electron/main.js`
- Create: `electron/tray.js`
- Create: `electron/mdns.js`

- [ ] **Step 16.1: Create electron/mdns.js**

```javascript
const mdns = require('multicast-dns')();

let announced = false;

function getLanIp() {
  const ifaces = require('os').networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function announceService(port) {
  if (announced) return;
  mdns.on('query', (query) => {
    const isForUs = query.questions.some(q =>
      q.name === 'fleetsync.local' || q.name === '_http._tcp.local'
    );
    if (!isForUs) return;
    mdns.respond({
      answers: [{
        type: 'A',
        name: 'fleetsync.local',
        ttl: 30,
        data: getLanIp(),  // iterates all interfaces, not hardcoded 'Wi-Fi'
      }, {
        type: 'SRV',
        name: '_fleetsync._tcp.local',
        ttl: 30,
        data: { port, target: 'fleetsync.local' },
      }],
    });
  });
  announced = true;
  console.log(`[mDNS] Announcing fleetsync.local:${port}`);
}

function stopAnnouncing() {
  mdns.destroy();
}

module.exports = { announceService, stopAnnouncing };
```

- [ ] **Step 16.2: Create electron/tray.js**

```javascript
const { Tray, Menu, shell, dialog } = require('electron');
const path = require('path');

let tray = null;

function buildMenu({ port, lanIp, onBackup, onRestore, onQuit, autoStart, onToggleAutoStart }) {
  return Menu.buildFromTemplate([
    { label: 'Open FleetSync', click: () => shell.openExternal(`http://localhost:${port}`) },
    { label: `Network: http://${lanIp}:${port}`, enabled: false },
    { type: 'separator' },
    { label: 'Backup Data...', click: onBackup },
    { label: 'Restore from Backup...', click: onRestore },
    { type: 'separator' },
    { label: 'Start on Login', type: 'checkbox', checked: autoStart, click: onToggleAutoStart },
    { type: 'separator' },
    { label: 'Quit FleetSync Lite', click: onQuit },
  ]);
}

function createTray(options) {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  tray.setToolTip(`FleetSync Lite — Running on port ${options.port}`);
  tray.setContextMenu(buildMenu(options));
  return tray;
}

function updateTray(options) {
  if (!tray) return;
  tray.setToolTip(`FleetSync Lite — Running on port ${options.port}`);
  tray.setContextMenu(buildMenu(options));
}

module.exports = { createTray, updateTray };
```

- [ ] **Step 16.3: Create electron/main.js**

```javascript
const { app, dialog, shell } = require('electron');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { loadConfig, saveConfig, CONFIG_DIR } = require('./config');
const { createTray, updateTray } = require('./tray');
const { announceService, stopAnnouncing } = require('./mdns');

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let expressServer = null;

async function findFreePort(startPort) {
  for (let port = startPort; port <= startPort + 10; port++) {
    const free = await new Promise(resolve => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => { srv.close(); resolve(true); });
      srv.listen(port);
    });
    if (free) return port;
  }
  return null;
}

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

app.whenReady().then(async () => {
  const config = loadConfig();

  // Set JWT secret for the server
  process.env.JWT_SECRET = config.jwtSecret;
  process.env.FLEETSYNC_DB_PATH = path.join(CONFIG_DIR, 'fleetsync.db');

  // Find a free port
  const port = await findFreePort(config.port);
  if (!port) {
    dialog.showErrorBoxSync('FleetSync Lite', 'Could not find a free port in range 3000-3010. Exiting.');
    app.quit();
    return;
  }
  if (port !== config.port) {
    const use = dialog.showMessageBoxSync({
      type: 'question',
      buttons: ['Use port ' + port, 'Cancel'],
      message: `Port ${config.port} is in use. Use port ${port} instead?`,
    });
    if (use !== 0) { app.quit(); return; }
    saveConfig({ port });
  }

  // Start Express server
  const { startServer, server } = require('../server/src/index');
  expressServer = server;
  await startServer(port);

  const lanIp = getLanIp();
  announceService(port);

  // Create tray
  const trayOptions = {
    port, lanIp,
    autoStart: app.getLoginItemSettings().openAtLogin,
    onBackup: () => require('./backup').backupDb(CONFIG_DIR),
    onRestore: () => require('./backup').restoreDb(CONFIG_DIR, expressServer),
    onQuit: () => app.quit(),
    onToggleAutoStart: () => {
      const current = app.getLoginItemSettings().openAtLogin;
      app.setLoginItemSettings({ openAtLogin: !current });
      updateTray({ ...trayOptions, autoStart: !current });
    },
  };
  createTray(trayOptions);

  // Open browser for operator
  shell.openExternal(`http://localhost:${port}`);
});

app.on('before-quit', async () => {
  stopAnnouncing();
  if (expressServer) {
    await new Promise(resolve => expressServer.close(resolve));
  }
  const { closeDb } = require('../server/db/db');
  closeDb();
});

app.on('window-all-closed', () => {
  // Keep running in tray even when all windows closed
});
```

- [ ] **Step 16.4: Verify Electron starts without crashing**

```bash
cd C:/travelerp/.worktrees/fslite
npx electron . &
sleep 3
curl http://localhost:3000/api/health
```
Expected: `{"status":"ok"}` (or the actual port if 3000 was taken)

- [ ] **Step 16.5: Commit**

```bash
git add electron/main.js electron/tray.js electron/mdns.js electron/config.js
git commit -m "feat(lite): Electron main.js with tray, mDNS, port conflict handling"
```

---

### Task 17: Backup and Restore

**Files:**
- Create: `electron/backup.js`

- [ ] **Step 17.1: Create electron/backup.js**

```javascript
const { dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function backupDb(configDir) {
  const dbPath = path.join(configDir, 'fleetsync.db');
  const { filePath } = dialog.showSaveDialogSync({
    title: 'Save Backup',
    defaultPath: `FleetSyncLite-backup-${new Date().toISOString().split('T')[0]}.db`,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });
  if (!filePath) return;

  // Use SQLite Online Backup API for a consistent copy
  const source = new Database(dbPath, { readonly: true });
  source.backup(filePath)
    .then(() => {
      source.close();
      dialog.showMessageBoxSync({ message: `Backup saved to:\n${filePath}` });
    })
    .catch(err => {
      source.close();
      dialog.showErrorBoxSync('Backup Failed', String(err));
    });
}

function restoreDb(configDir, expressServer) {
  const { filePaths } = dialog.showOpenDialogSync({
    title: 'Select Backup File',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile'],
  });
  if (!filePaths || !filePaths[0]) return;
  const backupFile = filePaths[0];

  const confirm = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['Restore', 'Cancel'],
    message: 'This will replace all current data with the selected backup.\nAre you sure?',
  });
  if (confirm !== 0) return;

  const dbPath = path.join(configDir, 'fleetsync.db');
  const { reconnect } = require('../server/db/db');

  // Drain in-flight requests, close db, replace file, reconnect
  expressServer.close(() => {
    const { closeDb } = require('../server/db/db');
    closeDb();
    fs.copyFileSync(backupFile, dbPath);
    reconnect(dbPath);

    // Restart Express
    const { startServer } = require('../server/src/index');
    const { loadConfig } = require('./config');
    const config = loadConfig();
    startServer(config.port).then(() => {
      dialog.showMessageBoxSync({ message: 'Restore complete. Server restarted.' });
    });
  });
}

module.exports = { backupDb, restoreDb };
```

- [ ] **Step 17.2: Commit**

```bash
git add electron/backup.js
git commit -m "feat(lite): backup/restore with SQLite Online Backup API and server drain"
```

---

## Phase 5 — Frontend: Version Field

### Task 18: Plumb version through frontend forms

Every edit form must: (a) store `version` from GET response in component state, and (b) include `version` in PUT/PATCH request body.

**Files:**
- Modify: All `src/components/*/` list components that have edit forms

This is a mechanical change. The pattern is the same for every module.

**Pattern:**
```typescript
// In the component state interface, add version:
interface EditState {
  // ... existing fields
  version: number;
}

// When loading a record for edit, capture version:
setEditState({ ...record, version: record.version });

// When submitting the edit form, include version:
const response = await fetch(`/api/customers/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ ...formData, version }),
});

// Handle 409 Conflict:
if (response.status === 409) {
  alert('This record was updated by someone else. Reloading latest version.');
  // Re-fetch the record and update form state
  const fresh = await fetch(`/api/customers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const freshData = await fresh.json();
  setEditState(freshData);
  return;
}
```

- [ ] **Step 18.1: List all component files with edit forms**

```bash
grep -rl "method.*PUT\|method.*PATCH" C:/travelerp/.worktrees/fslite/src/components/
```

- [ ] **Step 18.2: Add version to each component**

For each file found:
1. Add `version: number` to the form state interface
2. Set `version` when populating edit form from fetched record
3. Include `version` in PUT/PATCH request body
4. Add 409 conflict handler

- [ ] **Step 18.3: Commit**

```bash
git add src/components/
git commit -m "feat(lite): plumb version field through all frontend edit forms for optimistic locking"
```

---

## Phase 6 — Integration Test and Build

### Task 19: End-to-end smoke test

- [ ] **Step 19.1: Build the React frontend**

```bash
cd C:/travelerp/.worktrees/fslite
npm run build
```
Expected: `dist/` produced with no errors.

- [ ] **Step 19.2: Start Electron and verify core flows**

```bash
cd C:/travelerp/.worktrees/fslite
npx electron .
```

Manually verify:
- [ ] App starts, tray icon appears
- [ ] Browser opens to localhost
- [ ] Can register/login a user
- [ ] Can create a customer
- [ ] Can create a trip
- [ ] Can create an invoice
- [ ] Tray "View Network Address" shows correct LAN IP
- [ ] Tray "Backup Data" saves a .db file
- [ ] Tray "Restore from Backup" restores and server comes back

- [ ] **Step 19.3: Commit any fixes found during smoke test**

---

### Task 20: electron-builder NSIS installer

- [ ] **Step 20.1: Add icon files**

Place a 256×256 PNG at `electron/icon.png` and ICO at `electron/icon.ico`. Use any placeholder icon for now.

- [ ] **Step 20.2: Rebuild native modules for Electron ABI**

```bash
cd C:/travelerp/.worktrees/fslite
npx electron-rebuild -f -w better-sqlite3
```
Expected: `better-sqlite3` rebuilt successfully. If this fails, the installer will crash on launch with `NODE_MODULE_VERSION mismatch`. Fix before proceeding.

- [ ] **Step 20.3: Build installer**

```bash
cd C:/travelerp/.worktrees/fslite
npm run dist
```
Expected: `dist-electron/FleetSyncLite-Setup-1.0.0.exe` produced.

- [ ] **Step 20.3: Test installer on clean Windows**

Install the .exe on a clean Windows machine (or VM). Verify:
- [ ] Installs to Program Files
- [ ] Appears in Add/Remove Programs
- [ ] App starts after install
- [ ] `fleetsync.db` created in `%APPDATA%\FleetSyncLite\`
- [ ] Other machine on same LAN can reach `http://<ip>:3000`

- [ ] **Step 20.4: Commit**

```bash
git add electron/icon.png electron/icon.ico
git commit -m "feat(lite): electron-builder NSIS installer"
```

---

## Appendix: Known Limitations (v1)

These are intentional — do not implement in this plan:
- No auto-update mechanism
- No Worker thread for SQLite (synchronous blocking accepted)
- No Linux/macOS packaging
- No data import from TravelERP PostgreSQL
- No multi-laptop sync
