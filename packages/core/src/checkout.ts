import type Database from 'better-sqlite3';
import { pesewas, type Money } from './money';

export type PaymentMethod = 'cash' | 'momo';

export interface CheckoutLine {
  productId: string;
  quantity: number;
  unitPrice: Money;
}

export interface CheckoutInput {
  saleId: string;
  receiptNumber: string;
  staffId: string;
  lines: CheckoutLine[];
  paymentMethod: PaymentMethod;
  amountTendered?: Money;
  momoReference?: string;
  nowIso: string;
}

export interface CheckoutResult {
  saleId: string;
  receiptNumber: string;
  total: Money;
  change: Money;
}

/**
 * Atomic checkout boundary. The caller owns the SQLite connection.
 * Sale, items, payment, stock movements, audit entry and sync outbox are
 * committed together or not at all.
 */
export function completeCheckout(db: Database.Database, input: CheckoutInput): CheckoutResult {
  if (!input.lines.length) throw new Error('Cannot complete an empty sale');
  if (new Set(input.lines.map((line) => line.productId)).size !== input.lines.length) {
    throw new Error('Duplicate products are not allowed in a sale');
  }
  for (const line of input.lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error('Invalid quantity');
  }

  const total = pesewas(input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const tendered = input.paymentMethod === 'cash' ? (input.amountTendered ?? pesewas(0)) : total;
  if (input.paymentMethod === 'cash' && tendered < total) throw new Error('Insufficient cash received');
  if (input.paymentMethod === 'momo' && !input.momoReference?.trim()) throw new Error('MoMo reference is required');

  const change = pesewas(tendered - total);
  const transaction = db.transaction(() => {
    for (const line of input.lines) {
      const product = db.prepare('SELECT id, name, quantity_in_stock FROM products WHERE id = ? AND active = 1').get(line.productId) as
        | { id: string; name: string; quantity_in_stock: number }
        | undefined;
      if (!product) throw new Error(`Product not found: ${line.productId}`);
      if (product.quantity_in_stock < line.quantity) throw new Error(`Insufficient stock: ${product.name}`);
    }

    db.prepare(`INSERT INTO sales (id, receipt_number, staff_id, total_amount, payment_method, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'completed')`).run(input.saleId, input.receiptNumber, input.staffId, total, input.paymentMethod, input.nowIso);

    for (const line of input.lines) {
      db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price_at_sale)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)`).run(input.saleId, line.productId, line.quantity, line.unitPrice);
      db.prepare('UPDATE products SET quantity_in_stock = quantity_in_stock - ?, updated_at = ? WHERE id = ?')
        .run(line.quantity, input.nowIso, line.productId);
      db.prepare(`INSERT INTO stock_movements (id, product_id, movement_type, quantity_delta, reference_type, reference_id, created_at)
        VALUES (lower(hex(randomblob(16))), ?, 'sale', ?, 'sale', ?, ?)`)
        .run(line.productId, -line.quantity, input.saleId, input.nowIso);
    }

    db.prepare(`INSERT INTO payments (id, sale_id, method, amount, reference, created_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)`)
      .run(input.saleId, input.paymentMethod, total, input.momoReference?.trim() ?? null, input.nowIso);

    db.prepare(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json, created_at)
      VALUES (lower(hex(randomblob(16))), ?, 'sale.completed', 'sale', ?, ?, ?)`)
      .run(input.staffId, input.saleId, JSON.stringify({ receiptNumber: input.receiptNumber, total, paymentMethod: input.paymentMethod }), input.nowIso);

    db.prepare(`INSERT INTO sync_outbox (id, entity_type, entity_id, operation, payload_json, status, attempts, created_at)
      VALUES (lower(hex(randomblob(16))), 'sale', ?, 'upsert', ?, 'pending', 0, ?)`)
      .run(input.saleId, JSON.stringify({ saleId: input.saleId, receiptNumber: input.receiptNumber }), input.nowIso);
  });

  transaction();
  return { saleId: input.saleId, receiptNumber: input.receiptNumber, total, change };
}
