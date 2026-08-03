ALTER TABLE projects ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
