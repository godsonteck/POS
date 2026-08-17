import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface DatabaseOptions { filename: string; schemaPath?: string; }

export function openDatabase(options: DatabaseOptions): Database.Database {
  const db = new Database(options.filename);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(options.schemaPath ?? join(dirname(new URL(import.meta.url).pathname), 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

export function ensureAppMetadata(db: Database.Database, key: string, value: string, now = new Date().toISOString()): void {
  db.prepare(`INSERT INTO app_metadata (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(key, value, now);
}

export function createId(): string { return randomUUID(); }
