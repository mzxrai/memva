import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { getRecentEvents, getEventsForClaudeSession, groupEventsBySession } from './events.service'

describe('Events Service', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('getRecentEvents', () => {
    it('should return recent events limited by count', async () => {
      const session = testDb.createSession({ project_path: '/test' })
      
      // Create 3 events
      const event1 = createMockEvent({
        memva_session_id: session.id,
        timestamp: '2025-07-16T10:00:00Z'
      })
      const event2 = createMockEvent({
        memva_session_id: session.id,
        timestamp: '2025-07-16T10:01:00Z'
      })
      const event3 = createMockEvent({
        memva_session_id: session.id,
        timestamp: '2025-07-16T10:02:00Z'
      })

      testDb.insertEvent(event1)
      testDb.insertEvent(event2)
      testDb.insertEvent(event3)

      const events = await getRecentEvents(2)

      expect(events).toHaveLength(2)
      // Should be ordered by timestamp desc (newest first)
      expect(events[0].timestamp).toBe('2025-07-16T10:02:00Z')
      expect(events[1].timestamp).toBe('2025-07-16T10:01:00Z')
    })

    it('should return empty array when no events exist', async () => {
      const events = await getRecentEvents(10)
      expect(events).toEqual([])
    })
  })

  describe('getEventsForClaudeSession', () => {
    it('should return events for specific Claude session ordered by timestamp ascending', async () => {
      const session = testDb.createSession({ project_path: '/test' })
      
      // Create events for different Claude sessions with different timestamps
      const event1 = createMockEvent({
        session_id: 'claude-session-1',
        memva_session_id: session.id,
        timestamp: '2025-07-16T10:00:00Z'
      })
      const event2 = createMockEvent({
        session_id: 'claude-session-1',
        memva_session_id: session.id,
        timestamp: '2025-07-16T10:02:00Z'
      })
      const event3 = createMockEvent({
        session_id: 'claude-session-2',
        memva_session_id: session.id,
        timestamp: '2025-07-16T10:01:00Z'
      })

      testDb.insertEvent(event2) // Insert in non-chronological order
      testDb.insertEvent(event1)
      testDb.insertEvent(event3)

      const events = await getEventsForClaudeSession('claude-session-1')

      expect(events).toHaveLength(2)
      expect(events[0].session_id).toBe('claude-session-1')
      expect(events[1].session_id).toBe('claude-session-1')
      // Should be ordered by timestamp ascending (oldest first)
      expect(events[0].timestamp).toBe('2025-07-16T10:00:00Z')
      expect(events[1].timestamp).toBe('2025-07-16T10:02:00Z')
    })

    it('should return empty array for non-existent Claude session', async () => {
      const events = await getEventsForClaudeSession('non-existent-session')
      expect(events).toEqual([])
    })
  })

  describe('groupEventsBySession', () => {
    it('should group events by session_id', async () => {
      const session = testDb.createSession({ project_path: '/test' })
      
      const event1 = createMockEvent({
        session_id: 'claude-session-1',
        memva_session_id: session.id
      })
      const event2 = createMockEvent({
        session_id: 'claude-session-1',
        memva_session_id: session.id
      })
      const event3 = createMockEvent({
        session_id: 'claude-session-2',
        memva_session_id: session.id
      })

      const events = [event1, event2, event3]
      const grouped = await groupEventsBySession(events)

      expect(grouped).toHaveProperty('claude-session-1')
      expect(grouped).toHaveProperty('claude-session-2')
      expect(grouped['claude-session-1']).toHaveLength(2)
      expect(grouped['claude-session-2']).toHaveLength(1)
    })

    it('should return empty object for empty events array', async () => {
      const grouped = await groupEventsBySession([])
      expect(grouped).toEqual({})
    })
  })
})