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

    it('should cancel active job when permission is denied', async () => {
      // Use fake timers to avoid waiting
      vi.useFakeTimers()
      
      const { createPermissionRequest } = await import('../db/permissions.service')
      const { action } = await import('../routes/api.permissions.$id')
      const { createJob, getJob } = await import('../db/jobs.service')
      const { getSession } = await import('../db/sessions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create an active job for the session
      const job = await createJob({
        type: 'session-runner',
        data: { sessionId: session.id, prompt: 'test prompt' },
        priority: 5
      })
      
      // Create a permission request for the same session
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
      
      // Advance timers to trigger the delayed cancellation
      await vi.runAllTimersAsync()
      
      // Verify the job was cancelled
      const updatedJob = await getJob(job.id)
      expect(updatedJob?.status).toBe('cancelled')
      
      // Verify the session status was updated to completed
      const updatedSession = await getSession(session.id)
      expect(updatedSession?.claude_status).toBe('completed')
      
      // Restore real timers
      vi.useRealTimers()
    })

    it('should create synthetic tool_result event when permission with tool_use_id is denied', async () => {
      const { createPermissionRequest } = await import('../db/permissions.service')
      const { action } = await import('../routes/api.permissions.$id')
      const { storeEvent } = await import('../db/events.service')
      const { getEventsForSession } = await import('../db/event-session.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create a mock assistant event with tool_use
      const toolUseId = 'toolu_test123'
      const assistantEvent = {
        uuid: 'assistant-uuid-123',
        session_id: 'test-claude-session',
        event_type: 'assistant' as const,
        timestamp: new Date().toISOString(),
        is_sidechain: false,
        parent_uuid: null,
        cwd: '/test',
        project_name: 'test',
        data: {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{
              type: 'tool_use',
              id: toolUseId,
              name: 'Write',
              input: { file_path: '/sensitive.txt', content: 'data' }
            }]
          }
        },
        memva_session_id: session.id
      }
      
      await storeEvent(assistantEvent)
      
      // Create a permission request with tool_use_id
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: toolUseId,
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
      
      expect(response.status).toBe(200)
      
      // Verify synthetic tool_result event was created
      const events = await getEventsForSession(session.id, { visibleOnly: false })
      const toolResultEvent = events.find(e => {
        if (e.event_type !== 'user') return false
        const data = e.data as any
        return data?.message?.content?.[0]?.type === 'tool_result' &&
               data?.message?.content?.[0]?.tool_use_id === toolUseId
      })
      
      expect(toolResultEvent).toBeTruthy()
      expect(toolResultEvent?.parent_uuid).toBe(assistantEvent.uuid)
      
      const eventData = toolResultEvent?.data as any
      expect(eventData?.message?.content?.[0]?.content).toBe('User denied request')
      expect(eventData?.message?.content?.[0]?.is_error).toBe(true)
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