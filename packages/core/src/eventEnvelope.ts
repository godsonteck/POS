export const SYNC_PROTOCOL_VERSION = 1 as const;

export type SyncEntity = 'sale' | 'product' | 'category' | 'stock_movement' | 'shop_config';
export type SyncOperation = 'upsert' | 'delete';

export interface SaleSyncPayload {
  sale: {
    id: string;
    receiptNumber: string;
    staffId: string;
    shiftId: string | null;
    totalPesewas: number;
    status: 'completed' | 'voided' | 'refunded';
    createdAt: string;
  };
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPricePesewas: number;
    lineTotalPesewas: number;
  }>;
  payment: {
    id: string;
    method: 'cash' | 'momo';
    amountPesewas: number;
    amountTenderedPesewas: number;
    changePesewas: number;
    momoReference: string | null;
    createdAt: string;
  };
  stockMovements: Array<{
    id: string;
    productId: string;
    quantityDelta: number;
    reason: 'sale';
    referenceId: string | null;
    createdBy: string | null;
    createdAt: string;
  }>;
}

export interface SyncEvent<T = unknown> {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  eventId: string;
  shopId: string;
  sequence: number | null;
  entity: SyncEntity;
  entityId: string;
  operation: SyncOperation;
  occurredAt: string;
  payload: T;
}

export function assertSyncEvent(value: unknown): asserts value is SyncEvent {
  if (!value || typeof value !== 'object') throw new Error('Invalid sync event');
  const event = value as Record<string, unknown>;
  const requiredStrings = ['eventId', 'shopId', 'entityId', 'operation', 'occurredAt'];
  for (const key of requiredStrings) {
    if (typeof event[key] !== 'string' || !event[key]) throw new Error(`Invalid sync event field: ${key}`);
  }
  if (event.protocolVersion !== SYNC_PROTOCOL_VERSION) throw new Error('Unsupported sync protocol version');
  if (typeof event.entity !== 'string' || !['sale', 'product', 'category', 'stock_movement', 'shop_config'].includes(event.entity)) {
    throw new Error('Invalid sync entity');
  }
  if (event.operation !== 'upsert' && event.operation !== 'delete') throw new Error('Invalid sync operation');
  if (event.sequence !== null && (typeof event.sequence !== 'number' || !Number.isInteger(event.sequence) || event.sequence < 0)) {
    throw new Error('Invalid sync sequence');
  }
  if (event.payload === undefined) throw new Error('Sync event payload is required');
}

export function createSyncEvent<T>(input: Omit<SyncEvent<T>, 'protocolVersion' | 'sequence'> & { sequence?: number | null }): SyncEvent<T> {
  const event: SyncEvent<T> = {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sequence: input.sequence ?? null,
    eventId: input.eventId,
    shopId: input.shopId,
    entity: input.entity,
    entityId: input.entityId,
    operation: input.operation,
    occurredAt: input.occurredAt,
    payload: input.payload,
  };
  assertSyncEvent(event);
  return event;
}
