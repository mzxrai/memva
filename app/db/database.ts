import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let db: ReturnType<typeof drizzle> | null = null
let sqlite: Database.Database | null = null

export function getDatabase(dbPath: string = './memva.db') {
  if (db) {
    return db
  }

  // Create SQLite connection
  sqlite = new Database(dbPath)
  
  // Enable foreign keys and WAL mode for better concurrent access
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')
  
  // Create Drizzle instance
  db = drizzle(sqlite, { schema })
  
  // Initialize schema
  initializeSchema()
  
  return db
}

function initializeSchema() {
  if (!sqlite) return
  
  // Create events table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS events (
      uuid TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      is_sidechain INTEGER DEFAULT 0,
      parent_uuid TEXT,
      cwd TEXT NOT NULL,
      project_name TEXT NOT NULL,
      data TEXT NOT NULL,
      file_path TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // Create indexes for efficient queries
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_project_name ON events(project_name);
    CREATE INDEX IF NOT EXISTS idx_event_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_parent_uuid ON events(parent_uuid);
  `)
}

export function closeDatabase() {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
  }
}