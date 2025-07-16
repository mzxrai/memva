import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockSession } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Sessions Claude Status Schema', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should add claude_status column to sessions table', () => {
    // First test - should fail because claude_status column doesn't exist yet
    const session = createMockSession({ title: 'Test Session' })
    
    // This should work with claude_status column
    const sessionWithStatus = testDb.createSession({ ...session, claude_status: 'not_started' })
    
    expect(sessionWithStatus.claude_status).toBe('not_started')
  })

  it('should support status values (not_started, processing, waiting_for_input, error, completed)', () => {
    const statusValues = ['not_started', 'processing', 'waiting_for_input', 'error', 'completed']
    
    statusValues.forEach(status => {
      const session = testDb.createSession({ 
        title: `Test ${status}`,
        project_path: '/test',
        claude_status: status
      })
      
      expect(session.claude_status).toBe(status)
    })
  })

  it('should default to not_started for new sessions', () => {
    const session = testDb.createSession({ 
      title: 'Default Status Session',
      project_path: '/test'
    })
    
    expect(session.claude_status).toBe('not_started')
  })

  it('should update status through job lifecycle', async () => {
    const session = testDb.createSession({ 
      title: 'Status Update Session',
      project_path: '/test'
    })
    
    expect(session.claude_status).toBe('not_started')
    
    // Test status update functionality
    const { sessions } = await import('../db/schema')
    const { eq } = await import('drizzle-orm')
    
    // Update to processing
    testDb.db.update(sessions)
      .set({ claude_status: 'processing' })
      .where(eq(sessions.id, session.id))
      .run()
    
    // Verify update
    const updatedSession = testDb.db.select().from(sessions).where(eq(sessions.id, session.id)).get()
    expect(updatedSession?.claude_status).toBe('processing')
    
    // Update to completed
    testDb.db.update(sessions)
      .set({ claude_status: 'completed' })
      .where(eq(sessions.id, session.id))
      .run()
    
    const finalSession = testDb.db.select().from(sessions).where(eq(sessions.id, session.id)).get()
    expect(finalSession?.claude_status).toBe('completed')
  })
})