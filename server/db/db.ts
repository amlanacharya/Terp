import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DEFAULT_DB_PATH = path.join(
  process.env.APPDATA || os.homedir(),
  'FleetSyncLite',
  'fleetsync.db'
);

export function openDb(filePath: string): Database.Database {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.FLEETSYNC_DB_PATH || DEFAULT_DB_PATH;
    dbInstance = openDb(dbPath);
  }
  return dbInstance;
}

export function reconnect(filePath: string): void {
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = openDb(filePath);
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
