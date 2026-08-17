const crypto = require('node:crypto');

function id() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

function requireCashier(db, staffId) {
  const user = db.prepare("SELECT id, name, role, active FROM users WHERE id=? AND active=1").get(staffId);
  if (!user) throw new Error('Authorized user required');
  if (!['owner', 'cashier'].includes(user.role)) throw new Error('Invalid staff role');
  return user;
}

function openShift(db, input) {
  const staffId = String(input?.staffId || '');
  const openingCashPesewas = Number(input?.openingCashPesewas ?? 0);
  requireCashier(db, staffId);
  if (!Number.isSafeInteger(openingCashPesewas) || openingCashPesewas < 0) throw new Error('Invalid opening cash');
  const existing = db.prepare("SELECT id FROM shifts WHERE staff_id=? AND status='open'").get(staffId);
  if (existing) throw new Error('You already have an open shift');
  const shiftId = id();
  const timestamp = now();
  db.transaction(() => {
    db.prepare("INSERT INTO shifts (id, staff_id, opened_at, opening_cash_pesewas, status) VALUES (?, ?, ?, ?, 'open')")
      .run(shiftId, staffId, timestamp, openingCashPesewas);
    db.prepare("INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, 'shift.opened', 'shift', ?, ?, ?)")
      .run(id(), staffId, shiftId, JSON.stringify({ openingCashPesewas }), timestamp);
  })();
  return getOpenShift(db, staffId);
}

function getOpenShift(db, staffId) {
  return db.prepare("SELECT id, staff_id AS staffId, opened_at AS openedAt, opening_cash_pesewas AS openingCashPesewas, status FROM shifts WHERE staff_id=? AND status='open'").get(staffId) || null;
}

function closeShift(db, input) {
  const staffId = String(input?.staffId || '');
  const closingCashPesewas = Number(input?.closingCashPesewas);
  requireCashier(db, staffId);
  if (!Number.isSafeInteger(closingCashPesewas) || closingCashPesewas < 0) throw new Error('Invalid closing cash');
  const shift = db.prepare("SELECT id, opening_cash_pesewas AS openingCashPesewas, opened_at AS openedAt FROM shifts WHERE staff_id=? AND status='open'").get(staffId);
  if (!shift) throw new Error('No open shift');

  const sales = db.prepare("SELECT COALESCE(SUM(p.amount_pesewas),0) AS cashSalesPesewas FROM payments p JOIN sales s ON s.id=p.sale_id WHERE s.shift_id=? AND s.status='completed' AND p.method='cash'").get(shift.id);
  const expectedCashPesewas = shift.openingCashPesewas + Number(sales.cashSalesPesewas || 0);
  const differencePesewas = closingCashPesewas - expectedCashPesewas;
  const timestamp = now();

  db.transaction(() => {
    db.prepare("UPDATE shifts SET closed_at=?, closing_cash_pesewas=?, expected_cash_pesewas=?, difference_pesewas=?, status='closed' WHERE id=? AND status='open'")
      .run(timestamp, closingCashPesewas, expectedCashPesewas, differencePesewas, shift.id);
    db.prepare("INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, 'shift.closed', 'shift', ?, ?, ?)")
      .run(id(), staffId, shift.id, JSON.stringify({ closingCashPesewas, expectedCashPesewas, differencePesewas }), timestamp);
  })();
  return { shiftId: shift.id, closingCashPesewas, expectedCashPesewas, differencePesewas };
}

module.exports = { openShift, getOpenShift, closeShift };