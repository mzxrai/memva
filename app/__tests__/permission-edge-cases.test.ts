import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Permission System Edge Cases', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('24-Hour Timeout Behavior', () => {
    it('should handle permissions expiring during user session', async () => {
      const { createPermissionRequest, getPendingPermissionRequests, expireOldRequests } = await import('../db/permissions.service')
      const { db } = await import('../db/index')
      const { permissionRequests } = await import('../db/schema')
      const { eq } = await import('drizzle-orm')
      
      const session = testDb.createSession({ title: 'Long Running Session', project_path: '/test' })
      
      // Create a permission request
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'long-running-command' }
      })
      
      // Initially should be pending
      let pending = await getPendingPermissionRequests()
      expect(pending).toHaveLength(1)
      
      // Simulate 24 hours passing
      const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      db.update(permissionRequests)
        .set({ expires_at: pastTime })
        .where(eq(permissionRequests.id, request.id))
        .run()
      
      // Run expiration
      await expireOldRequests()
      
      // Should no longer be in pending list
      pending = await getPendingPermissionRequests()
      expect(pending).toHaveLength(0)
    })

    it('should handle clock skew gracefully', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create request with specific timestamps
      const now = new Date()
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: null,
        input: { file_path: '/test.txt' }
      })
      
      // Verify expires_at is approximately 24 hours from now
      const expiresAt = new Date(request.expires_at)
      const expectedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      
      // Allow for small time differences (within 1 minute)
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime())
      expect(timeDiff).toBeLessThan(60 * 1000)
    })
  })

  describe('Database Connection Issues', () => {
    it('should handle permission creation with session that no longer exists', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      
      // Try to create permission for non-existent session
      await expect(
        createPermissionRequest({
          session_id: 'non-existent-session',
          tool_name: 'Bash',
          tool_use_id: null,
          input: { command: 'ls' }
        })
      ).rejects.toThrow()
    })

    it('should handle duplicate tool_use_id gracefully', async () => {
      const { createPermissionRequest, getPermissionRequests } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      const toolUseId = 'unique-tool-use-123'
      
      // Create first request
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: toolUseId,
        input: { command: 'echo 1' }
      })
      
      // Create second request with same tool_use_id
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: toolUseId,
        input: { command: 'echo 2' }
      })
      
      // Both should exist
      const requests = await getPermissionRequests({ session_id: session.id })
      expect(requests).toHaveLength(2)
      expect(requests.filter(r => r.tool_use_id === toolUseId)).toHaveLength(2)
    })
  })

  describe('Race Conditions', () => {
    it('should handle concurrent approval attempts', async () => {
      const { createPermissionRequest, updatePermissionDecision, getPermissionRequests } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: null,
        input: { file_path: '/important.txt', content: 'data' }
      })
      
      // Simulate concurrent approval attempts
      const approval1 = updatePermissionDecision(request.id, { decision: 'allow' })
      const approval2 = updatePermissionDecision(request.id, { decision: 'allow' })
      
      // First should succeed
      await expect(approval1).resolves.toBeTruthy()
      
      // Second should fail
      await expect(approval2).rejects.toThrow('Permission request already decided')
      
      // Verify final state
      const [finalRequest] = await getPermissionRequests({ id: request.id })
      expect(finalRequest.status).toBe('approved')
      expect(finalRequest.decision).toBe('allow')
    })

    it('should handle approval attempt on expired permission', async () => {
      const { createPermissionRequest, expireOldRequests, updatePermissionDecision } = await import('../db/permissions.service')
      const { db } = await import('../db/index')
      const { permissionRequests } = await import('../db/schema')
      const { eq } = await import('drizzle-orm')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'rm -rf /' }
      })
      
      // Expire the request
      const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      db.update(permissionRequests)
        .set({ expires_at: pastTime })
        .where(eq(permissionRequests.id, request.id))
        .run()
      
      await expireOldRequests()
      
      // Try to approve expired request
      await expect(
        updatePermissionDecision(request.id, { decision: 'allow' })
      ).rejects.toThrow('Permission request already decided')
    })
  })

  describe('Large Scale Operations', () => {
    it('should handle many permissions efficiently', async () => {
      const { createPermissionRequest, getPendingPermissionRequests } = await import('../db/permissions.service')
      
      // Create multiple sessions to test many permissions
      const sessions = []
      for (let i = 0; i < 50; i++) {
        sessions.push(testDb.createSession({ title: `Session ${i}`, project_path: `/test${i}` }))
      }
      
      // Create one permission per session
      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(
          createPermissionRequest({
            session_id: sessions[i].id,
            tool_name: ['Bash', 'Read', 'Write'][i % 3],
            tool_use_id: `bulk-${i}`,
            input: { index: i }
          })
        )
      }
      
      await Promise.all(promises)
      
      // Should retrieve all efficiently
      const pending = await getPendingPermissionRequests()
      expect(pending).toHaveLength(50)
    })

    it('should expire many old permissions efficiently', async () => {
      const { createPermissionRequest, expireOldRequests } = await import('../db/permissions.service')
      const { db } = await import('../db/index')
      const { permissionRequests } = await import('../db/schema')
      
      // Create multiple sessions
      const sessions = []
      for (let i = 0; i < 30; i++) {
        sessions.push(testDb.createSession({ title: `Expiry Session ${i}`, project_path: `/test${i}` }))
      }
      
      // Create one permission per session
      const requests = []
      for (let i = 0; i < 30; i++) {
        const request = await createPermissionRequest({
          session_id: sessions[i].id,
          tool_name: 'Bash',
          tool_use_id: `expire-${i}`,
          input: { command: `echo ${i}` }
        })
        requests.push(request)
      }
      
      // Set all to be expired
      const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      db.update(permissionRequests)
        .set({ expires_at: pastTime })
        .run()
      
      // Expire them all
      const expiredCount = await expireOldRequests()
      expect(expiredCount).toBe(30)
    })
  })

  describe('Invalid Input Handling', () => {
    it('should handle malformed input data', async () => {
      const { createPermissionRequest, getPermissionRequests } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create with complex nested input
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'ComplexTool',
        tool_use_id: null,
        input: {
          nested: {
            deeply: {
              value: 'test',
              array: [1, 2, 3],
              special: 'characters: \n\t\r'
            }
          }
        }
      })
      
      // Should store and retrieve correctly
      const [retrieved] = await getPermissionRequests({ id: request.id })
      expect(retrieved.input).toEqual({
        nested: {
          deeply: {
            value: 'test',
            array: [1, 2, 3],
            special: 'characters: \n\t\r'
          }
        }
      })
    })

    it('should handle very long tool names and inputs', async () => {
      const { createPermissionRequest, getPermissionRequests } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const longToolName = 'VeryLongToolName'.repeat(10)
      const longCommand = 'echo ' + 'x'.repeat(1000)
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: longToolName,
        tool_use_id: null,
        input: { command: longCommand }
      })
      
      const [retrieved] = await getPermissionRequests({ id: request.id })
      expect(retrieved.tool_name).toBe(longToolName)
      expect((retrieved.input as { command: string }).command).toBe(longCommand)
    })
  })
})