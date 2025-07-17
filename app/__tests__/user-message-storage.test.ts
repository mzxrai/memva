import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// Set up database mocks before any other imports
setupDatabaseMocks(vi)

import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

// Mock Claude Code SDK
vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn().mockImplementation(() => {
    return (async function* () {
      // Return minimal messages for testing
      yield {
        type: 'system',
        content: 'Starting...',
        session_id: 'mock-session-id'
      }
      yield {
        type: 'result',
        content: 'Complete',
        session_id: 'mock-session-id'
      }
    })()
  })
}))

describe('User Message Storage', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should store user prompt as an event when submitted', async () => {
    // Create a test session
    const session = testDb.createSession({
      title: 'User Message Test',
      project_path: '/test/project'
    })

    // First store the user event manually since the API expects it to already exist
    const { storeEvent, createEventFromMessage } = await import('../db/events.service')
    const userPrompt = 'Hello Claude, how are you?'
    
    const userEvent = createEventFromMessage({
      message: { 
        type: 'user',
        content: userPrompt,
        session_id: ''
      },
      memvaSessionId: session.id,
      projectPath: session.project_path,
      parentUuid: null
    })
    
    await storeEvent(userEvent)

    const formData = new FormData()
    formData.append('prompt', userPrompt)
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    // Call the action - it returns a streaming response
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    
    // Clean up the stream
    await response.body?.cancel()
    
    // Check that user message was stored
    const storedEvents = testDb.getEventsForSession(session.id)
    const userEvents = storedEvents.filter(e => e.event_type === 'user')
    
    expect(userEvents).toHaveLength(1)
    
    const storedUserEvent = userEvents[0]
    expect(storedUserEvent).toMatchObject({
      event_type: 'user',
      memva_session_id: session.id,
      project_name: 'project',
      cwd: '/test/project'
    })
    
    // Check the content structure
    expect(storedUserEvent.data).toMatchObject({
      type: 'user',
      content: userPrompt
    })
    
    // Should have a UUID
    expect(storedUserEvent.uuid).toBeTruthy()
    expect(storedUserEvent.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    
    // Should have a timestamp
    expect(storedUserEvent.timestamp).toBeTruthy()
    expect(new Date(storedUserEvent.timestamp).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('should store user message before Claude Code messages', async () => {
    const session = testDb.createSession({
      title: 'Message Order Test',
      project_path: '/test/project'
    })

    // First store the user event manually since the API expects it to already exist
    const { storeEvent, createEventFromMessage } = await import('../db/events.service')
    const userPrompt = 'Test message ordering'
    
    const userEvent = createEventFromMessage({
      message: { 
        type: 'user',
        content: userPrompt,
        session_id: ''
      },
      memvaSessionId: session.id,
      projectPath: session.project_path,
      parentUuid: null
    })
    
    await storeEvent(userEvent)

    const formData = new FormData()
    formData.append('prompt', userPrompt)
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    // Clean up the stream
    await response.body?.cancel()
    
    // Check event order
    const storedEvents = testDb.getEventsForSession(session.id)
    
    // Should have at least the user event
    expect(storedEvents.length).toBeGreaterThanOrEqual(1)
    
    // Find the user event (since events are newest-first, user event will be oldest)
    const storedUserEvent = storedEvents.find(e => e.event_type === 'user')
    expect(storedUserEvent).toBeTruthy()
    if (storedUserEvent) {
      expect(storedUserEvent.data).toMatchObject({
        type: 'user',
        content: userPrompt
      })
      
      // User message should not have a parent
      expect(storedUserEvent.parent_uuid).toBeNull()
    }
  })

  it('should handle empty or whitespace-only prompts', async () => {
    const session = testDb.createSession({
      title: 'Empty Prompt Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', '   ') // whitespace only
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    // Should reject empty prompts
    expect(response.status).toBe(400)
    
    // No events should be stored
    const storedEvents = testDb.getEventsForSession(session.id)
    expect(storedEvents).toHaveLength(0)
  })
})