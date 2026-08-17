const net = require('node:net');

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function bytes(...values) {
  return Buffer.from(values);
}

function text(value = '') {
  return Buffer.from(String(value), 'utf8');
}

function money(pesewas) {
  return `GHS ${(Number(pesewas || 0) / 100).toFixed(2)}`;
}

function line(width = 42) {
  return '-'.repeat(width);
}

function padColumns(left, right, width = 42) {
  const l = String(left);
  const r = String(right);
  const spaces = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(spaces) + r;
}

function buildReceipt(sale, options = {}) {
  if (!sale || !sale.receiptNumber) throw new Error('Sale data is required');
  const width = Number(options.width || 42);
  const chunks = [];
  chunks.push(bytes(ESC, 0x40)); // initialize
  chunks.push(bytes(ESC, 0x61, 0x01)); // center
  chunks.push(bytes(ESC, 0x21, 0x10)); // double-height emphasis
  chunks.push(text(options.shopName || 'Retail POS'));
  chunks.push(bytes(LF));
  chunks.push(bytes(ESC, 0x21, 0x00));
  if (options.address) { chunks.push(text(options.address)); chunks.push(bytes(LF)); }
  if (options.phone) { chunks.push(text(options.phone)); chunks.push(bytes(LF)); }
  chunks.push(text(line(width))); chunks.push(bytes(LF));
  chunks.push(bytes(ESC, 0x61, 0x00));
  chunks.push(text(`Receipt: ${sale.receiptNumber}`)); chunks.push(bytes(LF));
  chunks.push(text(`Date: ${sale.createdAt || ''}`)); chunks.push(bytes(LF));
  chunks.push(text(`Cashier: ${sale.staffName || sale.staffId || ''}`)); chunks.push(bytes(LF));
  chunks.push(text(line(width))); chunks.push(bytes(LF));

  for (const item of sale.items || []) {
    const name = String(item.productName || 'Item').slice(0, width);
    chunks.push(text(name)); chunks.push(bytes(LF));
    chunks.push(text(padColumns(`  ${item.quantity} x ${money(item.unitPricePesewas)}`, money(item.lineTotalPesewas), width)));
    chunks.push(bytes(LF));
  }

  chunks.push(text(line(width))); chunks.push(bytes(LF));
  chunks.push(text(padColumns('TOTAL', money(sale.totalPesewas), width))); chunks.push(bytes(LF));
  chunks.push(text(padColumns('Payment', String(sale.paymentMethod || '').toUpperCase(), width))); chunks.push(bytes(LF));
  if (sale.paymentMethod === 'cash') {
    chunks.push(text(padColumns('Tendered', money(sale.amountTenderedPesewas), width))); chunks.push(bytes(LF));
    chunks.push(text(padColumns('Change', money(sale.changePesewas), width))); chunks.push(bytes(LF));
  }
  if (sale.momoReference) {
    chunks.push(text(`MoMo Ref: ${sale.momoReference}`)); chunks.push(bytes(LF));
  }
  chunks.push(bytes(LF));
  chunks.push(bytes(ESC, 0x61, 0x01));
  chunks.push(text(options.footer || 'Thank you. Please come again.')); chunks.push(bytes(LF));
  chunks.push(bytes(LF, LF, LF));
  chunks.push(bytes(GS, 0x56, 0x00)); // full cut where supported
  return Buffer.concat(chunks);
}

function printTcp(payload, host, port = 9100, timeoutMs = 5000) {
  if (!host || typeof host !== 'string') throw new Error('Printer host is required');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid printer port');

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error); else resolve({ ok: true });
    };
    socket.setTimeout(timeoutMs, () => finish(new Error('Printer connection timed out')));
    socket.once('error', finish);
    socket.connect(port, host, () => {
      socket.write(payload, () => socket.end(() => finish()));
    });
  });
}

function validateSaleForPrinting(sale) {
  if (!sale || !sale.receiptNumber || !Array.isArray(sale.items)) throw new Error('Invalid sale for printing');
  return sale;
}

module.exports = { buildReceipt, printTcp, validateSaleForPrinting };
