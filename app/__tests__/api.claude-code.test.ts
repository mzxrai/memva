import { describe, it, expect, vi, beforeEach } from 'vitest'
import { action } from '../routes/api.claude-code.$sessionId'
import type { Route } from '../routes/+types/api.claude-code.$sessionId'

// Mock the database service
vi.mock('../db/sessions.service', () => ({
  getSession: vi.fn()
}))

// Mock the server-side Claude Code service
vi.mock('../services/claude-code.server', () => ({
  streamClaudeCodeResponse: vi.fn()
}))

describe('Claude Code API Resource Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 405 for non-POST requests', async () => {
    const request = new Request('http://localhost:3000/api/claude-code/test-session', {
      method: 'GET'
    })
    
    const response = await action({ 
      request, 
      params: { sessionId: 'test-session' } 
    } as Route.ActionArgs)
    
    expect(response.status).toBe(405)
    expect(await response.text()).toBe('Method not allowed')
  })

  it('should return 404 when session not found', async () => {
    const { getSession } = await import('../db/sessions.service')
    vi.mocked(getSession).mockResolvedValue(null)

    const formData = new FormData()
    formData.append('prompt', 'Test prompt')

    const request = new Request('http://localhost:3000/api/claude-code/test-session', {
      method: 'POST',
      body: formData
    })

    const response = await action({
      request,
      params: { sessionId: 'test-session' }
    } as Route.ActionArgs)

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Session not found')
  })

  it('should return 400 when prompt is missing', async () => {
    const { getSession } = await import('../db/sessions.service')
    vi.mocked(getSession).mockResolvedValue({
      id: 'test-session',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/test/path',
      metadata: null
    })

    const formData = new FormData()
    // Not adding prompt

    const request = new Request('http://localhost:3000/api/claude-code/test-session', {
      method: 'POST',
      body: formData
    })

    const response = await action({
      request,
      params: { sessionId: 'test-session' }
    } as Route.ActionArgs)

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Prompt is required')
  })

  it('should stream SSE messages for valid request', async () => {
    const mockSession = {
      id: 'test-session',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/test/path',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    const { streamClaudeCodeResponse } = await import('../services/claude-code.server')
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    const mockMessages = [
      { type: 'thinking', content: 'Processing...', timestamp: '2025-07-13T10:00:01Z' },
      { type: 'assistant', content: 'Hello!', timestamp: '2025-07-13T10:00:02Z' },
      { type: 'result', subtype: 'success', content: '', timestamp: '2025-07-13T10:00:03Z' }
    ]

    vi.mocked(streamClaudeCodeResponse).mockImplementation(async ({ onMessage }) => {
      for (const message of mockMessages) {
        onMessage(message)
      }
    })

    const formData = new FormData()
    formData.append('prompt', 'Test prompt')

    const request = new Request('http://localhost:3000/api/claude-code/test-session', {
      method: 'POST',
      body: formData
    })

    const response = await action({
      request,
      params: { sessionId: 'test-session' }
    } as Route.ActionArgs)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    
    // Read the stream
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    const chunks: string[] = []
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value))
    }
    
    const fullResponse = chunks.join('')
    
    // Verify SSE format
    expect(fullResponse).toContain('data: {"type":"thinking"')
    expect(fullResponse).toContain('data: {"type":"assistant"')
    expect(fullResponse).toContain('data: {"type":"result"')
    
    // Verify proper SSE formatting with double newlines
    const lines = fullResponse.split('\n')
    const dataLines = lines.filter(line => line.startsWith('data: '))
    expect(dataLines).toHaveLength(3)
  })

  it('should handle errors from Claude Code service', async () => {
    const mockSession = {
      id: 'test-session',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/test/path',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    const { streamClaudeCodeResponse } = await import('../services/claude-code.server')
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    vi.mocked(streamClaudeCodeResponse).mockRejectedValue(new Error('Service error'))

    const formData = new FormData()
    formData.append('prompt', 'Test prompt')

    const request = new Request('http://localhost:3000/api/claude-code/test-session', {
      method: 'POST',
      body: formData
    })

    const response = await action({
      request,
      params: { sessionId: 'test-session' }
    } as Route.ActionArgs)

    expect(response.status).toBe(200)
    
    // Read the stream
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    const chunks: string[] = []
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value))
    }
    
    const fullResponse = chunks.join('')
    expect(fullResponse).toContain('data: {"type":"error","content":"Service error"')
  })

  it('should handle abort signal', async () => {
    const mockSession = {
      id: 'test-session',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/test/path',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    const { streamClaudeCodeResponse } = await import('../services/claude-code.server')
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    // Mock a long-running operation
    vi.mocked(streamClaudeCodeResponse).mockImplementation(async ({ onMessage, abortController }) => {
      // Simulate messages being sent over time
      const messages = [
        { type: 'thinking', content: 'Starting...', timestamp: '2025-07-13T10:00:01Z' },
        { type: 'assistant', content: 'Working...', timestamp: '2025-07-13T10:00:02Z' }
      ]
      
      for (const message of messages) {
        onMessage(message)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    })

    const formData = new FormData()
    formData.append('prompt', 'Test prompt')
    
    // Add abort signal to form data
    formData.append('abortSignal', 'true')

    const request = new Request('http://localhost:3000/api/claude-code/test-session', {
      method: 'POST',
      body: formData
    })

    const response = await action({
      request,
      params: { sessionId: 'test-session' }
    } as Route.ActionArgs)

    expect(response.status).toBe(200)
    expect(streamClaudeCodeResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Test prompt',
        projectPath: '/test/path',
        onMessage: expect.any(Function),
        onError: expect.any(Function),
        abortController: expect.any(AbortController)
      })
    )
  })
})