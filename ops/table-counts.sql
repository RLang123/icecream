SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'payment_attempts', COUNT(*) FROM payment_attempts;
