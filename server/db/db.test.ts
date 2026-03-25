import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { openDb } from './db';

let testDbPath: string;

beforeEach(() => {
  testDbPath = path.join(os.tmpdir(), `test-${Date.now()}.db`);
});

afterEach(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
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
