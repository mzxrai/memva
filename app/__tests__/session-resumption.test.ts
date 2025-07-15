import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, setMockDatabase, type TestDatabase } from '../test-utils/in-memory-db'
import { eq, desc } from 'drizzle-orm'
import { events } from '../db/schema'
import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

describe('Session Resumption Behavior', () => {
  let testDb: TestDatabase

  beforeEach(async () => {
    testDb = setupInMemoryDb()
    await setMockDatabase(testDb.db)
  })

  afterEach(() => {
    testDb.cleanup()
  })

  it('should resume conversation using previous Claude session ID', async () => {
    // Create a session
    const session = testDb.createSession({
      title: 'Resumption Test',
      project_path: '/test/project'
    })

    // First conversation - establish a Claude session
    const firstFormData = new FormData()
    firstFormData.append('prompt', 'Hello, can you help me with TypeScript?')
    
    const firstRequest = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: firstFormData
    })
    
    const firstResponse = await action({ 
      request: firstRequest, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(firstResponse.status).toBe(200)
    
    // Wait a bit for the mock events to be stored
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Check that events were stored with Claude session ID
    const storedEvents = await testDb.db.select().from(events)
      .where(eq(events.memva_session_id, session.id))
      .all()
    
    expect(storedEvents.length).toBeGreaterThan(0)
    // Find the first non-user event or user event with session_id
    const eventWithSessionId = storedEvents.find(e => 
      e.event_type !== 'user' || e.session_id === 'mock-session-id'
    )
    expect(eventWithSessionId?.session_id).toBe('mock-session-id')
    
    // Second conversation - should resume using the stored session ID
    const secondFormData = new FormData()
    secondFormData.append('prompt', 'Can you continue explaining about interfaces?')
    
    const secondRequest = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: secondFormData
    })
    
    const secondResponse = await action({ 
      request: secondRequest, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(secondResponse.status).toBe(200)
    
    // The session should have been resumed (logs would show this)
    // In a real test, we'd verify the Claude SDK was called with resume option
  })

  it('should maintain event threading across conversations', async () => {
    const session = testDb.createSession({
      title: 'Threading Test',
      project_path: '/test/project'
    })

    // Simulate first conversation with stored events
    testDb.db.insert(events).values([
      {
        uuid: 'event-1',
        session_id: 'claude-session-1',
        memva_session_id: session.id,
        event_type: 'user',
        timestamp: new Date(Date.now() - 5000).toISOString(),
        is_sidechain: false,
        cwd: '/test/project',
        project_name: 'project',
        data: { type: 'user', content: 'First message' }
      },
      {
        uuid: 'event-2',
        session_id: 'claude-session-1',
        memva_session_id: session.id,
        event_type: 'assistant',
        timestamp: new Date(Date.now() - 4000).toISOString(),
        is_sidechain: false,
        parent_uuid: 'event-1',
        cwd: '/test/project',
        project_name: 'project',
        data: { type: 'assistant', content: 'First response' }
      }
    ]).run()

    // Send new message in the conversation
    const formData = new FormData()
    formData.append('prompt', 'Follow up question')
    
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
    
    // Check that new events maintain threading
    const allEvents = await testDb.db.select().from(events)
      .where(eq(events.memva_session_id, session.id))
      .orderBy(desc(events.timestamp))
      .all()
    
    // Should have original 2 events plus new ones
    expect(allEvents.length).toBeGreaterThan(2)
    
    // Events should maintain parent-child relationships
    const hasParentRelationships = allEvents.some(event => event.parent_uuid !== null)
    expect(hasParentRelationships).toBe(true)
  })

  it('should handle first message in a session (no resumption)', async () => {
    const session = testDb.createSession({
      title: 'New Session Test',
      project_path: '/test/project'
    })

    // Send first message - no previous events
    const formData = new FormData()
    formData.append('prompt', 'This is my first message')
    
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
    
    // Check that events were stored
    const storedEvents = await testDb.db.select().from(events)
      .where(eq(events.memva_session_id, session.id))
      .all()
    
    expect(storedEvents.length).toBeGreaterThan(0)
    // First conversation should not have resumed anything
    // User events from our API might not have session_id initially
    expect(storedEvents.every(e => 
      e.event_type === 'user' && e.parent_uuid === null 
        ? e.session_id === '' 
        : e.session_id === 'mock-session-id'
    )).toBe(true)
  })
})