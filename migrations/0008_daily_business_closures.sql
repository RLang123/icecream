CREATE TABLE IF NOT EXISTS daily_closures (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  business_date TEXT NOT NULL,
  total_order_count INTEGER NOT NULL,
  completed_order_count INTEGER NOT NULL,
  cancelled_order_count INTEGER NOT NULL,
  total_revenue INTEGER NOT NULL,
  closed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cleaned_order_count INTEGER NOT NULL,
  request_key TEXT NOT NULL,
  UNIQUE (seller_id, business_date),
  UNIQUE (seller_id, request_key)
);

ALTER TABLE orders ADD COLUMN details_cleaned_at TEXT;
