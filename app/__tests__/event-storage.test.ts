import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForEvents, waitForCondition } from '../test-utils/async-testing'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

// Mock the claude-cli.server module to avoid spawning actual processes
vi.mock('../services/claude-cli.server', () => ({
  streamClaudeCliResponse: vi.fn().mockImplementation(async ({ 
    onMessage, 
    onStoredEvent,
    memvaSessionId,
    projectPath,
    initialParentUuid
  }) => {
    // Import the actual createEventFromMessage and storeEvent functions
    const { createEventFromMessage, storeEvent } = await import('../db/events.service')
    
    // Simulate Claude Code messages
    const messages = [
      { type: 'system', content: 'Session started', session_id: 'mock-session-id' },
      { type: 'user', content: 'Test prompt', session_id: 'mock-session-id' },
      { type: 'assistant', content: 'Test response', session_id: 'mock-session-id' },
      { type: 'result', content: '', session_id: 'mock-session-id' }
    ]
    
    let lastEventUuid = initialParentUuid || null
    
    for (const message of messages) {
      // Call onMessage callback
      onMessage(message)
      
      // Store event if memvaSessionId is provided
      if (memvaSessionId) {
        const event = createEventFromMessage({
          message,
          memvaSessionId,
          projectPath,
          parentUuid: lastEventUuid,
          timestamp: new Date().toISOString()
        })
        
        await storeEvent(event)
        lastEventUuid = event.uuid
        
        if (onStoredEvent) {
          onStoredEvent(event)
        }
      }
    }
    
    return { lastSessionId: 'mock-session-id' }
  })
}))

describe('Event Storage Behavior', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should store all Claude Code message types as events', async () => {
    const session = testDb.createSession({
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
    
    // Wait for events to be stored using smart waiting
    await waitForEvents(() => testDb.getEventsForSession(session.id), ['system', 'user', 'assistant', 'result'])
    
    // Retrieve stored events
    const storedEvents = testDb.getEventsForSession(session.id)
    
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
    const session = testDb.createSession({
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
    
    // Wait for events to be stored using smart waiting
    await waitForEvents(() => testDb.getEventsForSession(session.id), ['system', 'user', 'assistant', 'result'])
    
    const storedEvents = testDb.getEventsForSession(session.id)
    
    // Events should be ordered by timestamp (newest first, with tolerance for mock timing)
    for (let i = 1; i < storedEvents.length; i++) {
      const prevTimestamp = new Date(storedEvents[i - 1].timestamp).getTime()
      const currTimestamp = new Date(storedEvents[i].timestamp).getTime()
      // Allow for same timestamp or descending order (tolerance for mock timing)
      expect(currTimestamp).toBeLessThanOrEqual(prevTimestamp + 10) // 10ms tolerance
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
    const session = testDb.createSession({
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
    
    // Check for events being stored progressively using smart waiting
    await waitForCondition(
      () => testDb.getEventsForSession(session.id).length > 0,
      { errorMessage: 'Expected events to start appearing during streaming' }
    )
    
    const progressiveEvents = testDb.getEventsForSession(session.id)
    
    // Should have stored some events during streaming
    expect(progressiveEvents.length).toBeGreaterThan(0)
    
    // Wait for response to complete
    const response = await responsePromise
    expect(response.status).toBe(200)
  })

  it('should handle multiple concurrent sessions without mixing events', async () => {
    // Create two sessions
    const session1 = testDb.createSession({
      title: 'Session 1',
      project_path: '/test/project1'
    })
    
    const session2 = testDb.createSession({
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
    
    // Wait for events to be stored using smart waiting
    await waitForEvents(() => testDb.getEventsForSession(session1.id), ['system', 'user', 'assistant', 'result'])
    await waitForEvents(() => testDb.getEventsForSession(session2.id), ['system', 'user', 'assistant', 'result'])
    
    // Check that events are properly segregated
    const session1Events = testDb.getEventsForSession(session1.id)
    const session2Events = testDb.getEventsForSession(session2.id)
    
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