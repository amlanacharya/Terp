import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
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
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (fs.existsSync(testMigrationsDir)) {
    fs.rmSync(testMigrationsDir, { recursive: true, force: true });
  }
});

describe('runMigrations', () => {
  it('applies unapplied migration files in order', () => {
    const db = openDb(testDbPath);
    db.exec('CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    fs.writeFileSync(
      path.join(testMigrationsDir, '20260101_001_create_foo.sql'),
      'CREATE TABLE foo (id TEXT PRIMARY KEY)'
    );
    fs.writeFileSync(
      path.join(testMigrationsDir, '20260101_002_create_bar.sql'),
      'CREATE TABLE bar (id TEXT PRIMARY KEY)'
    );

    runMigrations(db, testMigrationsDir);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toContain('foo');
    expect(tables).toContain('bar');

    const applied = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all()
      .map((row) => (row as { version: string }).version);
    expect(applied).toEqual([
      '20260101_001_create_foo.sql',
      '20260101_002_create_bar.sql',
    ]);
    db.close();
  });

  it('does not re-apply already applied migrations', () => {
    const db = openDb(testDbPath);
    db.exec('CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const migrationFile = path.join(testMigrationsDir, '20260101_001_create_foo.sql');
    fs.writeFileSync(migrationFile, 'CREATE TABLE foo (id TEXT PRIMARY KEY)');

    runMigrations(db, testMigrationsDir);
    runMigrations(db, testMigrationsDir);

    const count = db.prepare('SELECT count(*) AS c FROM schema_migrations').get() as { c: number };
    expect(count.c).toBe(1);
    db.close();
  });
});
