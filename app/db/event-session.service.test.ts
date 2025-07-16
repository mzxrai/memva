import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent, createMockAssistantEvent } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { getRecentAssistantMessages } from './event-session.service'

describe('Event-Session Service', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('getRecentAssistantMessages', () => {
    it('should show preview of most recent assistant message', async () => {
      const session = testDb.createSession({
        project_path: '/test/project'
      })

      // Create an assistant event with meaningful content
      const assistantEvent = createMockEvent({
        session_id: 'test-session-id',
        memva_session_id: session.id,
        event_type: 'assistant',
        data: createMockAssistantEvent('Here is a helpful response to your question.')
      })
      testDb.insertEvent(assistantEvent)

      const messages = await getRecentAssistantMessages(session.id, 5)

      expect(messages).toHaveLength(1)
      expect(messages[0].event_type).toBe('assistant')
      expect(messages[0].data).toEqual(assistantEvent.data)
    })

    it('should extract meaningful content (skip system messages)', async () => {
      const session = testDb.createSession({
        project_path: '/test/project'
      })

      // Create system event (should be ignored)
      const systemEvent = createMockEvent({
        session_id: 'test-session-id',
        memva_session_id: session.id,
        event_type: 'system',
        data: { type: 'system', content: 'System message' }
      })
      testDb.insertEvent(systemEvent)

      // Create assistant event (should be included)
      const assistantEvent = createMockEvent({
        session_id: 'test-session-id',
        memva_session_id: session.id,
        event_type: 'assistant',
        data: createMockAssistantEvent('This is meaningful content.')
      })
      testDb.insertEvent(assistantEvent)

      const messages = await getRecentAssistantMessages(session.id, 5)

      expect(messages).toHaveLength(1)
      expect(messages[0].event_type).toBe('assistant')
    })

    it('should handle sessions with no assistant messages gracefully', async () => {
      const session = testDb.createSession({
        project_path: '/test/project'
      })

      // Create only user events
      const userEvent = createMockEvent({
        session_id: 'test-session-id',
        memva_session_id: session.id,
        event_type: 'user',
        data: { type: 'user', message: { content: [{ type: 'text', text: 'Hello' }] } }
      })
      testDb.insertEvent(userEvent)

      const messages = await getRecentAssistantMessages(session.id, 5)

      expect(messages).toHaveLength(0)
    })

    it('should limit results to specified number', async () => {
      const session = testDb.createSession({
        project_path: '/test/project'
      })

      // Create multiple assistant events
      for (let i = 0; i < 10; i++) {
        const assistantEvent = createMockEvent({
          session_id: 'test-session-id',
          memva_session_id: session.id,
          event_type: 'assistant',
          data: createMockAssistantEvent(`Response ${i}`)
        })
        testDb.insertEvent(assistantEvent)
      }

      const messages = await getRecentAssistantMessages(session.id, 3)

      expect(messages).toHaveLength(3)
    })

    it('should return messages in newest-first order', async () => {
      const session = testDb.createSession({
        project_path: '/test/project'
      })

      // Create assistant events at different times
      const firstEvent = createMockEvent({
        session_id: 'test-session-id',
        memva_session_id: session.id,
        event_type: 'assistant',
        data: createMockAssistantEvent('First response'),
        timestamp: '2023-01-01T00:00:00Z'
      })
      testDb.insertEvent(firstEvent)

      const secondEvent = createMockEvent({
        session_id: 'test-session-id',
        memva_session_id: session.id,
        event_type: 'assistant',
        data: createMockAssistantEvent('Second response'),
        timestamp: '2023-01-02T00:00:00Z'
      })
      testDb.insertEvent(secondEvent)

      const messages = await getRecentAssistantMessages(session.id, 5)

      expect(messages).toHaveLength(2)
      expect(messages[0].data).toEqual(secondEvent.data) // Most recent first
      expect(messages[1].data).toEqual(firstEvent.data)
    })
  })
})