import { describe, it, expect, beforeEach } from 'vitest'
import { db, sessions, type Session, type NewSession } from './index'
import { eq } from 'drizzle-orm'

describe('Sessions table operations', () => {
  beforeEach(async () => {
    // Clean up sessions table before each test
    await db.delete(sessions).execute()
  })

  describe('Session CRUD operations', () => {
    it('should create a new session', async () => {
      const newSession: NewSession = {
        id: 'test-session-123',
        title: 'My Test Session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        project_path: '/Users/test/project',
        metadata: {
          user_agent: 'test',
          version: '1.0.0'
        }
      }

      await db.insert(sessions).values(newSession).execute()

      const result = await db.select().from(sessions).where(eq(sessions.id, 'test-session-123')).execute()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-session-123',
        title: 'My Test Session',
        status: 'active',
        project_path: '/Users/test/project'
      })
      expect(result[0].metadata).toEqual({
        user_agent: 'test',
        version: '1.0.0'
      })
    })

    it('should retrieve a session by ID', async () => {
      const sessionId = 'retrieve-test-123'
      await db.insert(sessions).values({
        id: sessionId,
        title: 'Retrieve Test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        project_path: '/test/path'
      }).execute()

      const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).execute()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(sessionId)
      expect(result[0].title).toBe('Retrieve Test')
    })

    it('should update a session', async () => {
      const sessionId = 'update-test-123'
      const originalTime = new Date().toISOString()
      
      await db.insert(sessions).values({
        id: sessionId,
        title: 'Original Title',
        created_at: originalTime,
        updated_at: originalTime,
        status: 'active',
        project_path: '/test/path'
      }).execute()

      const newTime = new Date().toISOString()
      await db.update(sessions)
        .set({ 
          title: 'Updated Title',
          status: 'archived',
          updated_at: newTime
        })
        .where(eq(sessions.id, sessionId))
        .execute()

      const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).execute()
      expect(result[0].title).toBe('Updated Title')
      expect(result[0].status).toBe('archived')
      expect(result[0].updated_at).toBe(newTime)
      expect(result[0].created_at).toBe(originalTime)
    })

    it('should list all sessions', async () => {
      await db.insert(sessions).values([
        {
          id: 'list-test-1',
          title: 'Session 1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active',
          project_path: '/test/path1'
        },
        {
          id: 'list-test-2',
          title: 'Session 2',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'archived',
          project_path: '/test/path2'
        }
      ]).execute()

      const result = await db.select().from(sessions).execute()
      expect(result).toHaveLength(2)
      expect(result.map(s => s.id)).toContain('list-test-1')
      expect(result.map(s => s.id)).toContain('list-test-2')
    })

    it('should filter sessions by status', async () => {
      await db.insert(sessions).values([
        {
          id: 'filter-active',
          title: 'Active Session',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active',
          project_path: '/test/active'
        },
        {
          id: 'filter-archived',
          title: 'Archived Session',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'archived',
          project_path: '/test/archived'
        }
      ]).execute()

      const activeOnly = await db.select().from(sessions).where(eq(sessions.status, 'active')).execute()
      expect(activeOnly).toHaveLength(1)
      expect(activeOnly[0].id).toBe('filter-active')
    })

    it('should handle nullable title', async () => {
      const sessionId = 'no-title-test'
      await db.insert(sessions).values({
        id: sessionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        project_path: '/test/path'
      }).execute()

      const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).execute()
      expect(result[0].title).toBeNull()
    })

    it('should store and retrieve complex metadata', async () => {
      const complexMetadata = {
        user_preferences: {
          theme: 'dark',
          language: 'en'
        },
        tags: ['important', 'bug-fix'],
        stats: {
          event_count: 42,
          duration_ms: 12345
        }
      }

      await db.insert(sessions).values({
        id: 'metadata-test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        project_path: '/test/path',
        metadata: complexMetadata
      }).execute()

      const result = await db.select().from(sessions).where(eq(sessions.id, 'metadata-test')).execute()
      expect(result[0].metadata).toEqual(complexMetadata)
    })
  })
})