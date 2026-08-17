PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS order_changes (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id),
  change_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  before_status TEXT,
  after_status TEXT,
  before_items TEXT,
  after_items TEXT,
  before_total INTEGER,
  after_total INTEGER,
  undone_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_changes_order_created
ON order_changes(order_id, created_at DESC);
