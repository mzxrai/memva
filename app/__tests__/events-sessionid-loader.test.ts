import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { loader } from '../routes/events.$sessionId'

describe('Events SessionId Loader Integration Tests', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should load events for a specific session ordered by timestamp', async () => {
    // Create test events with different timestamps
    const event1 = createMockEvent({
      session_id: 'session-123',
      event_type: 'user',
      timestamp: '2025-01-01T10:00:00.000Z',
      data: { type: 'user', content: 'Hello' }
    })
    
    const event2 = createMockEvent({
      session_id: 'session-123',
      event_type: 'assistant',
      timestamp: '2025-01-01T10:05:00.000Z',
      data: { type: 'assistant', content: 'Hi there!' }
    })
    
    const event3 = createMockEvent({
      session_id: 'session-123',
      event_type: 'system',
      timestamp: '2025-01-01T10:01:00.000Z',
      data: { type: 'system', content: 'System message' }
    })

    // Insert events in non-chronological order using helper method
    testDb.insertEvent(event2)
    testDb.insertEvent(event1)
    testDb.insertEvent(event3)

    // Test loader functionality
    const result = await loader({ params: { sessionId: 'session-123' } } as any)
    
    expect(result.sessionId).toBe('session-123')
    expect(result.sessionEvents).toHaveLength(3)
    
    // Should be ordered by timestamp (event1, event3, event2)
    expect(result.sessionEvents[0].timestamp).toBe('2025-01-01T10:00:00.000Z')
    expect(result.sessionEvents[1].timestamp).toBe('2025-01-01T10:01:00.000Z')
    expect(result.sessionEvents[2].timestamp).toBe('2025-01-01T10:05:00.000Z')
  })

  it('should return empty array for non-existent session', async () => {
    const result = await loader({ params: { sessionId: 'non-existent' } } as any)
    
    expect(result.sessionId).toBe('non-existent')
    expect(result.sessionEvents).toEqual([])
  })

  it('should filter events by correct session_id', async () => {
    // Create events for different sessions
    const session1Event = createMockEvent({
      session_id: 'session-123',
      event_type: 'user',
      data: { type: 'user', content: 'Session 1 message' }
    })
    
    const session2Event = createMockEvent({
      session_id: 'session-456',
      event_type: 'user',
      data: { type: 'user', content: 'Session 2 message' }
    })

    testDb.insertEvent(session1Event)
    testDb.insertEvent(session2Event)

    const result = await loader({ params: { sessionId: 'session-123' } } as any)
    
    expect(result.sessionEvents).toHaveLength(1)
    expect(result.sessionEvents[0].session_id).toBe('session-123')
    expect(result.sessionEvents[0].data).toEqual({ type: 'user', content: 'Session 1 message' })
  })

  it('should handle complex event data structures', async () => {
    const complexEvent = createMockEvent({
      session_id: 'session-123',
      event_type: 'assistant',
      is_sidechain: true,
      parent_uuid: 'parent-123',
      data: {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: 'tool-123',
            name: 'Read',
            input: { file_path: '/test.ts' }
          }]
        }
      }
    })

    testDb.insertEvent(complexEvent)

    const result = await loader({ params: { sessionId: 'session-123' } } as any)
    
    expect(result.sessionEvents).toHaveLength(1)
    expect(result.sessionEvents[0].is_sidechain).toBe(true)
    expect(result.sessionEvents[0].parent_uuid).toBe('parent-123')
    expect(result.sessionEvents[0].data).toEqual({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'tool-123',
          name: 'Read',
          input: { file_path: '/test.ts' }
        }]
      }
    })
  })
})