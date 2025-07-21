import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { sessions, events } from '../db/schema'

export type TestDatabase = {
  db: ReturnType<typeof drizzle>
  sqlite: Database.Database
  schema: typeof schema
  createSession: (input: Partial<typeof sessions.$inferInsert> & { project_path: string }) => typeof sessions.$inferInsert & { id: string }
  getSession: (sessionId: string) => typeof sessions.$inferSelect | null
  insertEvent: (event: typeof events.$inferInsert) => void
  getEventsForSession: (sessionId: string) => Array<typeof events.$inferSelect>
  getDb: () => ReturnType<typeof drizzle>
  cleanup: () => void
}

export function setupInMemoryDb(): TestDatabase {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })

  // Create tables
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
      memva_session_id TEXT
    )
  `)

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

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS permission_requests (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_use_id TEXT,
      input TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      decision TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `)

  // Create indexes
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_project_name ON events(project_name);
    CREATE INDEX IF NOT EXISTS idx_event_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_parent_uuid ON events(parent_uuid);
    CREATE INDEX IF NOT EXISTS idx_memva_session_id ON events(memva_session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_claude_status ON sessions(claude_status);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
    CREATE INDEX IF NOT EXISTS idx_jobs_priority_created ON jobs(priority DESC, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority DESC);
    CREATE INDEX IF NOT EXISTS idx_permission_requests_session_id ON permission_requests(session_id);
    CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);
    CREATE INDEX IF NOT EXISTS idx_permission_requests_expires_at ON permission_requests(expires_at);
    CREATE INDEX IF NOT EXISTS idx_permission_requests_created_at ON permission_requests(created_at);
  `)

  // Insert default settings
  sqlite.exec(`
    INSERT INTO settings (id, config, created_at, updated_at)
    VALUES ('singleton', '{"maxTurns": 200, "permissionMode": "acceptEdits"}', datetime('now'), datetime('now'))
  `)

  // Helper functions
  const createSession = (input: Partial<typeof sessions.$inferInsert> & { project_path: string }): typeof sessions.$inferSelect => {
    const session = {
      id: input.id || crypto.randomUUID(),
      title: input.title !== undefined ? input.title : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: input.status || 'active',
      project_path: input.project_path,
      metadata: input.metadata !== undefined ? input.metadata : null,
      claude_status: input.claude_status || 'not_started',
      settings: input.settings !== undefined ? input.settings : null
    }
    db.insert(sessions).values(session).run()
    return session as typeof sessions.$inferSelect
  }

  const insertEvent = (event: typeof events.$inferInsert) => {
    db.insert(events).values(event).run()
  }

  const getSession = (sessionId: string) => {
    return db.select().from(sessions).where(eq(sessions.id, sessionId)).get() || null
  }

  const getEventsForSession = (sessionId: string) => {
    return db.select().from(events).where(eq(events.memva_session_id, sessionId)).all()
  }

  const getDb = () => db

  const cleanup = () => {
    sqlite.close()
  }

  return {
    db,
    sqlite,
    schema,
    createSession,
    getSession,
    insertEvent,
    getEventsForSession,
    getDb,
    cleanup
  }
}
