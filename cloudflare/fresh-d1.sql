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
  details_cleaned_at TEXT,
  display_order_number INTEGER CHECK (display_order_number IS NULL OR display_order_number BETWEEN 1 AND 100),
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
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at_id ON sessions(expires_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_orders_seller_created ON orders(seller_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_seller_request_key ON orders(seller_id, request_key) WHERE request_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_seller_active_display_number ON orders(seller_id, display_order_number) WHERE status IN ('new', 'preparing') AND display_order_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON payment_attempts(order_id, attempted_at DESC);

CREATE TABLE IF NOT EXISTS daily_closures (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  business_date TEXT NOT NULL,
  total_order_count INTEGER NOT NULL,
  completed_order_count INTEGER NOT NULL,
  cancelled_order_count INTEGER NOT NULL,
  total_revenue INTEGER NOT NULL,
  total_order_amount INTEGER NOT NULL DEFAULT 0,
  cancelled_amount INTEGER NOT NULL DEFAULT 0,
  refunded_amount INTEGER NOT NULL DEFAULT 0,
  net_revenue INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cleaned_order_count INTEGER NOT NULL,
  request_key TEXT NOT NULL,
  UNIQUE (seller_id, business_date),
  UNIQUE (seller_id, request_key)
);
