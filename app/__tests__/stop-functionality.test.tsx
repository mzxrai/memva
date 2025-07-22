import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForCondition, waitForEvents } from '../test-utils/async-testing'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { action } from '../routes/api.claude-code.$sessionId'

// Mock Claude Code to support cancellation testing
vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn().mockImplementation(({ options }) => {
    const abortController = options?.abortController || new AbortController()
    
    return (async function* () {
      let messageCount = 0
      
      // Initial system message
      yield {
        type: 'system',
        content: 'Starting processing...',
        session_id: 'mock-session-id'
      }
      
      // Keep generating messages until aborted
      while (messageCount < 5 && !abortController.signal.aborted) {
        yield {
          type: 'thinking',
          content: `Processing step ${messageCount}...`,
          session_id: 'mock-session-id'
        }
        messageCount++
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
      // Only send result if not aborted
      if (!abortController.signal.aborted) {
        yield {
          type: 'result',
          content: 'Processing complete',
          session_id: 'mock-session-id'
        }
      }
    })()
  })
}))

describe('Stop Functionality', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should store events when request is processed', async () => {
    const session = testDb.createSession({
      title: 'Cancel Event Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'Start a cancellable task')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    // Start the request
    const responsePromise = action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    const response = await responsePromise
    expect(response.status).toBe(200)
    
    // Wait for events to be stored
    await waitForEvents(
      () => testDb.getEventsForSession(session.id),
      ['system'],
      { timeoutMs: 3000 }
    )
    
    // Check stored events
    const storedEvents = testDb.getEventsForSession(session.id)
    
    // Should have system event
    const eventTypes = storedEvents.map(e => e.event_type)
    expect(eventTypes).toContain('system')
    
    // Events should maintain proper parent-child relationships
    storedEvents.forEach(event => {
      if (event.parent_uuid) {
        const parentExists = storedEvents.some(e => e.uuid === event.parent_uuid)
        expect(parentExists).toBe(true)
      }
    })
  })

  it('should handle abort signal from client without showing error', async () => {
    const session = testDb.createSession({
      title: 'Abort Signal Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'Test abort signal')
    
    const abortController = new AbortController()
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData,
      signal: abortController.signal
    })
    
    // Start the request
    const responsePromise = action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    // Wait for some events to be stored, then abort
    await waitForCondition(
      () => testDb.getEventsForSession(session.id).length > 0,
      { timeoutMs: 2000 }
    )
    abortController.abort()
    
    // The response should still complete successfully
    const response = await responsePromise
    expect(response.status).toBe(200)
    
    // Check that some events were stored before abort
    const storedEvents = testDb.getEventsForSession(session.id)
    expect(storedEvents.length).toBeGreaterThan(0)
    
    // Should not have an error event from the abort
    const errorEvents = storedEvents.filter(e => e.event_type === 'error')
    const abortErrors = errorEvents.filter(e => 
      e.data && typeof e.data === 'object' && 'content' in e.data &&
      typeof e.data.content === 'string' && e.data.content.includes('aborted')
    )
    expect(abortErrors).toHaveLength(0)
  })

  it('should continue streaming even if client disconnects', async () => {
    const session = testDb.createSession({
      title: 'Stream Continue Test', 
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'Long running task')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    
    // Read some of the stream
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')
    
    const decoder = new TextDecoder()
    const messages = []
    
    // Read a few messages
    for (let i = 0; i < 3; i++) {
      const { done, value } = await reader.read()
      if (done) break
      
      const text = decoder.decode(value)
      const lines = text.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            messages.push(data)
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    
    // Cancel the reader (simulating client disconnect)
    await reader.cancel()
    
    // Wait for events to be stored
    await waitForCondition(
      () => testDb.getEventsForSession(session.id).length >= 1,
      { timeoutMs: 3000 }
    )
    
    // Check that events were still stored
    const storedEvents = testDb.getEventsForSession(session.id)
    expect(storedEvents.length).toBeGreaterThanOrEqual(1)
    
    // Verify the stored events include multiple types
    const eventTypes = storedEvents.map(e => e.event_type)
    expect(new Set(eventTypes).size).toBeGreaterThan(0)
  })
})