import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync } from 'fs'
import { getDatabase, closeDatabase, resetDatabase } from './database'

describe('Database initialization', () => {
  const testDbPath = './test-memva.db'

  beforeEach(() => {
    // Reset database singleton and clean up any existing test database
    resetDatabase()
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath)
    }
  })

  afterEach(() => {
    resetDatabase()
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath)
    }
  })

  it('should create database file if it does not exist', () => {
    const db = getDatabase(testDbPath)
    
    expect(existsSync(testDbPath)).toBe(true)
    expect(db).toBeDefined()
  })

  it('should create events table with indexes on first run', () => {
    const db = getDatabase(testDbPath)
    
    // Check table exists
    const tables = db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='events'
    `)
    expect(tables).toHaveLength(1)
    
    // Check indexes exist
    const indexes = db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='events'
    `)
    
    const indexNames = indexes.map((idx: any) => idx.name)
    expect(indexNames).toContain('idx_session_id')
    expect(indexNames).toContain('idx_timestamp')
    expect(indexNames).toContain('idx_project_name')
    expect(indexNames).toContain('idx_event_type')
    expect(indexNames).toContain('idx_parent_uuid')
  })

  it('should reuse existing database on subsequent calls', () => {
    const db1 = getDatabase(testDbPath)
    const db2 = getDatabase(testDbPath)
    
    expect(db1).toBe(db2) // Same instance
  })

  it('should handle concurrent access gracefully', async () => {
    const db = getDatabase(testDbPath)
    
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
        db.insert(schema.events).values({
          ...testEvent,
          uuid: `concurrent-test-${i}`
        }).run()
      })
    )
    
    await Promise.all(promises)
    
    const count = db.select()
      .from(schema.events)
      .where(eq(schema.events.session_id, 'session-123'))
      .all()
    
    expect(count).toHaveLength(10)
  })
})

// Import schema and eq for the concurrent test
import * as schema from './schema'
import { eq } from 'drizzle-orm'