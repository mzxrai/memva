-- Create settings table for storing application configuration
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default settings record if it doesn't exist
INSERT OR IGNORE INTO settings (id, config, created_at, updated_at)
VALUES ('singleton', '{"maxTurns": 200, "permissionMode": "acceptEdits"}', datetime('now'), datetime('now'));