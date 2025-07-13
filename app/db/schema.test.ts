import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, asc } from 'drizzle-orm'
import * as schema from './schema'

describe('Database Schema', () => {
  let db: ReturnType<typeof drizzle>
  let sqlite: Database.Database

  beforeEach(() => {
    // Use in-memory database for tests
    sqlite = new Database(':memory:')
    db = drizzle(sqlite, { schema })
    
    // Create tables using raw SQL for now (will use migrations later)
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
        file_path TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        memva_session_id TEXT
      )
    `)
    
    // Create indexes
    sqlite.exec(`
      CREATE INDEX idx_session_id ON events(session_id);
      CREATE INDEX idx_timestamp ON events(timestamp);
      CREATE INDEX idx_project_name ON events(project_name);
      CREATE INDEX idx_event_type ON events(event_type);
      CREATE INDEX idx_parent_uuid ON events(parent_uuid);
    `)
  })

  afterEach(() => {
    sqlite.close()
  })

  it('should create events table with correct schema', () => {
    const tableInfo = sqlite.prepare("PRAGMA table_info(events)").all()
    
    const columnNames = tableInfo.map((col: any) => col.name)
    expect(columnNames).toEqual([
      'uuid',
      'session_id',
      'event_type',
      'timestamp',
      'is_sidechain',
      'parent_uuid',
      'cwd',
      'project_name',
      'data',
      'file_path',
      'line_number',
      'synced_at',
      'memva_session_id'
    ])
  })

  it('should store and retrieve event with JSON data', () => {
    const testEvent = {
      uuid: 'test-uuid-123',
      session_id: 'session-123',
      event_type: 'user' as const,
      timestamp: '2025-07-13T20:00:00.000Z',
      is_sidechain: false,
      parent_uuid: null,
      cwd: '/Users/test/project',
      project_name: 'project',
      data: {
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] }
      },
      file_path: '~/.claude/projects/test/session.jsonl',
      line_number: 1
    }

    // Insert using Drizzle
    db.insert(schema.events).values(testEvent).run()

    // Query using Drizzle
    const results = db.select().from(schema.events).where(eq(schema.events.uuid, testEvent.uuid)).all()
    
    expect(results).toHaveLength(1)
    const result = results[0]
    
    expect(result).toBeDefined()
    expect(result.uuid).toBe(testEvent.uuid)
    expect(result.event_type).toBe('user')
    expect(result.data).toEqual(testEvent.data)
  })

  it('should handle assistant events with tool use', () => {
    const assistantEvent = {
      uuid: 'assistant-123',
      session_id: 'session-123',
      event_type: 'assistant' as const,
      timestamp: '2025-07-13T20:00:01.000Z',
      is_sidechain: false,
      parent_uuid: 'test-uuid-123',
      cwd: '/Users/test/project',
      project_name: 'project',
      data: {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: 'toolu_123',
            name: 'Read',
            input: { file_path: '/test.ts' }
          }]
        }
      },
      file_path: '~/.claude/projects/test/session.jsonl',
      line_number: 2
    }

    db.insert(schema.events).values(assistantEvent).run()

    const results = db.select().from(schema.events).where(eq(schema.events.uuid, assistantEvent.uuid)).all()
    const result = results[0]
    
    expect(result.event_type).toBe('assistant')
    expect(result.parent_uuid).toBe('test-uuid-123')
    
    const data = result.data as any
    expect(data.message.content[0].type).toBe('tool_use')
    expect(data.message.content[0].name).toBe('Read')
  })

  it('should query events by session_id efficiently', () => {
    // Insert multiple events
    const sessionId = 'session-456'
    const eventData = [
      { uuid: 'e1', timestamp: '2025-07-13T20:00:00.000Z' },
      { uuid: 'e2', timestamp: '2025-07-13T20:00:01.000Z' },
      { uuid: 'e3', timestamp: '2025-07-13T20:00:02.000Z' }
    ]

    const eventsToInsert = eventData.map((event, index) => ({
      uuid: event.uuid,
      session_id: sessionId,
      event_type: 'user' as const,
      timestamp: event.timestamp,
      is_sidechain: false,
      parent_uuid: null,
      cwd: '/test',
      project_name: 'test',
      data: { type: 'user' },
      file_path: 'test.jsonl',
      line_number: index + 1
    }))

    eventsToInsert.forEach(event => {
      db.insert(schema.events).values(event).run()
    })

    const results = db.select()
      .from(schema.events)
      .where(eq(schema.events.session_id, sessionId))
      .orderBy(asc(schema.events.timestamp))
      .all()
    
    expect(results).toHaveLength(3)
    expect(results[0].uuid).toBe('e1')
    expect(results[2].uuid).toBe('e3')
  })

  it('should support sidechain events', () => {
    const sidechainEvent = {
      uuid: 'sidechain-123',
      session_id: 'session-123',
      event_type: 'user' as const,
      timestamp: '2025-07-13T20:00:00.000Z',
      is_sidechain: true,
      parent_uuid: null, // Sidechains start new threads
      cwd: '/Users/test/project',
      project_name: 'project',
      data: {
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: 'Research task' }] }
      },
      file_path: '~/.claude/projects/test/session.jsonl',
      line_number: 10
    }

    db.insert(schema.events).values(sidechainEvent).run()

    const results = db.select().from(schema.events).where(eq(schema.events.uuid, sidechainEvent.uuid)).all()
    const result = results[0]
    
    expect(result.is_sidechain).toBe(true)
    expect(result.parent_uuid).toBeNull()
  })
})