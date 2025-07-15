import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { loader } from '../routes/events'

describe('Events Loader', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should load events and group by session', async () => {
    // Create test data using factories
    const session1Event1 = createMockEvent({ 
      session_id: 'session-1', 
      event_type: 'user', 
      timestamp: '2025-01-01T00:00:00.000Z',
      project_name: 'test-project' 
    })
    const session1Event2 = createMockEvent({ 
      session_id: 'session-1', 
      event_type: 'assistant', 
      timestamp: '2025-01-01T00:00:01.000Z',
      project_name: 'test-project' 
    })
    const session2Event1 = createMockEvent({ 
      session_id: 'session-2', 
      event_type: 'user', 
      timestamp: '2025-01-01T00:01:00.000Z',
      project_name: 'other-project' 
    })

    // Insert events using testDb helper
    testDb.insertEvent(session1Event1)
    testDb.insertEvent(session1Event2)
    testDb.insertEvent(session2Event1)

    // Test the loader behavior
    const result = await loader()
    
    // Verify data is correctly grouped by session
    expect(result.eventsBySession).toBeDefined()
    expect(Object.keys(result.eventsBySession)).toHaveLength(2)
    
    // Verify session-1 has 2 events (ordered by timestamp descending)
    expect(result.eventsBySession['session-1']).toHaveLength(2)
    expect(result.eventsBySession['session-1'][0].event_type).toBe('assistant')
    expect(result.eventsBySession['session-1'][1].event_type).toBe('user')
    
    // Verify session-2 has 1 event
    expect(result.eventsBySession['session-2']).toHaveLength(1)
    expect(result.eventsBySession['session-2'][0].event_type).toBe('user')
  })

  it('should return empty object when no events exist', async () => {
    const result = await loader()
    
    expect(result.eventsBySession).toEqual({})
  })

  it('should limit results to 500 events', async () => {
    // Create 600 events to test the limit
    const events = Array.from({ length: 600 }, (_, i) => 
      createMockEvent({ 
        session_id: `session-${Math.floor(i / 10)}`,
        timestamp: new Date(2025, 0, 1, 0, 0, i).toISOString(),
        project_name: 'test-project'
      })
    )
    
    // Insert all events
    events.forEach(event => testDb.insertEvent(event))
    
    const result = await loader()
    
    // Count total events across all sessions
    const totalEvents = Object.values(result.eventsBySession).flat().length
    expect(totalEvents).toBeLessThanOrEqual(500)
  })

  it('should order events by most recent timestamp', async () => {
    // Create events with different timestamps
    const olderEvent = createMockEvent({ 
      session_id: 'session-1', 
      timestamp: '2025-01-01T00:00:00.000Z',
      project_name: 'test-project' 
    })
    const newerEvent = createMockEvent({ 
      session_id: 'session-1', 
      timestamp: '2025-01-01T00:01:00.000Z',
      project_name: 'test-project' 
    })
    
    // Insert in reverse chronological order
    testDb.insertEvent(olderEvent)
    testDb.insertEvent(newerEvent)
    
    const result = await loader()
    
    // Verify events are ordered by most recent first
    const sessionEvents = result.eventsBySession['session-1']
    expect(sessionEvents).toHaveLength(2)
    expect(sessionEvents[0].timestamp).toBe(newerEvent.timestamp)
    expect(sessionEvents[1].timestamp).toBe(olderEvent.timestamp)
  })
})