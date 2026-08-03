PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('seller', 'customer')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  slug TEXT UNIQUE,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  customer_id TEXT REFERENCES users(id),
  customer_name TEXT NOT NULL,
  items TEXT NOT NULL,
  total INTEGER NOT NULL,
  dining_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  department TEXT,
  payment_method TEXT,
  completed_at TEXT,
  refunded_at TEXT,
  refund_reason TEXT,
  request_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id),
  payment_method TEXT,
  outcome TEXT NOT NULL,
  message TEXT,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_orders_seller_created ON orders(seller_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_seller_request_key ON orders(seller_id, request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON payment_attempts(order_id, attempted_at DESC);
