import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

// Mock Claude Code SDK to return different event types
vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn().mockImplementation(({ prompt }: { prompt: string }) => {
    return (async function* () {
      yield { 
        type: 'user', 
        content: prompt,
        session_id: 'mock-session-id'
      }
      yield { type: 'system', content: 'Session started', session_id: 'mock-session-id' }
      
      // Different assistant responses based on prompt
      if (prompt.includes('tool')) {
        yield {
          type: 'assistant',
          content: {
            role: 'assistant',
            content: [{
              type: 'tool_use',
              id: 'tool_123',
              name: 'Read',
              input: { file_path: '/test.ts' }
            }]
          },
          session_id: 'mock-session-id'
        }
        yield {
          type: 'user',
          content: {
            role: 'user', 
            content: [{
              type: 'tool_result',
              tool_use_id: 'tool_123',
              content: 'File content here'
            }]
          },
          session_id: 'mock-session-id'
        }
      } else if (prompt.includes('thinking')) {
        yield {
          type: 'assistant',
          content: {
            role: 'assistant',
            content: [{
              type: 'thinking',
              text: 'Let me think about this...'
            }]
          },
          session_id: 'mock-session-id'
        }
      }
      
      yield {
        type: 'assistant',
        content: {
          role: 'assistant',
          content: [{
            type: 'text',
            text: 'Response to: ' + prompt
          }]
        },
        session_id: 'mock-session-id'
      }
      
      yield { type: 'result', content: 'Complete', session_id: 'mock-session-id' }
    })()
  })
}))

