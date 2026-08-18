import type Database from 'better-sqlite3';

export interface RemoteSyncEvent {
  id: string;
  sequence: number;
  entityType: string;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: unknown;
}

export interface SyncApplyResult {
  applied: number;
  duplicates: number;
  rejected: number;
  nextSequence: number;
}

function metadata(db: Database.Database, key: string, fallback: string): string {
  return (db.prepare('SELECT value FROM app_metadata WHERE key = ?').get(key) as { value?: string } | undefined)?.value ?? fallback;
}

function setMetadata(db: Database.Database, key: string, value: string, now: string): void {
  db.prepare(`INSERT INTO app_metadata (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(key, value, now);
}

/**
 * Applies server events transactionally and records every event before advancing
 * the cursor. Remote application never creates a local outbox event, preventing
 * synchronization loops.
 */
export function applyRemoteEvents(db: Database.Database, events: RemoteSyncEvent[], now = new Date().toISOString()): SyncApplyResult {
  if (!events.length) {
    return { applied: 0, duplicates: 0, rejected: 0, nextSequence: Number(metadata(db, 'sync.pull.cursor', '0')) };
  }

  let applied = 0;
  let duplicates = 0;
  let rejected = 0;
  let nextSequence = Number(metadata(db, 'sync.pull.cursor', '0'));

  const tx = db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS sync_applied_events (
      event_id TEXT PRIMARY KEY,
      sequence INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    )`);

    for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
      if (!event.id || !Number.isSafeInteger(event.sequence) || event.sequence < 1) {
        rejected += 1;
        continue;
      }
      if (db.prepare('SELECT 1 FROM sync_applied_events WHERE event_id = ?').get(event.id)) {
        duplicates += 1;
        nextSequence = Math.max(nextSequence, event.sequence);
        continue;
      }

      const payload = event.payload as Record<string, unknown> | null;
      if (!payload || typeof payload !== 'object') throw new Error(`Invalid sync payload: ${event.id}`);

      if (event.entityType === 'product' && event.operation === 'upsert') {
        const productId = String(payload.productId ?? event.entityId);
        const name = String(payload.name ?? '');
        const barcode = payload.barcode == null ? null : String(payload.barcode);
        const categoryId = payload.categoryId == null ? null : String(payload.categoryId);
        const price = Number(payload.pricePesewas);
        const stock = Number(payload.quantityInStock);
        const threshold = Number(payload.lowStockThreshold ?? 5);
        if (!name || !Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(stock) || stock < 0) {
          throw new Error(`Invalid product sync payload: ${event.id}`);
        }
        db.prepare(`INSERT INTO products (id,name,barcode,category_id,price_pesewas,quantity_in_stock,low_stock_threshold,active,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,1,?,?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, barcode=excluded.barcode, category_id=excluded.category_id,
          price_pesewas=excluded.price_pesewas, quantity_in_stock=excluded.quantity_in_stock,
          low_stock_threshold=excluded.low_stock_threshold, updated_at=excluded.updated_at`).run(
          productId, name, barcode, categoryId, price, stock, threshold, now, now,
        );
      } else if (event.entityType === 'product' && event.operation === 'delete') {
        db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(now, event.entityId);
      } else {
        rejected += 1;
        continue;
      }

      db.prepare('INSERT INTO sync_applied_events (event_id, sequence, applied_at) VALUES (?, ?, ?)').run(event.id, event.sequence, now);
      applied += 1;
      nextSequence = Math.max(nextSequence, event.sequence);
    }

    setMetadata(db, 'sync.pull.cursor', String(nextSequence), now);
  });

  tx();
  return { applied, duplicates, rejected, nextSequence };
}

export function getSyncCursor(db: Database.Database): number {
  return Number(metadata(db, 'sync.pull.cursor', '0'));
}
