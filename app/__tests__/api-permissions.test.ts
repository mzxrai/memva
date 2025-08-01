import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Permissions API Routes', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('GET /api/permissions', () => {
    it('should return all permissions for query filters', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      const { loader } = await import('../routes/api.permissions')
      
      // Create test session
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create multiple permission requests with different statuses
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      const approvedRequest = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: null,
        input: { file_path: '/test.txt', content: 'test' }
      })
      
      const { updatePermissionDecision } = await import('../db/permissions.service')
      await updatePermissionDecision(approvedRequest.id, { decision: 'allow' })
      
      // Test without filters
      const request = new Request('http://localhost/api/permissions')
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.permissions).toHaveLength(2)
    })

    it('should filter by session_id when provided', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      const { loader } = await import('../routes/api.permissions')
      
      // Create two sessions
      const session1 = testDb.createSession({ title: 'Session 1', project_path: '/test1' })
      const session2 = testDb.createSession({ title: 'Session 2', project_path: '/test2' })
      
      // Create permissions for each session
      await createPermissionRequest({
        session_id: session1.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      await createPermissionRequest({
        session_id: session2.id,
        tool_name: 'Write',
        tool_use_id: null,
        input: { file_path: '/test.txt', content: 'test' }
      })
      
      // Test with session filter
      const request = new Request(`http://localhost/api/permissions?session_id=${session1.id}`)
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.permissions).toHaveLength(1)
      expect(data.permissions[0].session_id).toBe(session1.id)
    })

    it('should filter by status when provided', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      const { createJob } = await import('../db/jobs.service')
      const { loader } = await import('../routes/api.permissions')
      
      // Create two different sessions
      const session1 = testDb.createSession({ title: 'Test Session 1', project_path: '/test1' })
      const session2 = testDb.createSession({ title: 'Test Session 2', project_path: '/test2' })
      
      // Create an active job for session2 so we can answer its permission
      await createJob({
        type: 'session-runner',
        data: { sessionId: session2.id },
        priority: 1
      })
      
      // Create permissions with different statuses
      const pendingRequest = await createPermissionRequest({
        session_id: session1.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      const toApproveRequest = await createPermissionRequest({
        session_id: session2.id,
        tool_name: 'Write',
        tool_use_id: null,
        input: { file_path: '/test.txt', content: 'test' }
      })
      
      const { updatePermissionDecision } = await import('../db/permissions.service')
      await updatePermissionDecision(toApproveRequest.id, { decision: 'allow' })
      
      // Test with status filter
      const request = new Request('http://localhost/api/permissions?status=pending')
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.permissions).toHaveLength(1)
      expect(data.permissions[0].id).toBe(pendingRequest.id)
      expect(data.permissions[0].status).toBe('pending')
    })

    it('should handle empty results gracefully', async () => {
      const { loader } = await import('../routes/api.permissions')
      
      const request = new Request('http://localhost/api/permissions')
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.permissions).toEqual([])
    })
  })
})