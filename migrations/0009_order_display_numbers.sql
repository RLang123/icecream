ALTER TABLE orders ADD COLUMN display_order_number INTEGER
CHECK (display_order_number IS NULL OR display_order_number BETWEEN 1 AND 100);

UPDATE orders AS target
SET display_order_number = (
  SELECT COUNT(*)
  FROM orders AS prior
  WHERE prior.seller_id = target.seller_id
    AND prior.status IN ('new', 'preparing')
    AND (
      prior.created_at < target.created_at
      OR (prior.created_at = target.created_at AND prior.id <= target.id)
    )
)
WHERE target.status IN ('new', 'preparing')
  AND target.display_order_number IS NULL;

UPDATE orders AS target
SET display_order_number = 1 + ((
  SELECT COUNT(*)
  FROM orders AS prior
  WHERE prior.seller_id = target.seller_id
    AND (
      prior.created_at < target.created_at
      OR (prior.created_at = target.created_at AND prior.id <= target.id)
    )
) - 1) % 100
WHERE target.status IN ('completed', 'done', 'cancelled', 'refunded')
  AND target.display_order_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_seller_active_display_number
ON orders(seller_id, display_order_number)
WHERE status IN ('new', 'preparing')
  AND display_order_number IS NOT NULL;
