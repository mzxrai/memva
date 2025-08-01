import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync } from 'fs'

let db: ReturnType<typeof drizzle> | null = null
let sqlite: Database.Database | null = null

// Store database in user's home directory under .memva
const MEMVA_DIR = join(homedir(), '.memva')

function getDatabasePath(): string {
  // Ensure .memva directory exists
  try {
    mkdirSync(MEMVA_DIR, { recursive: true })
  } catch {
    // Ignore if directory already exists
  }

  // Use test database when running tests
  if (process.env.VITEST) {
    return './memva-test.db'
  }
  
  // Use production database in production
  if (process.env.NODE_ENV === 'production') {
    return join(MEMVA_DIR, 'memva-prod.db')
  }
  
  // Default to development database
  return join(MEMVA_DIR, 'memva.db')
}

export function getDatabase(dbPath?: string) {
  if (db) {
    return db
  }

  // Use environment-based path if no explicit path provided
  const finalDbPath = dbPath || getDatabasePath()

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
      metadata TEXT,
      claude_status TEXT DEFAULT 'not_started',
      settings TEXT
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
      data TEXT NOT NULL,
      visible INTEGER DEFAULT 1
    )
  `)
  
  // Create jobs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      error TEXT,
      result TEXT,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  
  // Create settings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    CREATE INDEX IF NOT EXISTS idx_visible ON events(visible);
    CREATE INDEX IF NOT EXISTS idx_session_visible ON events(session_id, visible);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_claude_status ON sessions(claude_status);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
    CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority);
    CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
  `)
}

function runMigrations() {
  if (!sqlite) return
  
  // Check if memva_session_id column exists
  const eventsColumns = sqlite.prepare(`PRAGMA table_info(events)`).all()
  const hasMemvaSessionId = eventsColumns.some((col: unknown) => 
    typeof col === 'object' && col !== null && 'name' in col && (col as { name: string }).name === 'memva_session_id'
  )
  
  if (!hasMemvaSessionId) {
    console.log('Migrating: Adding memva_session_id column to events table')
    sqlite.exec(`ALTER TABLE events ADD COLUMN memva_session_id TEXT`)
  }
  
  // Check if claude_status column exists in sessions table
  const sessionsColumns = sqlite.prepare(`PRAGMA table_info(sessions)`).all()
  const hasClaudeStatus = sessionsColumns.some((col: unknown) => 
    typeof col === 'object' && col !== null && 'name' in col && (col as { name: string }).name === 'claude_status'
  )
  
  if (!hasClaudeStatus) {
    console.log('Migrating: Adding claude_status column to sessions table')
    sqlite.exec(`ALTER TABLE sessions ADD COLUMN claude_status TEXT DEFAULT 'not_started'`)
  }
  
  // Check if settings table has any records, insert default if not
  const settingsCount = sqlite.prepare(`SELECT COUNT(*) as count FROM settings`).get() as { count: number }
  if (settingsCount.count === 0) {
    console.log('Migrating: Inserting default settings')
    sqlite.exec(`
      INSERT INTO settings (id, config, created_at, updated_at)
      VALUES ('singleton', '{"maxTurns": 200, "permissionMode": "acceptEdits"}', datetime('now'), datetime('now'))
    `)
  }
  
  // Check if sessions table has settings column
  const sessionColumns = sqlite.prepare(`PRAGMA table_info(sessions)`).all()
  const hasSettingsColumn = sessionColumns.some((col: unknown) => 
    typeof col === 'object' && col !== null && 'name' in col && (col as { name: string }).name === 'settings'
  )
  
  if (!hasSettingsColumn) {
    console.log('Migrating: Adding settings column to sessions table')
    sqlite.exec(`ALTER TABLE sessions ADD COLUMN settings TEXT`)
  }
  
  // Check if permission_requests table exists
  const tables = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='permission_requests'`).all()
  const hasPermissionRequestsTable = tables.length > 0
  
  if (!hasPermissionRequestsTable) {
    console.log('Migrating: Creating permission_requests table')
    sqlite.exec(`
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
      
      CREATE INDEX IF NOT EXISTS idx_permission_requests_session_id ON permission_requests(session_id);
      CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);
      CREATE INDEX IF NOT EXISTS idx_permission_requests_expires_at ON permission_requests(expires_at);
      CREATE INDEX IF NOT EXISTS idx_permission_requests_created_at ON permission_requests(created_at);
    `)
  }
  
  // Check if visible column exists in events table
  const eventsVisibleColumn = eventsColumns.some((col: unknown) => 
    typeof col === 'object' && col !== null && 'name' in col && (col as { name: string }).name === 'visible'
  )
  
  if (!eventsVisibleColumn) {
    console.log('Migrating: Adding visible column to events table')
    sqlite.exec(`ALTER TABLE events ADD COLUMN visible INTEGER DEFAULT 1`)
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