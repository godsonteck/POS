import type Database from 'better-sqlite3';
import type { SyncTransport } from './sync';

export interface HttpSyncTransportOptions {
  baseUrl: string;
  shopId: string;
  token: string;
  timeoutMs?: number;
}

/**
 * Production sync transport. It only pushes already-durable local outbox rows;
 * checkout itself never waits for this network request.
 */
export function createHttpSyncTransport(options: HttpSyncTransportOptions): SyncTransport {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? 10_000;

  return {
    async push(batch) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseUrl}/v1/sync/push`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${options.token}`,
          },
          body: JSON.stringify({ shopId: options.shopId, events: batch }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`Sync server returned HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export async function flushHttpSyncQueue(
  db: Database.Database,
  options: HttpSyncTransportOptions & { batchSize?: number; maxAttempts?: number } ,
): Promise<number> {
  const { flushSyncQueue } = await import('./sync');
  return flushSyncQueue(db, createHttpSyncTransport(options), options);
}
