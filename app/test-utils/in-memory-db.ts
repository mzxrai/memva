import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { sessions, events } from '../db/schema'

export type TestDatabase = {
  db: ReturnType<typeof drizzle>
  sqlite: Database.Database
  createSession: (input: { title?: string; project_path: string }) => typeof sessions.$inferInsert & { id: string }
  insertEvent: (event: typeof events.$inferInsert) => void
  getEventsForSession: (sessionId: string) => Array<typeof events.$inferSelect>
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
      metadata TEXT
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
  `)
  
  // Helper functions
  const createSession = (input: { title?: string; project_path: string }) => {
    const session = {
      id: crypto.randomUUID(),
      title: input.title || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      project_path: input.project_path,
      metadata: null
    }
    db.insert(sessions).values(session).run()
    return session
  }

  const insertEvent = (event: typeof events.$inferInsert) => {
    db.insert(events).values(event).run()
  }

  const getEventsForSession = (sessionId: string) => {
    return db.select().from(events).where(eq(events.memva_session_id, sessionId)).all()
  }

  const cleanup = () => {
    sqlite.close()
  }

  return {
    db,
    sqlite,
    createSession,
    insertEvent,
    getEventsForSession,
    cleanup
  }
}

