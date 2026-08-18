import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { eventFromRow, normalizeCursor, SYNC_PROTOCOL_VERSION } from './protocol.mjs';

const port = Number(process.env.PORT || 8787);
const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const tokenConfig = JSON.parse(process.env.POS_SYNC_TOKENS || '{}');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'sync.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = FULL');
db.exec(`
  CREATE TABLE IF NOT EXISTS sync_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    shop_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    received_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sync_events_shop_sequence ON sync_events(shop_id, sequence);
`);

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2_000_000) req.destroy(new Error('Request body too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function authenticate(req, shopId) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const expected = tokenConfig[shopId];
  return Boolean(expected && token && constantTimeEqual(token, expected));
}

const insert = db.prepare(`INSERT OR IGNORE INTO sync_events
  (id, shop_id, entity_type, entity_id, operation, payload_json, received_at)
  VALUES (@id, @shopId, @entityType, @entityId, @operation, @payloadJson, @receivedAt)`);
const countBefore = db.prepare('SELECT COUNT(*) AS count FROM sync_events WHERE id = ?');
const pull = db.prepare(`SELECT sequence, id, shop_id, entity_type, entity_id, operation, payload_json, received_at
  FROM sync_events WHERE shop_id = ? AND sequence > ? ORDER BY sequence ASC LIMIT ?`);

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, service: 'pos-sync', protocolVersion: SYNC_PROTOCOL_VERSION, time: new Date().toISOString() });
    }
    if (req.method === 'POST' && req.url === '/v1/sync/push') {
      const body = await readBody(req);
      const shopId = typeof body.shopId === 'string' ? body.shopId.trim() : '';
      const events = Array.isArray(body.events) ? body.events : [];
      if (!shopId || events.length === 0 || events.length > 500) return json(res, 400, { error: 'Invalid sync batch' });
      if (!authenticate(req, shopId)) return json(res, 401, { error: 'Unauthorized' });

      const receivedAt = new Date().toISOString();
      const tx = db.transaction(() => {
        let inserted = 0;
        for (const event of events) {
          if (!event?.id || !event.entityType || !event.entityId || !event.operation) throw new Error('Malformed sync event');
          const existed = countBefore.get(String(event.id)).count > 0;
          insert.run({
            id: String(event.id),
            shopId,
            entityType: String(event.entityType),
            entityId: String(event.entityId),
            operation: String(event.operation),
            payloadJson: JSON.stringify(event.payload ?? null),
            receivedAt,
          });
          if (!existed) inserted += 1;
        }
        return inserted;
      });
      const inserted = tx();
      return json(res, 200, { accepted: events.length, inserted, duplicates: events.length - inserted });
    }

    if (req.method === 'GET' && req.url?.startsWith('/v1/sync/pull')) {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const shopId = (url.searchParams.get('shopId') || '').trim();
      const cursor = normalizeCursor(url.searchParams.get('cursor'));
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 250), 1), 500);
      if (!shopId) return json(res, 400, { error: 'shopId is required' });
      if (!authenticate(req, shopId)) return json(res, 401, { error: 'Unauthorized' });
      const rows = pull.all(shopId, cursor, limit);
      const events = rows.map(eventFromRow);
      const nextCursor = events.length ? events[events.length - 1].sequence : cursor;
      return json(res, 200, { protocolVersion: SYNC_PROTOCOL_VERSION, events, nextCursor, hasMore: events.length === limit });
    }

    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : 'Bad request' });
  }
});

server.listen(port, () => console.log(`POS sync server listening on :${port}`));
