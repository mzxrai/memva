import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { 
  updateSessionClaudeStatus, 
  getLatestClaudeSessionId,
  createSession,
  updateSessionSettings,
  getSessionSettings,
  type CreateSessionInput
} from './sessions.service'
import { events } from './schema'
import { getSettings as getGlobalSettings } from './settings.service'

describe('Sessions Service', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('updateSessionClaudeStatus', () => {
    it('should update claude_status for existing session', async () => {
      const session = testDb.createSession({
        project_path: '/test/project',
        claude_status: 'not_started'
      })

      await updateSessionClaudeStatus(session.id, 'processing')

      const updatedSession = testDb.getSession(session.id)
      expect(updatedSession?.claude_status).toBe('processing')
    })

    it('should throw error for non-existent session', async () => {
      await expect(updateSessionClaudeStatus('non-existent-id', 'processing'))
        .rejects
        .toThrow('Session not found')
    })

    it('should update updated_at timestamp', async () => {
      const session = testDb.createSession({
        project_path: '/test/project',
        claude_status: 'not_started'
      })

      const originalUpdatedAt = session.updated_at
      
      // Wait a moment to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 1))
      
      await updateSessionClaudeStatus(session.id, 'processing')

      const updatedSession = testDb.getSession(session.id)
      expect(updatedSession?.updated_at).not.toBe(originalUpdatedAt)
    })

    it('should handle different claude_status values', async () => {
      const session = testDb.createSession({
        project_path: '/test/project',
        claude_status: 'not_started'
      })

      const statusValues = ['not_started', 'processing', 'completed', 'error']
      
      for (const status of statusValues) {
        await updateSessionClaudeStatus(session.id, status)
        
        const updatedSession = testDb.getSession(session.id)
        expect(updatedSession?.claude_status).toBe(status)
      }
    })
  })

  describe('getLatestClaudeSessionId', () => {
    it('should return null when no events exist', async () => {
      const session = testDb.createSession({
        project_path: '/test/project'
      })

      const result = await getLatestClaudeSessionId(session.id)
      expect(result).toBeNull()
    })

    it('should return the latest non-empty session_id', async () => {
      const session = testDb.createSession({
        project_path: '/test/project'
      })

      // Insert events with various session_ids
      testDb.db.insert(events).values([
        {
          uuid: 'event-1',
          session_id: 'claude-session-1',
          event_type: 'system',
          timestamp: new Date(Date.now() - 5000).toISOString(),
          is_sidechain: false,
          parent_uuid: null,
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'system', content: 'Starting' },
          memva_session_id: session.id
        },
        {
          uuid: 'event-2',
          session_id: '', // Empty session_id (user event)
          event_type: 'user',
          timestamp: new Date(Date.now() - 3000).toISOString(),
          is_sidechain: false,
          parent_uuid: 'event-1',
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'user', content: 'Hello' },
          memva_session_id: session.id
        },
        {
          uuid: 'event-3',
          session_id: 'claude-session-2',
          event_type: 'assistant',
          timestamp: new Date(Date.now() - 1000).toISOString(),
          is_sidechain: false,
          parent_uuid: 'event-2',
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'assistant', content: 'Hi there' },
          memva_session_id: session.id
        }
      ]).run()

      const result = await getLatestClaudeSessionId(session.id)
      expect(result).toBe('claude-session-2')
    })

    it('should ignore events with empty session_id when finding latest', async () => {
      const session = testDb.createSession({
        project_path: '/test/project'
      })

      // Insert events where the most recent has empty session_id
      testDb.db.insert(events).values([
        {
          uuid: 'event-1',
          session_id: 'claude-session-1',
          event_type: 'assistant',
          timestamp: new Date(Date.now() - 2000).toISOString(),
          is_sidechain: false,
          parent_uuid: null,
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'assistant', content: 'Response' },
          memva_session_id: session.id
        },
        {
          uuid: 'event-2',
          session_id: '', // Most recent event has empty session_id
          event_type: 'user',
          timestamp: new Date().toISOString(),
          is_sidechain: false,
          parent_uuid: 'event-1',
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'user', content: 'Follow up' },
          memva_session_id: session.id
        }
      ]).run()

      const result = await getLatestClaudeSessionId(session.id)
      // Should return the earlier event's session_id, not the empty one
      expect(result).toBe('claude-session-1')
    })

    it('should return null when all events have empty session_id', async () => {
      const session = testDb.createSession({
        project_path: '/test/project'
      })

      // Insert only events with empty session_ids
      testDb.db.insert(events).values([
        {
          uuid: 'event-1',
          session_id: '',
          event_type: 'user',
          timestamp: new Date(Date.now() - 2000).toISOString(),
          is_sidechain: false,
          parent_uuid: null,
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'user', content: 'First message' },
          memva_session_id: session.id
        },
        {
          uuid: 'event-2',
          session_id: '',
          event_type: 'user',
          timestamp: new Date().toISOString(),
          is_sidechain: false,
          parent_uuid: 'event-1',
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'user', content: 'Second message' },
          memva_session_id: session.id
        }
      ]).run()

      const result = await getLatestClaudeSessionId(session.id)
      expect(result).toBeNull()
    })
  })

  describe('Session Settings', () => {
    describe('createSession with settings', () => {
      it('should copy global settings when creating a new session', async () => {
        // Get current global settings
        const globalSettings = await getGlobalSettings()
        
        // Create a session
        const sessionData: CreateSessionInput = {
          title: 'Test Session',
          project_path: '/test/project',
          status: 'active'
        }
        
        const session = await createSession(sessionData)
        
        // Verify session has settings copied from global
        expect(session.settings).toEqual(globalSettings)
      })

      it('should handle creating session when global settings are customized', async () => {
        // Update global settings first
        const { updateSettings } = await import('./settings.service')
        await updateSettings({ maxTurns: 500, permissionMode: 'plan' })
        
        // Create a session
        const sessionData: CreateSessionInput = {
          title: 'Test Session',
          project_path: '/test/project',
          status: 'active'
        }
        
        const session = await createSession(sessionData)
        
        // Verify session has the customized global settings
        expect(session.settings).toEqual({
          maxTurns: 500,
          permissionMode: 'plan'
        })
      })
    })

    describe('updateSessionSettings', () => {
      it('should update settings for a specific session', async () => {
        // Create a session first
        const session = await createSession({
          title: 'Test Session',
          project_path: '/test/project',
          status: 'active'
        })
        
        // Update its settings
        await updateSessionSettings(session.id, {
          maxTurns: 300,
          permissionMode: 'bypassPermissions'
        })
        
        // Verify settings were updated
        const updatedSession = testDb.getSession(session.id)
        expect(updatedSession?.settings).toEqual({
          maxTurns: 300,
          permissionMode: 'bypassPermissions'
        })
      })

      it('should merge partial settings updates', async () => {
        // Create a session with default settings
        const session = await createSession({
          title: 'Test Session',
          project_path: '/test/project',
          status: 'active'
        })
        
        // Update only maxTurns
        await updateSessionSettings(session.id, { maxTurns: 150 })
        
        let updatedSession = testDb.getSession(session.id)
        expect(updatedSession?.settings).toEqual({
          maxTurns: 150,
          permissionMode: 'acceptEdits' // Should keep original value
        })
        
        // Update only permissionMode
        await updateSessionSettings(session.id, { permissionMode: 'plan' })
        
        updatedSession = testDb.getSession(session.id)
        expect(updatedSession?.settings).toEqual({
          maxTurns: 150, // Should keep previous update
          permissionMode: 'plan'
        })
      })

      it('should throw error for invalid session ID', async () => {
        await expect(
          updateSessionSettings('non-existent-id', { maxTurns: 100 })
        ).rejects.toThrow('Session not found')
      })
    })

    describe('getSessionSettings', () => {
      it('should return session-specific settings when available', async () => {
        // Create a session
        const session = await createSession({
          title: 'Test Session',
          project_path: '/test/project',
          status: 'active'
        })
        
        // Update its settings
        await updateSessionSettings(session.id, {
          maxTurns: 250,
          permissionMode: 'plan'
        })
        
        // Get settings
        const settings = await getSessionSettings(session.id)
        expect(settings).toEqual({
          maxTurns: 250,
          permissionMode: 'plan'
        })
      })

      it('should fall back to global settings when session has no custom settings', async () => {
        // Create a session manually without settings
        const sessionId = crypto.randomUUID()
        testDb.db.insert(testDb.schema.sessions).values({
          id: sessionId,
          title: 'Test Session',
          project_path: '/test/project',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          settings: null // No settings
        }).run()
        
        // Get settings - should fall back to global
        const settings = await getSessionSettings(sessionId)
        const globalSettings = await getGlobalSettings()
        expect(settings).toEqual(globalSettings)
      })

      it('should throw error for invalid session ID', async () => {
        await expect(
          getSessionSettings('non-existent-id')
        ).rejects.toThrow('Session not found')
      })
    })
  })
})