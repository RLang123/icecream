CREATE INDEX IF NOT EXISTS idx_sessions_expires_at_id
ON sessions(expires_at, id);
