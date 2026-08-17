PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;

CREATE TABLE IF NOT EXISTS shop_config (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('cosmetics-provisions','shisha')),
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  logo_path TEXT,
  phone TEXT,
  address TEXT,
  receipt_footer TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT UNIQUE,
  price_pesewas INTEGER NOT NULL CHECK(price_pesewas >= 0),
  cost_pesewas INTEGER CHECK(cost_pesewas IS NULL OR cost_pesewas >= 0),
  quantity_in_stock INTEGER NOT NULL DEFAULT 0 CHECK(quantity_in_stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK(low_stock_threshold >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_name ON products(active, name);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','cashier')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES users(id),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opening_cash_pesewas INTEGER NOT NULL CHECK(opening_cash_pesewas >= 0),
  closing_cash_pesewas INTEGER CHECK(closing_cash_pesewas IS NULL OR closing_cash_pesewas >= 0),
  expected_cash_pesewas INTEGER,
  difference_pesewas INTEGER,
  status TEXT NOT NULL CHECK(status IN ('open','closed'))
);

CREATE INDEX IF NOT EXISTS idx_shifts_staff_status ON shifts(staff_id, status);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  staff_id TEXT NOT NULL REFERENCES users(id),
  shift_id TEXT REFERENCES shifts(id),
  total_pesewas INTEGER NOT NULL CHECK(total_pesewas >= 0),
  status TEXT NOT NULL CHECK(status IN ('completed','voided','refunded')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_staff ON sales(staff_id, created_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_pesewas INTEGER NOT NULL CHECK(unit_price_pesewas >= 0),
  line_total_pesewas INTEGER NOT NULL CHECK(line_total_pesewas >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK(method IN ('cash','momo')),
  amount_pesewas INTEGER NOT NULL CHECK(amount_pesewas > 0),
  amount_tendered_pesewas INTEGER NOT NULL CHECK(amount_tendered_pesewas >= 0),
  change_pesewas INTEGER NOT NULL CHECK(change_pesewas >= 0),
  momo_reference TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_method_created ON payments(method, created_at);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity_delta INTEGER NOT NULL CHECK(quantity_delta <> 0),
  reason TEXT NOT NULL CHECK(reason IN ('sale','adjustment','damage','expiry','restore','initial')),
  reference_id TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON stock_movements(product_id, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  available_at TEXT,
  synced_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_pending ON sync_outbox(synced_at, available_at, created_at);
