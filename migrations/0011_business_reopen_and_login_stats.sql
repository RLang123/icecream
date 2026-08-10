ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE daily_closures ADD COLUMN is_closed INTEGER NOT NULL DEFAULT 1
CHECK (is_closed IN (0, 1));
ALTER TABLE daily_closures ADD COLUMN reopened_at TEXT;
ALTER TABLE daily_closures ADD COLUMN close_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE daily_closures ADD COLUMN reopen_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS business_operation_requests (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  business_date TEXT NOT NULL,
  request_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('close', 'reopen')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (seller_id, request_key)
);

CREATE INDEX IF NOT EXISTS idx_business_operation_requests_seller_date
ON business_operation_requests(seller_id, business_date, created_at DESC);
