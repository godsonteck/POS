export const SYNC_PROTOCOL_VERSION = 1;

export function normalizeCursor(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

export function eventFromRow(row) {
  return {
    id: row.id,
    shopId: row.shop_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    payload: JSON.parse(row.payload_json),
    receivedAt: row.received_at,
    sequence: row.sequence,
  };
}
