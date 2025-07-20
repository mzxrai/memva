import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'
import { events } from '../db/schema'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Define the mock function
const mockStreamClaudeCodeResponse = vi.fn()

// Mock the claude-code.server module
vi.mock('../services/claude-code.server', () => ({
  streamClaudeCodeResponse: vi.fn()
}))

import { action } from '../routes/api.claude-code.$sessionId'
import { streamClaudeCodeResponse } from '../services/claude-code.server'

// Set up the mock implementation after imports
vi.mocked(streamClaudeCodeResponse).mockImplementation(async (options) => {
  // Capture the settings passed to the function
  mockStreamClaudeCodeResponse(options)
  
  // The real implementation would store events via onStoredEvent callback
  // For tests, we don't need to simulate streaming delays - just return immediately
  return { lastSessionId: 'mock-session-id' }
})

describe('Claude Code API Route', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
    vi.clearAllMocks()
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
    // Create a session using factory
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
    // Create a session using factory
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
    
    // Verify that streamClaudeCodeResponse was called
    expect(streamClaudeCodeResponse).toHaveBeenCalled()
  })

  it('should handle session with previous events', async () => {
    // Create a session with some existing events
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })
    
    // Add some events to the database using factory functions
    const userEvent = createMockEvent({
      uuid: 'event-1',
      session_id: 'claude-session-1',
      memva_session_id: session.id,
      event_type: 'user',
      data: { type: 'user', content: 'Previous message' }
    })
    
    const assistantEvent = createMockEvent({
      uuid: 'event-2',
      session_id: 'claude-session-1',
      memva_session_id: session.id,
      event_type: 'assistant',
      parent_uuid: 'event-1',
      data: { type: 'assistant', content: 'Previous response' }
    })
    
    testDb.db.insert(events).values([userEvent, assistantEvent]).run()
    
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
    
    // Verify that streamClaudeCodeResponse was called with resume capability
    expect(streamClaudeCodeResponse).toHaveBeenCalled()
    const callArgs = vi.mocked(streamClaudeCodeResponse).mock.calls[vi.mocked(streamClaudeCodeResponse).mock.calls.length - 1][0]
    expect(callArgs.resumeSessionId).toBe('claude-session-1') // Should resume the existing session
  })

  it('should use session-specific settings when sending to Claude Code', async () => {
    // Create a session with custom settings
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })
    
    // Update session with custom settings
    const { updateSessionSettings } = await import('../db/sessions.service')
    await updateSessionSettings(session.id, {
      maxTurns: 300,
      permissionMode: 'bypassPermissions'
    })
    
    const formData = new FormData()
    formData.append('prompt', 'Test with custom settings')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: session.id }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    
    
    // Check that streamClaudeCodeResponse was called with session settings
    expect(mockStreamClaudeCodeResponse).toHaveBeenCalled()
    const callOptions = mockStreamClaudeCodeResponse.mock.calls[0][0]
    expect(callOptions.maxTurns).toBe(300)
    expect(callOptions.permissionMode).toBe('bypassPermissions')
  })

  it('should fall back to global settings when session has no custom settings', async () => {
    // Create a session without custom settings
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })
    
    const formData = new FormData()
    formData.append('prompt', 'Test with default settings')
    
    const request = new Request(`http://localhost/api/claude-code/${session.id}`, {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: session.id }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    expect(response.status).toBe(200)
    
    
    // Check that streamClaudeCodeResponse was called with global defaults
    expect(mockStreamClaudeCodeResponse).toHaveBeenCalled()
    const callOptions = mockStreamClaudeCodeResponse.mock.calls[mockStreamClaudeCodeResponse.mock.calls.length - 1][0]
    expect(callOptions.maxTurns).toBe(200)
    expect(callOptions.permissionMode).toBe('acceptEdits')
  })
})