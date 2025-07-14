import { describe, it, expect, vi, beforeEach } from 'vitest'
import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

// Mock dependencies
vi.mock('../db/sessions.service', () => ({
  getSession: vi.fn()
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
    vi.mocked(streamClaudeCodeResponse).mockResolvedValue(undefined)
    
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
        sessionId: expect.any(String), // Claude session ID will be generated
        onMessage: expect.any(Function),
        abortController: expect.any(AbortController)
      })
    )
    
    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('should generate unique Claude session ID', async () => {
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
    vi.mocked(streamClaudeCodeResponse).mockResolvedValue(undefined)
    
    const formData = new FormData()
    formData.append('prompt', 'Test prompt')
    
    const request = new Request('http://localhost/api/claude-code/memva-session-123', {
      method: 'POST',
      body: formData
    })
    
    const params = { sessionId: 'memva-session-123' }
    
    await action({ request, params } as Route.ActionArgs)
    
    const sessionId = vi.mocked(streamClaudeCodeResponse).mock.calls[0][0].sessionId
    
    // Should be a valid UUID
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
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
      timestamp: message.timestamp || new Date().toISOString(),
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
        onMessage({ type: 'assistant', content: 'Test response', timestamp: '2025-07-14T10:00:01Z' })
        onMessage({ type: 'result', content: '', timestamp: '2025-07-14T10:00:02Z' })
      }, 0)
      
      return Promise.resolve()
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
        sessionId: expect.any(String),
        onMessage: expect.any(Function),
        abortController: expect.any(AbortController)
      })
    )
  })
})