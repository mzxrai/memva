import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { eq } from 'drizzle-orm'
import { sessions } from './schema'

describe('Sessions table operations', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
  })

  afterEach(() => {
    testDb.cleanup()
  })

  describe('Session CRUD operations', () => {
    it('should create a new session', () => {
      const newSession = {
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

      testDb.db.insert(sessions).values(newSession).run()

      const result = testDb.db.select().from(sessions).where(eq(sessions.id, 'test-session-123')).all()
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

    it('should retrieve a session by ID', () => {
      const sessionId = 'retrieve-test-123'
      testDb.db.insert(sessions).values({
        id: sessionId,
        title: 'Retrieve Test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        project_path: '/test/path'
      }).run()

      const result = testDb.db.select().from(sessions).where(eq(sessions.id, sessionId)).all()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(sessionId)
      expect(result[0].title).toBe('Retrieve Test')
    })

    it('should update a session', () => {
      const sessionId = 'update-test-123'
      const originalTime = new Date().toISOString()
      
      testDb.db.insert(sessions).values({
        id: sessionId,
        title: 'Original Title',
        created_at: originalTime,
        updated_at: originalTime,
        status: 'active',
        project_path: '/test/path'
      }).run()

      const newTime = new Date().toISOString()
      testDb.db.update(sessions)
        .set({ 
          title: 'Updated Title',
          status: 'archived',
          updated_at: newTime
        })
        .where(eq(sessions.id, sessionId))
        .run()

      const result = testDb.db.select().from(sessions).where(eq(sessions.id, sessionId)).all()
      expect(result[0].title).toBe('Updated Title')
      expect(result[0].status).toBe('archived')
      expect(result[0].updated_at).toBe(newTime)
      expect(result[0].created_at).toBe(originalTime)
    })

    it('should list all sessions', () => {
      testDb.db.insert(sessions).values([
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
      ]).run()

      const result = testDb.db.select().from(sessions).all()
      expect(result).toHaveLength(2)
      expect(result.map(s => s.id)).toContain('list-test-1')
      expect(result.map(s => s.id)).toContain('list-test-2')
    })

    it('should filter sessions by status', () => {
      testDb.db.insert(sessions).values([
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
      ]).run()

      const activeOnly = testDb.db.select().from(sessions).where(eq(sessions.status, 'active')).all()
      expect(activeOnly).toHaveLength(1)
      expect(activeOnly[0].id).toBe('filter-active')
    })

    it('should handle nullable title', () => {
      const sessionId = 'no-title-test'
      testDb.db.insert(sessions).values({
        id: sessionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        project_path: '/test/path'
      }).run()

      const result = testDb.db.select().from(sessions).where(eq(sessions.id, sessionId)).all()
      expect(result[0].title).toBeNull()
    })

    it('should store and retrieve complex metadata', () => {
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

      testDb.db.insert(sessions).values({
        id: 'metadata-test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        project_path: '/test/path',
        metadata: complexMetadata
      }).run()

      const result = testDb.db.select().from(sessions).where(eq(sessions.id, 'metadata-test')).all()
      expect(result[0].metadata).toEqual(complexMetadata)
    })
  })
})