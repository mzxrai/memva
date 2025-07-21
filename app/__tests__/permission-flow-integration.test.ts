import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Permission Flow Integration Tests', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('Full Permission Request Flow', () => {
    it('should handle permission request from creation to approval', async () => {
      const { createPermissionRequest, getPermissionRequests, updatePermissionDecision } = await import('../db/permissions.service')
      
      // Create a session
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Simulate MCP server creating a permission request
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: 'test-tool-use-123',
        input: { command: 'npm install' }
      })
      
      expect(request.status).toBe('pending')
      expect(request.tool_name).toBe('Bash')
      expect(request.session_id).toBe(session.id)
      
      // Simulate UI polling for pending permissions
      const pendingRequests = await getPermissionRequests({ 
        session_id: session.id,
        status: 'pending'
      })
      
      expect(pendingRequests).toHaveLength(1)
      expect(pendingRequests[0].id).toBe(request.id)
      
      // Simulate user approving the permission
      const updated = await updatePermissionDecision(request.id, { decision: 'allow' })
      
      expect(updated.status).toBe('approved')
      expect(updated.decision).toBe('allow')
      expect(updated.decided_at).toBeTruthy()
      
      // Verify MCP server can poll for the decision
      const decidedRequests = await getPermissionRequests({ id: request.id })
      expect(decidedRequests[0].status).toBe('approved')
      expect(decidedRequests[0].decision).toBe('allow')
    })

    it('should handle permission request denial', async () => {
      const { createPermissionRequest, updatePermissionDecision } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: 'test-tool-use-456',
        input: { file_path: '/etc/passwd', content: 'malicious content' }
      })
      
      // User denies the suspicious request
      const updated = await updatePermissionDecision(request.id, { decision: 'deny' })
      
      expect(updated.status).toBe('denied')
      expect(updated.decision).toBe('deny')
    })
  })

  describe('Multiple Concurrent Permission Requests', () => {
    it('should handle multiple permissions from same session', async () => {
      const { createPermissionRequest, getPendingPermissionRequests } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create multiple permission requests rapidly
      const requests = await Promise.all([
        createPermissionRequest({
          session_id: session.id,
          tool_name: 'Bash',
          tool_use_id: 'tool-1',
          input: { command: 'ls' }
        }),
        createPermissionRequest({
          session_id: session.id,
          tool_name: 'Read',
          tool_use_id: 'tool-2',
          input: { file_path: '/test.txt' }
        }),
        createPermissionRequest({
          session_id: session.id,
          tool_name: 'Write',
          tool_use_id: 'tool-3',
          input: { file_path: '/output.txt', content: 'test' }
        })
      ])
      
      expect(requests).toHaveLength(3)
      
      // All should be pending
      const pending = await getPendingPermissionRequests()
      expect(pending).toHaveLength(3)
      expect(pending.map(p => p.tool_name).sort()).toEqual(['Bash', 'Read', 'Write'])
    })

    it('should handle permissions from multiple sessions', async () => {
      const { createPermissionRequest, getPermissionRequests } = await import('../db/permissions.service')
      
      const session1 = testDb.createSession({ title: 'Session 1', project_path: '/project1' })
      const session2 = testDb.createSession({ title: 'Session 2', project_path: '/project2' })
      
      await createPermissionRequest({
        session_id: session1.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'npm test' }
      })
      
      await createPermissionRequest({
        session_id: session2.id,
        tool_name: 'Write',
        tool_use_id: null,
        input: { file_path: '/output.txt', content: 'data' }
      })
      
      // Each session should see only its own permissions
      const session1Perms = await getPermissionRequests({ session_id: session1.id })
      const session2Perms = await getPermissionRequests({ session_id: session2.id })
      
      expect(session1Perms).toHaveLength(1)
      expect(session1Perms[0].tool_name).toBe('Bash')
      
      expect(session2Perms).toHaveLength(1)
      expect(session2Perms[0].tool_name).toBe('Write')
    })
  })

  describe('Permission Expiration', () => {
    it('should expire permissions after 24 hours', async () => {
      const { createPermissionRequest, expireOldRequests, getPermissionRequests } = await import('../db/permissions.service')
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
      
      // Manually set expires_at to past time
      const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      db.update(permissionRequests)
        .set({ expires_at: pastTime })
        .where(eq(permissionRequests.id, request.id))
        .run()
      
      // Run expiration
      const expiredCount = await expireOldRequests()
      expect(expiredCount).toBe(1)
      
      // Verify status changed to timeout
      const [expiredRequest] = await getPermissionRequests({ id: request.id })
      expect(expiredRequest.status).toBe('timeout')
    })

    it('should not expire already decided permissions', async () => {
      const { createPermissionRequest, updatePermissionDecision, expireOldRequests, getPermissionRequests } = await import('../db/permissions.service')
      const { db } = await import('../db/index')
      const { permissionRequests } = await import('../db/schema')
      const { eq } = await import('drizzle-orm')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create and approve a request
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: null,
        input: { file_path: '/test.txt' }
      })
      
      await updatePermissionDecision(request.id, { decision: 'allow' })
      
      // Set expires_at to past (even though it's approved)
      const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      db.update(permissionRequests)
        .set({ expires_at: pastTime })
        .where(eq(permissionRequests.id, request.id))
        .run()
      
      // Run expiration
      const expiredCount = await expireOldRequests()
      expect(expiredCount).toBe(0)
      
      // Verify status is still approved
      const [approvedRequest] = await getPermissionRequests({ id: request.id })
      expect(approvedRequest.status).toBe('approved')
    })
  })

  describe('MCP Server Polling Simulation', () => {
    it('should simulate MCP server polling for decision', async () => {
      const { createPermissionRequest, getPermissionRequests, updatePermissionDecision } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: 'test-123',
        input: { command: 'echo "Hello World"' }
      })
      
      // Simulate MCP server polling
      let attempts = 0
      const maxAttempts = 5
      let decision = null
      
      // Poll until decision is made
      while (attempts < maxAttempts && !decision) {
        const [currentRequest] = await getPermissionRequests({ id: request.id })
        
        if (currentRequest.status !== 'pending') {
          decision = currentRequest.decision
          break
        }
        
        // Simulate user making decision after 3 attempts
        if (attempts === 2) {
          await updatePermissionDecision(request.id, { decision: 'allow' })
        }
        
        attempts++
      }
      
      expect(decision).toBe('allow')
      expect(attempts).toBe(3)
    })
  })

  describe('API Route Integration', () => {
    it('should handle permission operations through API routes', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create permissions
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls -la' }
      })
      
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: null,
        input: { file_path: '/README.md' }
      })
      
      // Test GET /api/permissions
      const { loader: getPermissions } = await import('../routes/api.permissions')
      const listRequest = new Request(`http://localhost/api/permissions?session_id=${session.id}`)
      const listResponse = await getPermissions({ request: listRequest, params: {}, context: {} })
      const permissions = await listResponse.json()
      
      expect(listResponse.status).toBe(200)
      expect(permissions.permissions).toHaveLength(2)
      
      // Test POST /api/permissions/:id
      const { action: updatePermission } = await import('../routes/api.permissions.$id')
      const permissionId = permissions.permissions[0].id
      const updateRequest = new Request(`http://localhost/api/permissions/${permissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'allow' })
      })
      
      const updateResponse = await updatePermission({
        request: updateRequest,
        params: { id: permissionId },
        context: {}
      })
      
      const updated = await updateResponse.json()
      expect(updateResponse.status).toBe(200)
      expect(updated.status).toBe('approved')
      expect(updated.decision).toBe('allow')
    })
  })
})