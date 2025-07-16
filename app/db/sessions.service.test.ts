import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockSession } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { updateSessionClaudeStatus } from './sessions.service'

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
})