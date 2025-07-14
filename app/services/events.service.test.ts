import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEventFromMessage, storeEvent } from './events.service'
import type { SDKMessage } from '@anthropic-ai/claude-code'
import type { NewEvent } from '../db/schema'

// Mock the database
vi.mock('../db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    execute: vi.fn()
  },
  events: {}
}))

describe('Events Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createEventFromMessage', () => {
    it('should convert user SDKMessage to NewEvent', () => {
      const message: SDKMessage = {
        type: 'user',
        content: 'Help me implement a feature',
        timestamp: '2025-07-14T10:00:00.000Z'
      }

      const sessionId = 'claude-session-123'
      const memvaSessionId = 'memva-session-456'
      const projectPath = '/Users/test/project'

      const event = createEventFromMessage({
        message,
        sessionId,
        memvaSessionId,
        projectPath,
        parentUuid: null
      })

      expect(event).toMatchObject({
        event_type: 'user',
        session_id: sessionId,
        memva_session_id: memvaSessionId,
        timestamp: message.timestamp,
        cwd: projectPath,
        project_name: 'project',
        is_sidechain: false,
        parent_uuid: null,
        data: {
          type: 'user',
          content: 'Help me implement a feature',
          timestamp: '2025-07-14T10:00:00.000Z'
        }
      })
      expect(event.uuid).toBeDefined()
      expect(event.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('should convert assistant SDKMessage to NewEvent', () => {
      const message: SDKMessage = {
        type: 'assistant',
        content: 'I can help you with that',
        timestamp: '2025-07-14T10:00:01.000Z'
      }

      const sessionId = 'claude-session-123'
      const memvaSessionId = 'memva-session-456'
      const projectPath = '/Users/test/project'
      const parentUuid = 'parent-uuid-789'

      const event = createEventFromMessage({
        message,
        sessionId,
        memvaSessionId,
        projectPath,
        parentUuid
      })

      expect(event).toMatchObject({
        event_type: 'assistant',
        session_id: sessionId,
        memva_session_id: memvaSessionId,
        timestamp: message.timestamp,
        cwd: projectPath,
        project_name: 'project',
        is_sidechain: false,
        parent_uuid: parentUuid,
        data: message
      })
    })

    it('should handle thinking messages', () => {
      const message: SDKMessage = {
        type: 'thinking',
        content: 'Analyzing the request...',
        timestamp: '2025-07-14T10:00:02.000Z'
      }

      const event = createEventFromMessage({
        message,
        sessionId: 'claude-session-123',
        memvaSessionId: 'memva-session-456',
        projectPath: '/Users/test/project',
        parentUuid: 'parent-uuid-789'
      })

      expect(event.event_type).toBe('thinking')
    })

    it('should handle tool_use messages', () => {
      const message: SDKMessage = {
        type: 'tool_use',
        content: JSON.stringify({
          name: 'Read',
          input: { file_path: '/path/to/file.ts' }
        }),
        timestamp: '2025-07-14T10:00:03.000Z'
      }

      const event = createEventFromMessage({
        message,
        sessionId: 'claude-session-123',
        memvaSessionId: 'memva-session-456',
        projectPath: '/Users/test/project',
        parentUuid: 'parent-uuid-789'
      })

      expect(event.event_type).toBe('tool_use')
    })

    it('should extract project name from path', () => {
      const testCases = [
        { path: '/Users/test/my-project', expected: 'my-project' },
        { path: '/home/user/code/awesome-app', expected: 'awesome-app' },
        { path: '/projects/work/client-site', expected: 'client-site' },
        { path: '/', expected: 'root' },
        { path: '/single', expected: 'single' }
      ]

      for (const { path, expected } of testCases) {
        const event = createEventFromMessage({
          message: { type: 'user', content: 'test', timestamp: '2025-07-14T10:00:00.000Z' },
          sessionId: 'session-123',
          memvaSessionId: 'memva-456',
          projectPath: path,
          parentUuid: null
        })

        expect(event.project_name).toBe(expected)
      }
    })
  })

  describe('storeEvent', () => {
    it('should store event in database', async () => {
      const { db, events } = await import('../db')
      
      const newEvent: NewEvent = {
        uuid: 'test-uuid-123',
        session_id: 'claude-session-123',
        event_type: 'user',
        timestamp: '2025-07-14T10:00:00.000Z',
        is_sidechain: false,
        parent_uuid: null,
        cwd: '/Users/test/project',
        project_name: 'project',
        data: { type: 'user', content: 'Hello' },
        memva_session_id: 'memva-session-456'
      }

      await storeEvent(newEvent)

      expect(db.insert).toHaveBeenCalledWith(events)
      expect(vi.mocked(db.insert).mock.results[0].value.values).toHaveBeenCalledWith(newEvent)
      expect(vi.mocked(db.insert).mock.results[0].value.execute).toHaveBeenCalled()
    })
  })
})