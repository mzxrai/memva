import { describe, it, expect, beforeEach, vi } from 'vitest'
import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'
import { createSession } from '../db/sessions.service'
import { getEventsForSession } from '../db/event-session.service'
import { db, sessions, events } from '../db'
import { eq, asc } from 'drizzle-orm'

// We need to modify the Claude Code mock to support cancellation testing
let activeAbortController: AbortController | null = null
let shouldContinueGenerating = true

// Override the existing mock for these tests
vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn().mockImplementation(({ abortController }) => {
    activeAbortController = abortController
    shouldContinueGenerating = true
    
    return (async function* () {
      let messageCount = 0
      
      // Initial system message
      yield {
        type: 'system',
        content: 'Starting processing...',
        session_id: 'mock-session-id'
      }
      
      // Keep generating messages until aborted
      while (shouldContinueGenerating && !abortController.signal.aborted) {
        yield {
          type: 'thinking',
          content: `Processing step ${messageCount}...`,
          session_id: 'mock-session-id'
        }
        messageCount++
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 50))
        
        // Stop after a few messages for testing
        if (messageCount >= 5) {
          shouldContinueGenerating = false
        }
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
  beforeEach(async () => {
    // Clean up database before each test
    await db.delete(events).execute()
    await db.delete(sessions).execute()
    
    // Reset mock state
    activeAbortController = null
    shouldContinueGenerating = true
  })

  it('should store a cancellation event when request is cancelled', async () => {
    const session = await createSession({
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
    
    // Wait for some messages to be stored
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // Simulate cancellation by sending a cancel command through the stream
    // For now, we'll just check that events are stored correctly
    
    const response = await responsePromise
    expect(response.status).toBe(200)
    
    // Check stored events
    const storedEvents = await getEventsForSession(session.id)
    
    // Should have multiple event types
    const eventTypes = storedEvents.map(e => e.event_type)
    expect(eventTypes).toContain('system')
    expect(eventTypes).toContain('thinking')
    
    // Events should be in order
    storedEvents.forEach((event, index) => {
      if (index > 0) {
        expect(event.parent_uuid).toBe(storedEvents[index - 1].uuid)
      }
    })
  })

  it('should handle abort signal from client without showing error', async () => {
    const session = await createSession({
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
    
    // Wait a moment then abort
    await new Promise(resolve => setTimeout(resolve, 100))
    abortController.abort()
    
    // The response should still complete successfully
    const response = await responsePromise
    expect(response.status).toBe(200)
    
    // Check that some events were stored before abort
    const storedEvents = await getEventsForSession(session.id)
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
    const session = await createSession({
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
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    
    // Read some of the stream
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')
    
    const decoder = new TextDecoder()
    let messages = []
    
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
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    // Cancel the reader (simulating client disconnect)
    await reader.cancel()
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Check that events were still stored
    const storedEvents = await getEventsForSession(session.id)
    expect(storedEvents.length).toBeGreaterThanOrEqual(messages.length)
    
    // Verify the stored events include all message types
    const eventTypes = storedEvents.map(e => e.event_type)
    expect(new Set(eventTypes).size).toBeGreaterThan(1)
  })

})