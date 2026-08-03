ALTER TABLE orders ADD COLUMN request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_seller_request_key
ON orders(seller_id, request_key)
WHERE request_key IS NOT NULL;
