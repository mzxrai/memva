import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForEvents } from '../test-utils/async-testing'

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

    const userPrompt = 'Hello Claude, how are you?'
    const formData = new FormData()
    formData.append('prompt', userPrompt)
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    // Call the action
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    
    // Wait for events to be stored using smart waiting
    await waitForEvents(() => testDb.getEventsForSession(session.id), ['user', 'system'])
    
    // Check that user message was stored
    const storedEvents = testDb.getEventsForSession(session.id)
    const userEvents = storedEvents.filter(e => e.event_type === 'user')
    
    expect(userEvents).toHaveLength(1)
    
    const userEvent = userEvents[0]
    expect(userEvent).toMatchObject({
      event_type: 'user',
      memva_session_id: session.id,
      project_name: 'project',
      cwd: '/test/project'
    })
    
    // Check the content structure
    expect(userEvent.data).toMatchObject({
      type: 'user',
      content: userPrompt
    })
    
    // Should have a UUID
    expect(userEvent.uuid).toBeTruthy()
    expect(userEvent.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    
    // Should have a timestamp
    expect(userEvent.timestamp).toBeTruthy()
    expect(new Date(userEvent.timestamp).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('should store user message before Claude Code messages', async () => {
    const session = testDb.createSession({
      title: 'Message Order Test',
      project_path: '/test/project'
    })

    const userPrompt = 'Test message ordering'
    const formData = new FormData()
    formData.append('prompt', userPrompt)
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    // Wait for events to be stored using smart waiting
    await waitForEvents(() => testDb.getEventsForSession(session.id), ['user', 'system'])
    
    // Check event order
    const storedEvents = testDb.getEventsForSession(session.id)
    
    // Should have at least 3 events: user, system, result
    expect(storedEvents.length).toBeGreaterThanOrEqual(3)
    
    // Find the user event (since events are newest-first, user event will be oldest)
    const userEvent = storedEvents.find(e => e.event_type === 'user')
    expect(userEvent).toBeTruthy()
    if (userEvent) {
      expect(userEvent.data).toMatchObject({
        type: 'user',
        content: userPrompt
      })
      
      // User message should not have a parent
      expect(userEvent.parent_uuid).toBeNull()
    }
    
    // Find the system event 
    const systemEvent = storedEvents.find(e => e.event_type === 'system')
    expect(systemEvent).toBeTruthy()
    
    // System message should have user message as parent
    if (systemEvent && userEvent) {
      expect(systemEvent.parent_uuid).toBe(userEvent.uuid)
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