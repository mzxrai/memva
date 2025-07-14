import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let db: ReturnType<typeof drizzle> | null = null
let sqlite: Database.Database | null = null

function getDatabasePath(): string {
  // Use test database when running tests
  if (process.env.VITEST) {
    return './memva-test.db'
  }
  
  // Use production database in production
  if (process.env.NODE_ENV === 'production') {
    return './memva-prod.db'
  }
  
  // Default to development database
  return './memva-dev.db'
}

export function getDatabase(dbPath?: string) {
  if (db) {
    return db
  }

  // Use environment-based path if no explicit path provided
  const finalDbPath = dbPath || getDatabasePath()
  console.log(`[Database] Using database: ${finalDbPath}`)

  // Create SQLite connection
  sqlite = new Database(finalDbPath)
  
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
  
  // Create sessions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      project_path TEXT NOT NULL,
      metadata TEXT
    )
  `)
  
  // Create events table (without memva_session_id for compatibility)
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
      data TEXT NOT NULL
    )
  `)
  
  // Run migrations to add new columns
  runMigrations()
  
  // Create indexes for efficient queries (after migrations)
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_project_name ON events(project_name);
    CREATE INDEX IF NOT EXISTS idx_event_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_parent_uuid ON events(parent_uuid);
    CREATE INDEX IF NOT EXISTS idx_memva_session_id ON events(memva_session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
  `)
}

function runMigrations() {
  if (!sqlite) return
  
  // Check if memva_session_id column exists
  const columns = sqlite.prepare(`PRAGMA table_info(events)`).all()
  const hasMemvaSessionId = columns.some((col: unknown) => 
    typeof col === 'object' && col !== null && 'name' in col && (col as { name: string }).name === 'memva_session_id'
  )
  
  if (!hasMemvaSessionId) {
    console.log('Migrating: Adding memva_session_id column to events table')
    sqlite.exec(`ALTER TABLE events ADD COLUMN memva_session_id TEXT`)
  }
}

export function closeDatabase() {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
  }
}

// Force database reset for testing
export function resetDatabase() {
  closeDatabase()
}

// Export a getter for the database instance
export { getDatabase as getDb }