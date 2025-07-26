import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'
import { events } from '../db/schema'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock the claude-cli.server module
vi.mock('../services/claude-cli.server', () => ({
  streamClaudeCliResponse: vi.fn().mockResolvedValue({ lastSessionId: 'mock-session-id' })
}))

import { action } from '../routes/api.claude-code.$sessionId'
import { streamClaudeCliResponse } from '../services/claude-cli.server'

// Get the mocked function for assertions
const mockStreamClaudeCliResponse = vi.mocked(streamClaudeCliResponse)

describe('Claude Code API Route', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
    
    // Clear mocks before each test
    mockStreamClaudeCliResponse.mockClear()
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

  it('should process valid request and call Claude Code service', async () => {
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
    
    // Verify that streamClaudeCliResponse was called
    expect(mockStreamClaudeCliResponse).toHaveBeenCalled()
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
    
    // Verify that streamClaudeCliResponse was called with resume capability
    expect(mockStreamClaudeCliResponse).toHaveBeenCalled()
    const callArgs = mockStreamClaudeCliResponse.mock.calls[mockStreamClaudeCliResponse.mock.calls.length - 1][0]
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
    
    
    // Check that streamClaudeCliResponse was called with session settings
    expect(mockStreamClaudeCliResponse).toHaveBeenCalled()
    const callOptions = mockStreamClaudeCliResponse.mock.calls[0][0]
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
    
    
    // Check that streamClaudeCliResponse was called with global defaults
    expect(mockStreamClaudeCliResponse).toHaveBeenCalled()
    const callOptions = mockStreamClaudeCliResponse.mock.calls[mockStreamClaudeCliResponse.mock.calls.length - 1][0]
    expect(callOptions.maxTurns).toBe(200)
    expect(callOptions.permissionMode).toBe('acceptEdits')
  })
})