ALTER TABLE projects ADD COLUMN inventory_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN inventory_request_key TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_inventory_request_key
ON projects(owner_id, inventory_request_key);
