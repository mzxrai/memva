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
  getSession,
  updateSession,
  listSessions,
  getSessionWithStats,
  updateClaudeSessionId,
  getSessionsWithStatsBatch,
  countArchivedSessions,
  type CreateSessionInput,
  type UpdateSessionInput
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

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const created = await createSession({
        title: 'Test Session',
        project_path: '/test/project',
        status: 'active'
      })

      const retrieved = await getSession(created.id)
      expect(retrieved).toEqual(created)
    })

    it('should return null for non-existent session', async () => {
      const session = await getSession('non-existent-id')
      expect(session).toBeNull()
    })
  })

  describe('updateSession', () => {
    it('should update session title', async () => {
      const session = await createSession({
        title: 'Original Title',
        project_path: '/test/project'
      })

      const updated = await updateSession(session.id, { title: 'New Title' })

      expect(updated?.title).toBe('New Title')
      expect(updated?.project_path).toBe('/test/project')
    })

    it('should update session status', async () => {
      const session = await createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })

      const updated = await updateSession(session.id, { status: 'archived' })

      expect(updated?.status).toBe('archived')
    })

    it('should update session metadata', async () => {
      const session = await createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })

      const metadata = { custom: 'data', count: 42 }
      const updated = await updateSession(session.id, { metadata })

      expect(updated?.metadata).toEqual(metadata)
    })

    it('should update multiple fields', async () => {
      const session = await createSession({
        title: 'Original',
        project_path: '/test/project'
      })

      const updates: UpdateSessionInput = {
        title: 'Updated',
        status: 'archived',
        metadata: { updated: true }
      }

      const updated = await updateSession(session.id, updates)

      expect(updated).toMatchObject({
        title: 'Updated',
        status: 'archived',
        metadata: { updated: true }
      })
    })

    it('should return null for non-existent session', async () => {
      const updated = await updateSession('non-existent-id', { title: 'New' })
      expect(updated).toBeNull()
    })
  })

  describe('listSessions', () => {
    it('should list all sessions ordered by creation time', async () => {
      // Create sessions with slight delays to ensure order
      const session1 = await createSession({
        title: 'First Session',
        project_path: '/test1'
      })
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const session2 = await createSession({
        title: 'Second Session',
        project_path: '/test2'
      })
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const session3 = await createSession({
        title: 'Third Session',
        project_path: '/test3'
      })

      const sessions = await listSessions()

      expect(sessions).toHaveLength(3)
      // Most recent first
      expect(sessions[0].id).toBe(session3.id)
      expect(sessions[1].id).toBe(session2.id)
      expect(sessions[2].id).toBe(session1.id)
    })

    it('should filter sessions by status', async () => {
      const active1 = await createSession({
        title: 'Active 1',
        project_path: '/active1'
      })

      const archived = await createSession({
        title: 'Archived',
        project_path: '/archived'
      })
      await updateSession(archived.id, { status: 'archived' })

      const active2 = await createSession({
        title: 'Active 2',
        project_path: '/active2'
      })

      const activeSessions = await listSessions({ status: 'active' })
      expect(activeSessions).toHaveLength(2)
      expect(activeSessions.map(s => s.id)).toContain(active1.id)
      expect(activeSessions.map(s => s.id)).toContain(active2.id)

      const archivedSessions = await listSessions({ status: 'archived' })
      expect(archivedSessions).toHaveLength(1)
      expect(archivedSessions[0].id).toBe(archived.id)
    })

    it('should limit results when limit is specified', async () => {
      // Create 5 sessions
      for (let i = 0; i < 5; i++) {
        await createSession({
          title: `Session ${i}`,
          project_path: `/test${i}`
        })
      }

      const limitedSessions = await listSessions({ limit: 3 })
      expect(limitedSessions).toHaveLength(3)
    })
  })

  describe('getSessionWithStats', () => {
    it('should return session with calculated stats', async () => {
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })

      // Add events with different types
      const baseTime = new Date()
      testDb.db.insert(events).values([
        {
          uuid: 'event-1',
          session_id: 'claude-1',
          event_type: 'system',
          timestamp: new Date(baseTime.getTime()).toISOString(),
          is_sidechain: false,
          parent_uuid: null,
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'system', content: 'Starting' },
          memva_session_id: session.id
        },
        {
          uuid: 'event-2',
          session_id: '',
          event_type: 'user',
          timestamp: new Date(baseTime.getTime() + 60000).toISOString(), // 1 minute later
          is_sidechain: false,
          parent_uuid: 'event-1',
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'user', content: 'Hello' },
          memva_session_id: session.id
        },
        {
          uuid: 'event-3',
          session_id: 'claude-1',
          event_type: 'assistant',
          timestamp: new Date(baseTime.getTime() + 120000).toISOString(), // 2 minutes later
          is_sidechain: false,
          parent_uuid: 'event-2',
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'assistant', content: 'Hi there' },
          memva_session_id: session.id
        },
        {
          uuid: 'event-4',
          session_id: '',
          event_type: 'user',
          timestamp: new Date(baseTime.getTime() + 300000).toISOString(), // 5 minutes later
          is_sidechain: false,
          parent_uuid: 'event-3',
          cwd: '/test/project',
          project_name: 'project',
          data: { type: 'user', content: 'Another message' },
          memva_session_id: session.id
        }
      ]).run()

      const sessionWithStats = await getSessionWithStats(session.id)

      expect(sessionWithStats).toMatchObject({
        id: session.id,
        title: 'Test Session',
        event_count: 4,
        duration_minutes: 5,
        event_types: {
          system: 1,
          user: 2,
          assistant: 1
        },
        last_event_at: expect.any(String)
      })
    })

    it('should handle session with no events', async () => {
      const session = testDb.createSession({
        title: 'Empty Session',
        project_path: '/test/project'
      })

      const sessionWithStats = await getSessionWithStats(session.id)

      expect(sessionWithStats).toMatchObject({
        id: session.id,
        event_count: 0,
        duration_minutes: 0,
        event_types: {},
        last_event_at: undefined
      })
    })

    it('should return null for non-existent session', async () => {
      const stats = await getSessionWithStats('non-existent-id')
      expect(stats).toBeNull()
    })
  })

  describe('updateClaudeSessionId', () => {
    it('should update Claude session ID in metadata', async () => {
      const session = await createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })

      await updateClaudeSessionId(session.id, 'claude-session-123')

      const updated = await getSession(session.id)
      expect(updated?.metadata).toEqual({
        claude_session_id: 'claude-session-123'
      })
    })

    it('should preserve existing metadata when updating', async () => {
      const session = await createSession({
        title: 'Test Session',
        project_path: '/test/project',
        metadata: { existing: 'data', count: 42 }
      })

      await updateClaudeSessionId(session.id, 'claude-session-456')

      const updated = await getSession(session.id)
      expect(updated?.metadata).toEqual({
        existing: 'data',
        count: 42,
        claude_session_id: 'claude-session-456'
      })
    })

    it('should throw error for non-existent session', async () => {
      await expect(
        updateClaudeSessionId('non-existent-id', 'claude-123')
      ).rejects.toThrow('Session not found')
    })
  })

  describe('getSessionsWithStatsBatch', () => {
    it('should return stats for multiple sessions', async () => {
      const session1 = testDb.createSession({
        title: 'Session 1',
        project_path: '/test1'
      })
      
      const session2 = testDb.createSession({
        title: 'Session 2',
        project_path: '/test2'
      })
      
      const session3 = testDb.createSession({
        title: 'Session 3',
        project_path: '/test3'
      })

      // Add events for session1 and session2
      testDb.db.insert(events).values([
        {
          uuid: 'event-1-1',
          session_id: 'claude-1',
          event_type: 'user',
          timestamp: new Date().toISOString(),
          is_sidechain: false,
          parent_uuid: null,
          cwd: '/test1',
          project_name: 'project1',
          data: { type: 'user', content: 'Message 1' },
          memva_session_id: session1.id
        },
        {
          uuid: 'event-1-2',
          session_id: 'claude-1',
          event_type: 'assistant',
          timestamp: new Date(Date.now() + 60000).toISOString(),
          is_sidechain: false,
          parent_uuid: 'event-1-1',
          cwd: '/test1',
          project_name: 'project1',
          data: { type: 'assistant', content: 'Response 1' },
          memva_session_id: session1.id
        },
        {
          uuid: 'event-2-1',
          session_id: 'claude-2',
          event_type: 'system',
          timestamp: new Date().toISOString(),
          is_sidechain: false,
          parent_uuid: null,
          cwd: '/test2',
          project_name: 'project2',
          data: { type: 'system', content: 'Starting' },
          memva_session_id: session2.id
        }
      ]).run()

      const statsMap = await getSessionsWithStatsBatch([session1.id, session2.id, session3.id])

      expect(statsMap.size).toBe(3)
      
      const stats1 = statsMap.get(session1.id)
      expect(stats1).toMatchObject({
        id: session1.id,
        event_count: 2,
        duration_minutes: 1,
        event_types: { user: 1, assistant: 1 }
      })
      
      const stats2 = statsMap.get(session2.id)
      expect(stats2).toMatchObject({
        id: session2.id,
        event_count: 1,
        duration_minutes: 0,
        event_types: { system: 1 }
      })
      
      const stats3 = statsMap.get(session3.id)
      expect(stats3).toMatchObject({
        id: session3.id,
        event_count: 0,
        duration_minutes: 0,
        event_types: {}
      })
    })

    it('should return empty map for empty array', async () => {
      const statsMap = await getSessionsWithStatsBatch([])
      expect(statsMap.size).toBe(0)
    })

    it('should handle non-existent sessions', async () => {
      const session1 = testDb.createSession({
        title: 'Existing Session',
        project_path: '/test'
      })

      const statsMap = await getSessionsWithStatsBatch([session1.id, 'non-existent-id'])

      expect(statsMap.size).toBe(1)
      expect(statsMap.has(session1.id)).toBe(true)
      expect(statsMap.has('non-existent-id')).toBe(false)
    })
  })

  describe('countArchivedSessions', () => {
    it('should count archived sessions', async () => {
      // Create active sessions
      await createSession({
        title: 'Active 1',
        project_path: '/active1'
      })
      
      await createSession({
        title: 'Active 2',
        project_path: '/active2'
      })

      // Create archived sessions
      const archived1 = await createSession({
        title: 'Archived 1',
        project_path: '/archived1'
      })
      await updateSession(archived1.id, { status: 'archived' })
      
      const archived2 = await createSession({
        title: 'Archived 2',
        project_path: '/archived2'
      })
      await updateSession(archived2.id, { status: 'archived' })

      const count = await countArchivedSessions()
      expect(count).toBe(2)
    })

    it('should return 0 when no archived sessions exist', async () => {
      // Create only active sessions
      await createSession({
        title: 'Active Session',
        project_path: '/active'
      })

      const count = await countArchivedSessions()
      expect(count).toBe(0)
    })
  })
})