-- Sessions table for persistent auth
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Index for cleanup queries
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
