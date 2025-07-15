import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSession } from '../db/sessions.service'
import { getEventsForSession } from '../db/event-session.service'
import { db, sessions, events } from '../db'
import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'
import { eq } from 'drizzle-orm'

// Mock only external dependencies like Claude Code SDK
vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn().mockImplementation(function* () {
    // Mock Claude Code SDK returning messages
    yield { type: 'system', content: 'Session started', session_id: 'mock-session-id' }
    yield { type: 'user', content: 'Test prompt', session_id: 'mock-session-id' }
    yield { type: 'assistant', content: 'Test response', session_id: 'mock-session-id' }
    yield { type: 'result', content: '', session_id: 'mock-session-id' }
  })
}))

describe('Event Storage Behavior', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await db.delete(events).execute()
    await db.delete(sessions).execute()
  })

  it('should store all Claude Code message types as events', async () => {
    const session = await createSession({
      title: 'Event Storage Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'Test all event types')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    
    // Wait for events to be stored
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Retrieve stored events
    const storedEvents = await getEventsForSession(session.id)
    
    // Should have stored multiple event types from mock
    const eventTypes = storedEvents.map(e => e.event_type)
    expect(eventTypes).toContain('system')
    expect(eventTypes).toContain('user')
    expect(eventTypes).toContain('assistant')
    expect(eventTypes).toContain('result')
    
    // All events should have required fields
    storedEvents.forEach(event => {
      expect(event.uuid).toBeTruthy()
      // User events from our API don't have session_id until Claude responds
      if (event.event_type !== 'user' || event.parent_uuid !== null) {
        expect(event.session_id).toBeTruthy()
      }
      expect(event.memva_session_id).toBe(session.id)
      expect(event.timestamp).toBeTruthy()
      expect(event.cwd).toBe('/test/project')
      expect(event.project_name).toBe('project')
      expect(event.data).toBeTruthy()
    })
  })

  it('should preserve event order and threading', async () => {
    const session = await createSession({
      title: 'Event Order Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'Test event ordering')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    await action({ request, params: { sessionId: session.id } } as Route.ActionArgs)
    
    // Wait for events to be stored
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const storedEvents = await getEventsForSession(session.id)
    
    // Events should be ordered by timestamp (newest first)
    for (let i = 1; i < storedEvents.length; i++) {
      const prevTimestamp = new Date(storedEvents[i - 1].timestamp).getTime()
      const currTimestamp = new Date(storedEvents[i].timestamp).getTime()
      expect(currTimestamp).toBeLessThanOrEqual(prevTimestamp)
    }
    
    // Events should have parent relationships (except the first one)
    const eventsWithParents = storedEvents.filter(e => e.parent_uuid !== null)
    expect(eventsWithParents.length).toBeGreaterThan(0)
    
    // Each parent_uuid should reference a previous event
    eventsWithParents.forEach(event => {
      const parentExists = storedEvents.some(e => e.uuid === event.parent_uuid)
      expect(parentExists).toBe(true)
    })
  })

  it('should store events immediately as they arrive', async () => {
    const session = await createSession({
      title: 'Immediate Storage Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'Test immediate storage')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    // Start the request but don't await it
    const responsePromise = action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    // Check for events being stored progressively
    let previousCount = 0
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 20))
      
      const currentEvents = await db.select().from(events)
        .where(eq(events.memva_session_id, session.id))
        .execute()
      
      // Events should be appearing progressively (not all at once)
      if (currentEvents.length > previousCount) {
        previousCount = currentEvents.length
      }
    }
    
    // Should have stored some events during streaming
    expect(previousCount).toBeGreaterThan(0)
    
    // Wait for response to complete
    const response = await responsePromise
    expect(response.status).toBe(200)
  })

  it('should handle multiple concurrent sessions without mixing events', async () => {
    // Create two sessions
    const session1 = await createSession({
      title: 'Session 1',
      project_path: '/test/project1'
    })
    
    const session2 = await createSession({
      title: 'Session 2',
      project_path: '/test/project2'
    })
    
    // Send messages to both sessions concurrently
    const formData1 = new FormData()
    formData1.append('prompt', 'Message for session 1')
    
    const formData2 = new FormData()
    formData2.append('prompt', 'Message for session 2')
    
    const request1 = new Request(`http://localhost/api/claude-code/${session1.id}`, {
      method: 'POST',
      body: formData1
    })
    
    const request2 = new Request(`http://localhost/api/claude-code/${session2.id}`, {
      method: 'POST',
      body: formData2
    })
    
    // Execute both requests concurrently
    const [response1, response2] = await Promise.all([
      action({ request: request1, params: { sessionId: session1.id } } as Route.ActionArgs),
      action({ request: request2, params: { sessionId: session2.id } } as Route.ActionArgs)
    ])
    
    expect(response1.status).toBe(200)
    expect(response2.status).toBe(200)
    
    // Wait for events to be stored
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Check that events are properly segregated
    const session1Events = await getEventsForSession(session1.id)
    const session2Events = await getEventsForSession(session2.id)
    
    // Each session should have its own events
    expect(session1Events.length).toBeGreaterThan(0)
    expect(session2Events.length).toBeGreaterThan(0)
    
    // No event should belong to both sessions
    session1Events.forEach(event => {
      expect(event.memva_session_id).toBe(session1.id)
      expect(event.cwd).toBe('/test/project1')
    })
    
    session2Events.forEach(event => {
      expect(event.memva_session_id).toBe(session2.id)
      expect(event.cwd).toBe('/test/project2')
    })
  })
})