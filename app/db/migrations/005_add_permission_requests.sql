-- Add permission_requests table for tracking Claude Code permission requests
CREATE TABLE IF NOT EXISTS permission_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_use_id TEXT,
  input TEXT NOT NULL, -- JSON
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied, timeout
  decision TEXT, -- allow, deny
  decided_at TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_permission_requests_session_id ON permission_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);
CREATE INDEX IF NOT EXISTS idx_permission_requests_expires_at ON permission_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_permission_requests_created_at ON permission_requests(created_at);