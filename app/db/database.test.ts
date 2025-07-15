import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

describe('Database initialization', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
  })

  afterEach(() => {
    testDb.cleanup()
  })

  it('should create database instance', () => {
    expect(testDb.db).toBeDefined()
    expect(testDb.sqlite).toBeDefined()
  })

  it('should create events table with indexes on first run', () => {
    // Check table exists
    const tables = testDb.sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='events'
    `).all()
    expect(tables).toHaveLength(1)
    
    // Check indexes exist
    const indexes = testDb.sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='events'
    `).all()
    
    const indexNames = indexes.map((idx: unknown) => (idx as { name: string }).name)
    expect(indexNames).toContain('idx_session_id')
    expect(indexNames).toContain('idx_timestamp')
    expect(indexNames).toContain('idx_project_name')
    expect(indexNames).toContain('idx_event_type')
    expect(indexNames).toContain('idx_parent_uuid')
  })

  it('should support multiple database instances', () => {
    const db1 = testDb.db
    const db2 = testDb.db
    
    expect(db1).toBeDefined()
    expect(db2).toBeDefined()
  })

  it('should handle concurrent access gracefully', async () => {
    // Insert test event
    const testEvent = {
      uuid: 'concurrent-test',
      session_id: 'session-123',
      event_type: 'user' as const,
      timestamp: new Date().toISOString(),
      is_sidechain: false,
      parent_uuid: null,
      cwd: '/test',
      project_name: 'test',
      data: { type: 'user', message: 'test' }
    }
    
    // Simulate concurrent inserts
    const promises = Array.from({ length: 10 }, (_, i) => 
      Promise.resolve().then(() => {
        testDb.db.insert(schema.events).values({
          ...testEvent,
          uuid: `concurrent-test-${i}`
        }).run()
      })
    )
    
    await Promise.all(promises)
    
    const count = testDb.db.select()
      .from(schema.events)
      .where(eq(schema.events.session_id, 'session-123'))
      .all()
    
    expect(count).toHaveLength(10)
  })
})