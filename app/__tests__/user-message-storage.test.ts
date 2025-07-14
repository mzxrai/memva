import { describe, it, expect, beforeEach, vi } from 'vitest'
import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'
import { createSession } from '../db/sessions.service'
import { getEventsForSession } from '../db/event-session.service'
import { db, sessions, events } from '../db'

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
  beforeEach(async () => {
    await db.delete(events).execute()
    await db.delete(sessions).execute()
  })

  it('should store user prompt as an event when submitted', async () => {
    // Create a test session
    const session = await createSession({
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
    
    // Let the stream complete
    const reader = response.body?.getReader()
    if (reader) {
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    }
    
    // Check that user message was stored
    const storedEvents = await getEventsForSession(session.id)
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
    const session = await createSession({
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
    
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    // Consume the stream
    const reader = response.body?.getReader()
    if (reader) {
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    }
    
    // Check event order
    const storedEvents = await getEventsForSession(session.id)
    
    // Should have at least 3 events: user, system, result
    expect(storedEvents.length).toBeGreaterThanOrEqual(3)
    
    // Find the user event (since events are newest-first, user event will be oldest)
    const userEvent = storedEvents.find(e => e.event_type === 'user')
    expect(userEvent).toBeTruthy()
    expect(userEvent!.data).toMatchObject({
      type: 'user',
      content: userPrompt
    })
    
    // Find the system event 
    const systemEvent = storedEvents.find(e => e.event_type === 'system')
    expect(systemEvent).toBeTruthy()
    
    // User message should not have a parent
    expect(userEvent!.parent_uuid).toBeNull()
    
    // System message should have user message as parent
    expect(systemEvent!.parent_uuid).toBe(userEvent!.uuid)
  })

  it('should handle empty or whitespace-only prompts', async () => {
    const session = await createSession({
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
    const storedEvents = await getEventsForSession(session.id)
    expect(storedEvents).toHaveLength(0)
  })
})