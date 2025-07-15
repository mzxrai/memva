import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, setMockDatabase, type TestDatabase } from '../test-utils/in-memory-db'
import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'
import { events } from '../db/schema'

describe('Claude Code API Route', () => {
  let testDb: TestDatabase

  beforeEach(async () => {
    testDb = setupInMemoryDb()
    await setMockDatabase(testDb.db)
  })

  afterEach(() => {
    testDb.cleanup()
  })

  it('should return 404 if session not found', async () => {
    const formData = new FormData()
    formData.append('prompt', 'Test prompt')
    
    const request = new Request('http://localhost/api/claude-code/invalid-session', {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: 'invalid-session' }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Session not found')
  })

  it('should return 400 if prompt is missing', async () => {
    // Create a real session in the database
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })
    
    const formData = new FormData()
    // No prompt added
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: session.id }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Prompt is required')
  })

  it('should return 405 for non-POST methods', async () => {
    const request = new Request('http://localhost/api/claude-code/test-session', {
      method: 'GET'
    })
    
    const params = { sessionId: 'test-session' }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    expect(response.status).toBe(405)
    expect(await response.text()).toBe('Method not allowed')
  })

  it('should return streaming response for valid request', async () => {
    // Create a real session in the database
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })
    
    const formData = new FormData()
    formData.append('prompt', 'Hello Claude')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: session.id }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(response.headers.get('Connection')).toBe('keep-alive')
    
    // Wait for streaming to complete by checking for stored events
    let attempts = 0
    const maxAttempts = 50 // 5 seconds max
    while (attempts < maxAttempts) {
      const storedEvents = testDb.getEventsForSession(session.id)
      if (storedEvents.length > 1) { // Should have user + system + assistant + result
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
  })

  it('should handle session with previous events', async () => {
    // Create a session with some existing events
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })
    
    // Add some events to the database
    testDb.db.insert(events).values([
      {
        uuid: 'event-1',
        session_id: 'claude-session-1',
        memva_session_id: session.id,
        event_type: 'user',
        timestamp: new Date().toISOString(),
        is_sidechain: false,
        cwd: '/test/project',
        project_name: 'project',
        data: { type: 'user', content: 'Previous message' }
      },
      {
        uuid: 'event-2',
        session_id: 'claude-session-1',
        memva_session_id: session.id,
        event_type: 'assistant',
        timestamp: new Date().toISOString(),
        is_sidechain: false,
        parent_uuid: 'event-1',
        cwd: '/test/project',
        project_name: 'project',
        data: { type: 'assistant', content: 'Previous response' }
      }
    ]).run()
    
    const formData = new FormData()
    formData.append('prompt', 'Continue our conversation')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: session.id }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    
    // Wait for streaming to complete by checking for stored events
    let attempts = 0
    const maxAttempts = 50 // 5 seconds max
    while (attempts < maxAttempts) {
      const storedEvents = testDb.getEventsForSession(session.id)
      if (storedEvents.length > 3) { // Should have user + previous events + new streaming events
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
  })
})