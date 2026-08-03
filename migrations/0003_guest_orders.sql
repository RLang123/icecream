PRAGMA foreign_keys = OFF;

CREATE TABLE orders_new (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  customer_id TEXT REFERENCES users(id),
  customer_name TEXT NOT NULL,
  items TEXT NOT NULL,
  total INTEGER NOT NULL,
  dining_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO orders_new SELECT * FROM orders;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
CREATE INDEX idx_orders_seller_created ON orders(seller_id, created_at DESC);
PRAGMA foreign_keys = ON;
