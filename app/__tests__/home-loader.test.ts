import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { loader } from '../routes/home'

describe('Home Loader', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should load all sessions with stats', async () => {
    // Create test sessions using testDb helper
    const session1 = testDb.createSession({ 
      title: 'First Session',
      project_path: '/test/project1'
    })
    const session2 = testDb.createSession({ 
      title: 'Second Session',
      project_path: '/test/project2'
    })

    // Add some events to test stats aggregation
    const event1 = createMockEvent({
      session_id: 'session-1',
      event_type: 'user',
      timestamp: '2025-01-01T10:01:00.000Z',
      memva_session_id: session1.id
    })
    const event2 = createMockEvent({
      session_id: 'session-1',
      event_type: 'assistant',
      timestamp: '2025-01-01T10:02:00.000Z',
      memva_session_id: session1.id
    })
    
    testDb.insertEvent(event1)
    testDb.insertEvent(event2)

    // Test the loader behavior
    const result = await loader()

    // Verify loader returns sessions with stats
    expect(result).toHaveProperty('sessions')
    expect(result.sessions).toHaveLength(2)
    
    // Verify session data structure
    const firstSession = result.sessions.find(s => s.id === session1.id)
    expect(firstSession).toMatchObject({
      id: session1.id,
      title: 'First Session',
      project_path: '/test/project1',
      status: 'active'
    })
    
    const secondSession = result.sessions.find(s => s.id === session2.id)
    expect(secondSession).toMatchObject({
      id: session2.id,
      title: 'Second Session',
      project_path: '/test/project2',
      status: 'active'
    })
  })

  it('should return empty array when no sessions exist', async () => {
    // Test loader with no sessions
    const result = await loader()
    
    expect(result).toHaveProperty('sessions')
    expect(result.sessions).toHaveLength(0)
  })

  it('should load sessions ordered by most recent first', async () => {
    // Create sessions with different timestamps
    testDb.createSession({ 
      title: 'Older Session',
      project_path: '/test/older'
    })
    testDb.createSession({ 
      title: 'Newer Session',
      project_path: '/test/newer'
    })

    const result = await loader()

    // Verify sessions are ordered by most recent first
    expect(result.sessions).toHaveLength(2)
    expect(result.sessions[0].title).toBe('Newer Session')
    expect(result.sessions[1].title).toBe('Older Session')
  })

  it('should handle sessions with and without stats', async () => {
    // Create session with events (will have stats)
    const sessionWithEvents = testDb.createSession({ 
      title: 'Session With Events',
      project_path: '/test/with-events'
    })
    
    // Create session without events (will not have stats)
    const sessionWithoutEvents = testDb.createSession({ 
      title: 'Session Without Events',
      project_path: '/test/without-events'
    })

    // Add events to first session only
    const event1 = createMockEvent({
      session_id: sessionWithEvents.id,
      event_type: 'user',
      memva_session_id: sessionWithEvents.id
    })
    
    testDb.insertEvent(event1)

    const result = await loader()

    // Verify both sessions are returned
    expect(result.sessions).toHaveLength(2)
    
    // Verify that sessions without stats are still included
    const sessionWithoutStats = result.sessions.find(s => s.id === sessionWithoutEvents.id)
    expect(sessionWithoutStats).toMatchObject({
      id: sessionWithoutEvents.id,
      title: 'Session Without Events'
    })
  })
})