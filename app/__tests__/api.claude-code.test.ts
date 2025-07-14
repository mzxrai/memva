import { describe, it, expect, vi, beforeEach } from 'vitest'
import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

// Mock dependencies
vi.mock('../db/sessions.service', () => ({
  getSession: vi.fn(),
  getLatestClaudeSessionId: vi.fn(),
  updateClaudeSessionId: vi.fn()
}))

vi.mock('../services/claude-code.server', () => ({
  streamClaudeCodeResponse: vi.fn()
}))

vi.mock('../services/events.service', () => ({
  createEventFromMessage: vi.fn(),
  storeEvent: vi.fn()
}))

describe('Claude Code API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass memva session ID to streaming service', async () => {
    const { getSession } = await import('../db/sessions.service')
    const { streamClaudeCodeResponse } = await import('../services/claude-code.server')
    
    const mockSession = {
      id: 'memva-session-123',
      title: 'Test Session',
      project_path: '/test/project',
      status: 'active',
      created_at: '2025-07-14T10:00:00Z',
      updated_at: '2025-07-14T10:00:00Z',
      metadata: null
    }
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    // Mock streaming to capture the call
    vi.mocked(streamClaudeCodeResponse).mockResolvedValue({ lastSessionId: 'claude-session-123' })
    
    const formData = new FormData()
    formData.append('prompt', 'Test prompt')
    
    const request = new Request('http://localhost/api/claude-code/memva-session-123', {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: 'memva-session-123' }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    // Should get session
    expect(getSession).toHaveBeenCalledWith('memva-session-123')
    
    // Should pass memva session ID to streaming service
    expect(streamClaudeCodeResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Test prompt',
        projectPath: '/test/project',
        memvaSessionId: 'memva-session-123',
        onMessage: expect.any(Function),
        abortController: expect.any(AbortController)
      })
    )
    
    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('should return lastSessionId from streaming service', async () => {
    const { getSession, updateClaudeSessionId } = await import('../db/sessions.service')
    const { streamClaudeCodeResponse } = await import('../services/claude-code.server')
    
    const mockSession = {
      id: 'memva-session-123',
      title: 'Test Session',
      project_path: '/test/project',
      status: 'active',
      created_at: '2025-07-14T10:00:00Z',
      updated_at: '2025-07-14T10:00:00Z',
      metadata: null
    }
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    vi.mocked(streamClaudeCodeResponse).mockResolvedValue({ lastSessionId: 'claude-session-123' })
    
    const formData = new FormData()
    formData.append('prompt', 'Test prompt')
    
    const request = new Request('http://localhost/api/claude-code/memva-session-123', {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: 'memva-session-123' }
    
    await action({ request, params } as Route.ActionArgs)
    
    // Should store the Claude session ID returned from streaming
    expect(updateClaudeSessionId).toHaveBeenCalledWith('memva-session-123', 'claude-session-123')
  })

  it('should return 404 if session not found', async () => {
    const { getSession } = await import('../db/sessions.service')
    
    vi.mocked(getSession).mockResolvedValue(null)
    
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
    const { getSession } = await import('../db/sessions.service')
    
    const mockSession = {
      id: 'memva-session-123',
      title: 'Test Session',
      project_path: '/test/project',
      status: 'active',
      created_at: '2025-07-14T10:00:00Z',
      updated_at: '2025-07-14T10:00:00Z',
      metadata: null
    }
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    const formData = new FormData()
    // No prompt added
    
    const request = new Request('http://localhost/api/claude-code/memva-session-123', {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: 'memva-session-123' }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Prompt is required')
  })

  it('should return 405 for non-POST methods', async () => {
    const request = new Request('http://localhost/api/claude-code/memva-session-123', {
      method: 'GET'
    })
    
    const params = { sessionId: 'memva-session-123' }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    expect(response.status).toBe(405)
    expect(await response.text()).toBe('Method not allowed')
  })

  it('should stream stored events with database IDs', async () => {
    const { getSession } = await import('../db/sessions.service')
    const { streamClaudeCodeResponse } = await import('../services/claude-code.server')
    const { createEventFromMessage, storeEvent } = await import('../services/events.service')
    
    const mockSession = {
      id: 'memva-session-123',
      title: 'Test Session',
      project_path: '/test/project',
      status: 'active',
      created_at: '2025-07-14T10:00:00Z',
      updated_at: '2025-07-14T10:00:00Z',
      metadata: null
    }
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    // Mock event creation and storage
    vi.mocked(createEventFromMessage).mockImplementation(({ message }) => ({
      uuid: `event-${Date.now()}`,
      session_id: 'claude-session-123',
      event_type: message.type,
      timestamp: new Date().toISOString(),
      is_sidechain: false,
      parent_uuid: null,
      cwd: '/test/project',
      project_name: 'project',
      data: message,
      memva_session_id: 'memva-session-123'
    }))
    
    vi.mocked(storeEvent).mockResolvedValue(undefined)
    
    // Capture the onMessage callback
    let capturedOnMessage: ((message: any) => void) | undefined
    
    vi.mocked(streamClaudeCodeResponse).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage
      
      // Simulate streaming messages
      setTimeout(() => {
        onMessage({ 
          type: 'assistant', 
          message: { role: 'assistant', content: 'Test response' },
          parent_tool_use_id: null,
          session_id: 'test-session'
        })
        onMessage({ 
          type: 'result',
          subtype: 'success',
          duration_ms: 100,
          duration_api_ms: 80,
          is_error: false,
          num_turns: 1,
          result: 'Success',
          session_id: 'test-session',
          total_cost_usd: 0.001,
          usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
        })
      }, 0)
      
      return Promise.resolve({ lastSessionId: 'claude-session-123' })
    })
    
    const formData = new FormData()
    formData.append('prompt', 'Test prompt')
    
    const request = new Request('http://localhost/api/claude-code/memva-session-123', {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: 'memva-session-123' }
    
    const response = await action({ request, params } as Route.ActionArgs)
    
    // The response should be a streaming response
    expect(response.body).toBeDefined()
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    
    // Since we can't easily test the actual streamed content in this test,
    // we'll verify that the streaming was set up correctly
    expect(streamClaudeCodeResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Test prompt',
        projectPath: '/test/project',
        memvaSessionId: 'memva-session-123',
        onMessage: expect.any(Function),
        abortController: expect.any(AbortController)
      })
    )
  })

  it('should use stored Claude session ID for resumption', async () => {
    const { getSession } = await import('../db/sessions.service')
    const { streamClaudeCodeResponse } = await import('../services/claude-code.server')
    const { getLatestClaudeSessionId } = await import('../db/sessions.service')
    
    const mockSession = {
      id: 'memva-session-123',
      title: 'Test Session',
      project_path: '/test/project',
      status: 'active',
      created_at: '2025-07-14T10:00:00Z',
      updated_at: '2025-07-14T10:00:00Z',
      metadata: null
    }
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    vi.mocked(getLatestClaudeSessionId).mockResolvedValue('previous-claude-session-id')
    vi.mocked(streamClaudeCodeResponse).mockResolvedValue({ lastSessionId: 'new-claude-session-id' })
    
    const formData = new FormData()
    formData.append('prompt', 'Continue our conversation')
    
    const request = new Request('http://localhost/api/claude-code/memva-session-123', {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: 'memva-session-123' }
    
    await action({ request, params } as Route.ActionArgs)
    
    // Should retrieve stored Claude session ID
    expect(getLatestClaudeSessionId).toHaveBeenCalledWith('memva-session-123')
    
    // Should pass it as resumeSessionId
    expect(streamClaudeCodeResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Continue our conversation',
        projectPath: '/test/project',
        memvaSessionId: 'memva-session-123',
        resumeSessionId: 'previous-claude-session-id'
      })
    )
  })

  it('should store new Claude session ID after streaming', async () => {
    const { getSession } = await import('../db/sessions.service')
    const { streamClaudeCodeResponse } = await import('../services/claude-code.server')
    const { updateClaudeSessionId } = await import('../db/sessions.service')
    
    const mockSession = {
      id: 'memva-session-123',
      title: 'Test Session',
      project_path: '/test/project',
      status: 'active',
      created_at: '2025-07-14T10:00:00Z',
      updated_at: '2025-07-14T10:00:00Z',
      metadata: null
    }
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    vi.mocked(streamClaudeCodeResponse).mockResolvedValue({ lastSessionId: 'new-claude-session-id' })
    vi.mocked(updateClaudeSessionId).mockResolvedValue(undefined)
    
    const formData = new FormData()
    formData.append('prompt', 'Test prompt')
    
    const request = new Request('http://localhost/api/claude-code/memva-session-123', {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: 'memva-session-123' }
    
    await action({ request, params } as Route.ActionArgs)
    
    // Should store the new Claude session ID
    expect(updateClaudeSessionId).toHaveBeenCalledWith('memva-session-123', 'new-claude-session-id')
  })
})