import { describe, it, expect, beforeEach } from 'vitest'
import { db, sessions, events } from './index'
import { 
  createSession, 
  updateSession, 
  getSession, 
  listSessions,
  getSessionWithStats 
} from './sessions.service'
import { v4 as uuidv4 } from 'uuid'

describe('Session Service', () => {
  beforeEach(async () => {
    // Clean up tables before each test - order matters due to foreign keys
    await db.delete(events).execute()
    await db.delete(sessions).execute()
  })

  describe('createSession', () => {
    it('should create a new session with auto-generated ID', async () => {
      const session = await createSession({
        title: 'Test Session',
        project_path: '/test/project',
        metadata: { test: true }
      })

      expect(session.id).toBeTruthy()
      expect(session.title).toBe('Test Session')
      expect(session.status).toBe('active')
      expect(session.project_path).toBe('/test/project')
      expect(session.metadata).toEqual({ test: true })
      expect(session.created_at).toBeTruthy()
      expect(session.updated_at).toBe(session.created_at)
    })

    it('should create a session without title', async () => {
      const session = await createSession({
        project_path: '/test/project'
      })

      expect(session.title).toBeNull()
      expect(session.status).toBe('active')
    })
  })

  describe('updateSession', () => {
    it('should update session fields', async () => {
      // Create session with explicit ID to ensure consistency
      const sessionId = uuidv4()
      const now = new Date().toISOString()
      
      await db.insert(sessions).values({
        id: sessionId,
        title: 'Original',
        created_at: now,
        updated_at: now,
        status: 'active',
        project_path: '/test',
        metadata: null
      }).execute()

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5))

      const updated = await updateSession(sessionId, {
        title: 'Updated',
        status: 'archived'
      })

      expect(updated).not.toBeNull()
      expect(updated!.title).toBe('Updated')
      expect(updated!.status).toBe('archived')
      expect(updated!.updated_at).not.toBe(now)
      expect(updated!.created_at).toBe(now)
    })

    it('should return null for non-existent session', async () => {
      const result = await updateSession('non-existent', {
        title: 'Test'
      })

      expect(result).toBeNull()
    })
  })

  describe('getSession', () => {
    it('should retrieve a session by ID', async () => {
      const created = await createSession({
        title: 'Find Me',
        project_path: '/test'
      })

      const found = await getSession(created.id)

      expect(found).toEqual(created)
    })

    it('should return null for non-existent session', async () => {
      const result = await getSession('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('listSessions', () => {
    it('should list all sessions ordered by created_at desc', async () => {
      const session1 = await createSession({
        title: 'First',
        project_path: '/test1'
      })
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5))
      
      const session2 = await createSession({
        title: 'Second',
        project_path: '/test2'
      })

      const list = await listSessions()

      expect(list).toHaveLength(2)
      expect(list[0].id).toBe(session2.id) // Most recent first
      expect(list[1].id).toBe(session1.id)
    })

    it('should filter by status', async () => {
      const active = await createSession({
        title: 'Active',
        project_path: '/test'
      })

      const archived = await createSession({
        title: 'Archived',
        project_path: '/test'
      })

      await updateSession(archived.id, { status: 'archived' })

      const activeOnly = await listSessions({ status: 'active' })
      expect(activeOnly).toHaveLength(1)
      expect(activeOnly[0].id).toBe(active.id)

      const archivedOnly = await listSessions({ status: 'archived' })
      expect(archivedOnly).toHaveLength(1)
      expect(archivedOnly[0].id).toBe(archived.id)
    })

    it('should limit results', async () => {
      for (let i = 0; i < 5; i++) {
        await createSession({
          title: `Session ${i}`,
          project_path: '/test'
        })
      }

      const limited = await listSessions({ limit: 3 })
      expect(limited).toHaveLength(3)
    })
  })

  describe('getSessionWithStats', () => {
    it('should include event counts and duration', async () => {
      const session = await createSession({
        title: 'Stats Test',
        project_path: '/test'
      })

      // Add some events
      const eventData = [
        { 
          uuid: uuidv4(), 
          event_type: 'user',
          timestamp: '2024-01-01T10:00:00Z'
        },
        { 
          uuid: uuidv4(), 
          event_type: 'assistant',
          timestamp: '2024-01-01T10:05:00Z'
        },
        { 
          uuid: uuidv4(), 
          event_type: 'user',
          timestamp: '2024-01-01T10:10:00Z'
        }
      ]

      for (const data of eventData) {
        await db.insert(events).values({
          ...data,
          session_id: 'test-claude-session',
          memva_session_id: session.id,
          is_sidechain: false,
          cwd: '/test',
          project_name: 'test',
          data: { content: 'test' },
          file_path: '/test.jsonl',
          line_number: 1,
          synced_at: new Date().toISOString()
        }).execute()
      }

      const withStats = await getSessionWithStats(session.id)

      expect(withStats).toBeTruthy()
      expect(withStats!.event_count).toBe(3)
      expect(withStats!.duration_minutes).toBe(10) // 10 minutes between first and last
      expect(withStats!.event_types).toEqual({
        user: 2,
        assistant: 1
      })
    })

    it('should handle session with no events', async () => {
      const session = await createSession({
        title: 'No Events',
        project_path: '/test'
      })

      const withStats = await getSessionWithStats(session.id)

      expect(withStats).toBeTruthy()
      expect(withStats!.event_count).toBe(0)
      expect(withStats!.duration_minutes).toBe(0)
      expect(withStats!.event_types).toEqual({})
    })
  })
})