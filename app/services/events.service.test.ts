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
        message: { content: 'Help me implement a feature', role: 'user' },
        parent_tool_use_id: null,
        session_id: 'claude-session-123'
      }

      const memvaSessionId = 'memva-session-456'
      const projectPath = '/Users/test/project'

      const event = createEventFromMessage({
        message,
        memvaSessionId,
        projectPath,
        parentUuid: null
      })

      expect(event).toMatchObject({
        event_type: 'user',
        session_id: 'claude-session-123',
        memva_session_id: memvaSessionId,
        cwd: projectPath,
        project_name: 'project',
        is_sidechain: false,
        parent_uuid: null,
        data: message
      })
      expect(event.uuid).toBeDefined()
      expect(event.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('should convert assistant SDKMessage to NewEvent', () => {
      const message: SDKMessage = {
        type: 'assistant',
        message: { content: 'I can help you with that', role: 'assistant' },
        parent_tool_use_id: null,
        session_id: 'claude-session-456'
      }

      const memvaSessionId = 'memva-session-789'
      const projectPath = '/Users/test/project'
      const parentUuid = 'parent-uuid-789'

      const event = createEventFromMessage({
        message,
        memvaSessionId,
        projectPath,
        parentUuid
      })

      expect(event).toMatchObject({
        event_type: 'assistant',
        session_id: 'claude-session-456',
        memva_session_id: memvaSessionId,
        cwd: projectPath,
        project_name: 'project',
        is_sidechain: false,
        parent_uuid: parentUuid,
        data: message
      })
    })

    it('should handle result messages', () => {
      const message: SDKMessage = {
        type: 'result',
        subtype: 'success',
        duration_ms: 1000,
        duration_api_ms: 900,
        is_error: false,
        num_turns: 1,
        result: 'Done',
        session_id: 'claude-session-result',
        total_cost_usd: 0.01,
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 50
        }
      }

      const event = createEventFromMessage({
        message,
        memvaSessionId: 'memva-session-456',
        projectPath: '/Users/test/project',
        parentUuid: 'parent-uuid-789'
      })

      expect(event.event_type).toBe('result')
      expect(event.session_id).toBe('claude-session-result')
    })

    it('should handle system messages', () => {
      const message: SDKMessage = {
        type: 'system',
        subtype: 'init',
        apiKeySource: 'user',
        cwd: '/Users/test/project',
        session_id: 'claude-session-system',
        tools: ['Read', 'Write'],
        mcp_servers: [],
        model: 'claude-3',
        permissionMode: 'default'
      }

      const event = createEventFromMessage({
        message,
        memvaSessionId: 'memva-session-456',
        projectPath: '/Users/test/project',
        parentUuid: null
      })

      expect(event.event_type).toBe('system')
      expect(event.session_id).toBe('claude-session-system')
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
        const message: SDKMessage = {
          type: 'user',
          message: { content: 'test', role: 'user' },
          parent_tool_use_id: null,
          session_id: 'test-session'
        }

        const event = createEventFromMessage({
          message,
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