PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS order_change_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (seller_id, request_key)
);

CREATE INDEX IF NOT EXISTS idx_order_change_requests_order_created
ON order_change_requests(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reserved_store_slugs (
  slug TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  project_owner_id TEXT REFERENCES projects(owner_id),
  reserved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retired_at TEXT
);

INSERT OR IGNORE INTO reserved_store_slugs(slug, owner_id, project_owner_id)
SELECT slug, owner_id, owner_id
FROM projects
WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reserved_store_slugs_project
ON reserved_store_slugs(project_owner_id)
WHERE project_owner_id IS NOT NULL;