describe('Claude Code Event Processing', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should process and store user text messages', async () => {
    const session = testDb.createSession({
      title: 'Text Message Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'Hello, how are you?')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    
    // Wait for events to be processed
    let attempts = 0
    const maxAttempts = 50
    while (attempts < maxAttempts) {
      const storedEvents = testDb.getEventsForSession(session.id)
      if (storedEvents.length >= 4) { // system, user, assistant, result
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    
    const storedEvents = testDb.getEventsForSession(session.id)
    
    // Should have stored user message (may be multiple due to our API creating one and Claude SDK creating another)
    const userEvents = storedEvents.filter(e => e.event_type === 'user')
    expect(userEvents.length).toBeGreaterThanOrEqual(1)
    
    // Find the user event that contains our original prompt
    const originalUserEvent = userEvents.find(e => {
      const data = e.data as any
      return data.type === 'user' && data.content === 'Hello, how are you?'
    })
    expect(originalUserEvent).toBeTruthy()
    expect(originalUserEvent?.data).toMatchObject({
      type: 'user',
      content: 'Hello, how are you?'
    })
    
    // Should have stored assistant response
    const assistantEvents = storedEvents.filter(e => e.event_type === 'assistant')
    expect(assistantEvents).toHaveLength(1)
    expect(assistantEvents[0].data).toMatchObject({
      type: 'assistant',
      content: {
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Response to: Hello, how are you?'
        }]
      }
    })
  })

  it('should process and store tool use events', async () => {
    const session = testDb.createSession({
      title: 'Tool Use Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'Please use a tool to read a file')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    
    // Wait for events to be processed
    let attempts = 0
    const maxAttempts = 50
    while (attempts < maxAttempts) {
      const storedEvents = testDb.getEventsForSession(session.id)
      if (storedEvents.length >= 6) { // system, user, assistant(tool_use), user(tool_result), assistant(text), result
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    
    const storedEvents = testDb.getEventsForSession(session.id)
    
    // Should have stored tool use
    const toolUseEvents = storedEvents.filter(e => {
      const data = e.data as any
      return e.event_type === 'assistant' && 
             data.content?.content?.[0]?.type === 'tool_use'
    })
    expect(toolUseEvents).toHaveLength(1)
    expect(toolUseEvents[0].data).toMatchObject({
      type: 'assistant',
      content: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'tool_123',
          name: 'Read',
          input: { file_path: '/test.ts' }
        }]
      }
    })
    
    // Should have stored tool result
    const toolResultEvents = storedEvents.filter(e => {
      const data = e.data as any
      return e.event_type === 'user' && 
             data.content?.content?.[0]?.type === 'tool_result'
    })
    expect(toolResultEvents).toHaveLength(1)
    expect(toolResultEvents[0].data).toMatchObject({
      type: 'user',
      content: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'tool_123',
          content: 'File content here'
        }]
      }
    })
  })

  it('should process and store thinking events', async () => {
    const session = testDb.createSession({
      title: 'Thinking Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'This requires thinking about the problem')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    
    // Wait for events to be processed
    let attempts = 0
    const maxAttempts = 50
    while (attempts < maxAttempts) {
      const storedEvents = testDb.getEventsForSession(session.id)
      if (storedEvents.length >= 5) { // system, user, assistant(thinking), assistant(text), result
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    
    const storedEvents = testDb.getEventsForSession(session.id)
    
    // Should have stored thinking block
    const thinkingEvents = storedEvents.filter(e => {
      const data = e.data as any
      return e.event_type === 'assistant' && 
             data.content?.content?.[0]?.type === 'thinking'
    })
    expect(thinkingEvents).toHaveLength(1)
    expect(thinkingEvents[0].data).toMatchObject({
      type: 'assistant',
      content: {
        role: 'assistant',
        content: [{
          type: 'thinking',
          text: 'Let me think about this...'
        }]
      }
    })
  })

  it('should maintain event threading and order', async () => {
    const session = testDb.createSession({
      title: 'Threading Test',
      project_path: '/test/project'
    })

    const formData = new FormData()
    formData.append('prompt', 'Test message for threading')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const response = await action({ 
      request, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    
    // Wait for events to be processed
    let attempts = 0
    const maxAttempts = 50
    while (attempts < maxAttempts) {
      const storedEvents = testDb.getEventsForSession(session.id)
      if (storedEvents.length >= 4) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    
    const storedEvents = testDb.getEventsForSession(session.id)
    
    // Events should have proper parent-child relationships
    const userEvent = storedEvents.find(e => e.event_type === 'user')
    const assistantEvent = storedEvents.find(e => e.event_type === 'assistant')
    const systemEvent = storedEvents.find(e => e.event_type === 'system')
    
    expect(userEvent?.parent_uuid).toBeNull() // User message starts the thread
    expect(systemEvent?.parent_uuid).toBe(userEvent?.uuid) // System responds to user
    expect(assistantEvent?.parent_uuid).toBeTruthy() // Assistant responds in thread
    
    // All events should have proper metadata
    storedEvents.forEach(event => {
      expect(event.uuid).toBeTruthy()
      expect(event.timestamp).toBeTruthy()
      expect(event.cwd).toBe('/test/project')
      expect(event.project_name).toBe('project')
      expect(event.memva_session_id).toBe(session.id)
    })
  })

  it('should handle session continuity across multiple requests', async () => {
    const session = testDb.createSession({
      title: 'Continuity Test',
      project_path: '/test/project'
    })

    // First request
    const formData1 = new FormData()
    formData1.append('prompt', 'First message')
    
    const request1 = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData1
    })
    
    const response1 = await action({ 
      request: request1, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response1.status).toBe(200)
    
    // Wait for first batch of events
    let attempts = 0
    const maxAttempts = 50
    while (attempts < maxAttempts) {
      const storedEvents = testDb.getEventsForSession(session.id)
      if (storedEvents.length >= 4) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    
    const firstBatchEvents = testDb.getEventsForSession(session.id)
    const firstBatchCount = firstBatchEvents.length
    
    // Second request
    const formData2 = new FormData()
    formData2.append('prompt', 'Second message')
    
    const request2 = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData2
    })
    
    const response2 = await action({ 
      request: request2, 
      params: { sessionId: session.id } 
    } as Route.ActionArgs)
    
    expect(response2.status).toBe(200)
    
    // Wait for second batch of events
    attempts = 0
    while (attempts < maxAttempts) {
      const storedEvents = testDb.getEventsForSession(session.id)
      if (storedEvents.length > firstBatchCount + 2) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    
    const allEvents = testDb.getEventsForSession(session.id)
    
    // Should have events from both requests
    expect(allEvents.length).toBeGreaterThan(firstBatchCount)
    
    // All events should share the same Claude session_id (session continuity)
    const nonUserEvents = allEvents.filter(e => e.event_type !== 'user' || e.session_id !== '')
    expect(nonUserEvents.every(e => e.session_id === 'mock-session-id')).toBe(true)
  })
})