import type Database from 'better-sqlite3';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface SyncTransport {
  push(batch: Array<{ id: string; entityType: string; entityId: string; operation: string; payload: unknown }>): Promise<void>;
}

export interface SyncOptions { batchSize?: number; maxAttempts?: number; }

/**
 * Pushes the durable local outbox. Selling never calls this synchronously;
 * connectivity is an optimization and synchronization failures stay queued.
 */
export async function flushSyncQueue(db: Database.Database, transport: SyncTransport, options: SyncOptions = {}): Promise<number> {
  const batchSize = options.batchSize ?? 50;
  const maxAttempts = options.maxAttempts ?? 10;
  const rows = db.prepare(`SELECT id, entity_type, entity_id, operation, payload_json, attempts
    FROM sync_outbox WHERE status = 'pending' AND attempts < ? ORDER BY created_at LIMIT ?`).all(maxAttempts, batchSize) as Array<{
      id: string; entity_type: string; entity_id: string; operation: string; payload_json: string; attempts: number;
    }>;
  if (!rows.length) return 0;

  const batch = rows.map((row) => ({ id: row.id, entityType: row.entity_type, entityId: row.entity_id, operation: row.operation, payload: JSON.parse(row.payload_json) }));
  try {
    await transport.push(batch);
    const mark = db.prepare("UPDATE sync_outbox SET status = 'synced', synced_at = ?, last_error = NULL WHERE id = ?");
    const now = new Date().toISOString();
    const tx = db.transaction(() => { for (const row of rows) mark.run(now, row.id); });
    tx();
    return rows.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const markFailed = db.prepare("UPDATE sync_outbox SET attempts = attempts + 1, last_error = ?, status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE 'pending' END WHERE id = ?");
    const tx = db.transaction(() => { for (const row of rows) markFailed.run(message, maxAttempts, row.id); });
    tx();
    return 0;
  }
}
