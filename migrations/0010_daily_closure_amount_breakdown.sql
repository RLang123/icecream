ALTER TABLE daily_closures ADD COLUMN total_order_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_closures ADD COLUMN cancelled_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_closures ADD COLUMN refunded_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_closures ADD COLUMN net_revenue INTEGER NOT NULL DEFAULT 0;

UPDATE daily_closures
SET total_order_amount = COALESCE((
      SELECT SUM(orders.total)
      FROM orders
      WHERE orders.seller_id = daily_closures.seller_id
        AND orders.created_at >= datetime(daily_closures.business_date, '-9 hours')
        AND orders.created_at < datetime(daily_closures.business_date, '+1 day', '-9 hours')
        AND orders.status IN ('completed', 'done', 'cancelled', 'refunded')
    ), 0),
    cancelled_amount = COALESCE((
      SELECT SUM(orders.total)
      FROM orders
      WHERE orders.seller_id = daily_closures.seller_id
        AND orders.created_at >= datetime(daily_closures.business_date, '-9 hours')
        AND orders.created_at < datetime(daily_closures.business_date, '+1 day', '-9 hours')
        AND orders.status = 'cancelled'
    ), 0),
    refunded_amount = COALESCE((
      SELECT SUM(orders.total)
      FROM orders
      WHERE orders.seller_id = daily_closures.seller_id
        AND orders.created_at >= datetime(daily_closures.business_date, '-9 hours')
        AND orders.created_at < datetime(daily_closures.business_date, '+1 day', '-9 hours')
        AND orders.status = 'refunded'
    ), 0),
    net_revenue = COALESCE((
      SELECT SUM(orders.total)
      FROM orders
      WHERE orders.seller_id = daily_closures.seller_id
        AND orders.created_at >= datetime(daily_closures.business_date, '-9 hours')
        AND orders.created_at < datetime(daily_closures.business_date, '+1 day', '-9 hours')
        AND orders.status IN ('completed', 'done')
    ), 0),
    total_revenue = COALESCE((
      SELECT SUM(orders.total)
      FROM orders
      WHERE orders.seller_id = daily_closures.seller_id
        AND orders.created_at >= datetime(daily_closures.business_date, '-9 hours')
        AND orders.created_at < datetime(daily_closures.business_date, '+1 day', '-9 hours')
        AND orders.status IN ('completed', 'done')
    ), 0);
