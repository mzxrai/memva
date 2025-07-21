import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Permission Decision API Route', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('POST /api/permissions/:id', () => {
    it('should approve a permission request', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      const { action } = await import('../routes/api.permissions.$id')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      const httpRequest = new Request('http://localhost/api/permissions/' + request.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'allow' })
      })
      
      const response = await action({ 
        request: httpRequest, 
        params: { id: request.id }, 
        context: {} 
      })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.status).toBe('approved')
      expect(data.decision).toBe('allow')
      expect(data.decided_at).toBeTruthy()
    })

    it('should deny a permission request', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      const { action } = await import('../routes/api.permissions.$id')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: null,
        input: { file_path: '/sensitive.txt', content: 'data' }
      })
      
      const httpRequest = new Request('http://localhost/api/permissions/' + request.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'deny' })
      })
      
      const response = await action({ 
        request: httpRequest, 
        params: { id: request.id }, 
        context: {} 
      })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.status).toBe('denied')
      expect(data.decision).toBe('deny')
      expect(data.decided_at).toBeTruthy()
    })

    it('should return 404 for non-existent permission', async () => {
      const { action } = await import('../routes/api.permissions.$id')
      
      const httpRequest = new Request('http://localhost/api/permissions/non-existent-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'allow' })
      })
      
      const response = await action({ 
        request: httpRequest, 
        params: { id: 'non-existent-id' }, 
        context: {} 
      })
      const data = await response.json()
      
      expect(response.status).toBe(404)
      expect(data.error).toBe('Permission request not found')
    })

    it('should return 400 for invalid decision', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      const { action } = await import('../routes/api.permissions.$id')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      const httpRequest = new Request('http://localhost/api/permissions/' + request.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'invalid' })
      })
      
      const response = await action({ 
        request: httpRequest, 
        params: { id: request.id }, 
        context: {} 
      })
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid decision. Must be "allow" or "deny"')
    })

    it('should return 400 for already decided permission', async () => {
      const { createPermissionRequest, updatePermissionDecision } = await import('../db/permissions.service')
      const { action } = await import('../routes/api.permissions.$id')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      // Already approve the request
      await updatePermissionDecision(request.id, { decision: 'allow' })
      
      const httpRequest = new Request('http://localhost/api/permissions/' + request.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'deny' })
      })
      
      const response = await action({ 
        request: httpRequest, 
        params: { id: request.id }, 
        context: {} 
      })
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Permission request has already been decided')
    })

    it('should handle missing request body', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      const { action } = await import('../routes/api.permissions.$id')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      const httpRequest = new Request('http://localhost/api/permissions/' + request.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      const response = await action({ 
        request: httpRequest, 
        params: { id: request.id }, 
        context: {} 
      })
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Decision is required')
    })

    it('should only accept POST method', async () => {
      const { action } = await import('../routes/api.permissions.$id')
      
      const httpRequest = new Request('http://localhost/api/permissions/some-id', {
        method: 'GET'
      })
      
      const response = await action({ 
        request: httpRequest, 
        params: { id: 'some-id' }, 
        context: {} 
      })
      
      expect(response.status).toBe(405)
      expect(await response.text()).toBe('Method not allowed')
    })
  })
})