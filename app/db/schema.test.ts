import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { eq, asc } from 'drizzle-orm'
import * as schema from './schema'

describe('Database Schema', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
  })

  afterEach(() => {
    testDb.cleanup()
  })

  it('should create events table with correct schema', () => {
    const tableInfo = testDb.sqlite.prepare("PRAGMA table_info(events)").all()
    
    const columnNames = tableInfo.map((col: unknown) => (col as { name: string }).name)
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
      }
    }

    // Insert using Drizzle
    testDb.db.insert(schema.events).values(testEvent).run()

    // Query using Drizzle
    const results = testDb.db.select().from(schema.events).where(eq(schema.events.uuid, testEvent.uuid)).all()
    
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
      }
    }

    testDb.db.insert(schema.events).values(assistantEvent).run()

    const results = testDb.db.select().from(schema.events).where(eq(schema.events.uuid, assistantEvent.uuid)).all()
    const result = results[0]
    
    expect(result.event_type).toBe('assistant')
    expect(result.parent_uuid).toBe('test-uuid-123')
    
    const data = result.data as {
      type: string;
      message: {
        role: string;
        content: Array<{
          type: string;
          id: string;
          name: string;
          input: Record<string, unknown>;
        }>;
      };
    }
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

    const eventsToInsert = eventData.map((event) => ({
      uuid: event.uuid,
      session_id: sessionId,
      event_type: 'user' as const,
      timestamp: event.timestamp,
      is_sidechain: false,
      parent_uuid: null,
      cwd: '/test',
      project_name: 'test',
      data: { type: 'user' }
    }))

    eventsToInsert.forEach(event => {
      testDb.db.insert(schema.events).values(event).run()
    })

    const results = testDb.db.select()
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
      }
    }

    testDb.db.insert(schema.events).values(sidechainEvent).run()

    const results = testDb.db.select().from(schema.events).where(eq(schema.events.uuid, sidechainEvent.uuid)).all()
    const result = results[0]
    
    expect(result.is_sidechain).toBe(true)
    expect(result.parent_uuid).toBeNull()
  })
})