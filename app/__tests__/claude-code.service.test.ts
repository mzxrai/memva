import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendPromptToClaudeCode, type SDKMessage } from '../services/claude-code.service'

// Mock fetch globally
global.fetch = vi.fn()

describe('Claude Code Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send prompt to Claude Code and stream messages', async () => {
    const mockMessages: SDKMessage[] = [
      {
        type: 'assistant',
        content: 'Test response',
        timestamp: '2025-07-13T10:00:01Z'
      },
      {
        type: 'done',
        content: '',
        timestamp: '2025-07-13T10:00:02Z'
      }
    ]

    // Create a mock readable stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        for (const message of mockMessages) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`))
        }
        controller.close()
      }
    })

    vi.mocked(global.fetch).mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: new Headers({
          'Content-Type': 'text/event-stream'
        })
      })
    )

    const messages: SDKMessage[] = []
    const onMessage = vi.fn((message: SDKMessage) => {
      if (message.type !== 'done') {
        messages.push(message)
      }
    })

    const promise = new Promise<void>((resolve) => {
      sendPromptToClaudeCode({
        prompt: 'Test prompt',
        sessionId: 'test-session-id',
        onMessage: (message) => {
          onMessage(message)
          if (message.type === 'done') {
            resolve()
          }
        }
      })
    })

    await promise

    expect(global.fetch).toHaveBeenCalledWith('/api/claude-code/test-session-id', {
      method: 'POST',
      body: expect.any(FormData),
      signal: undefined
    })

    expect(messages).toEqual([mockMessages[0]])
  })

  it('should handle errors from the server', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error'
      })
    )

    const onError = vi.fn()

    sendPromptToClaudeCode({
      prompt: 'Test prompt',
      sessionId: 'test-session-id',
      onMessage: vi.fn(),
      onError
    })

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(onError.mock.calls[0][0].message).toContain('HTTP error! status: 500')
  })

  it('should support abort signal', async () => {
    const abortController = new AbortController()
    
    // Create a never-ending stream
    const stream = new ReadableStream({
      start() {
        // Never close the stream
      }
    })

    vi.mocked(global.fetch).mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: new Headers({
          'Content-Type': 'text/event-stream'
        })
      })
    )

    sendPromptToClaudeCode({
      prompt: 'Test prompt',
      sessionId: 'test-session-id',
      onMessage: vi.fn(),
      signal: abortController.signal
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/claude-code/test-session-id', {
      method: 'POST',
      body: expect.any(FormData),
      signal: abortController.signal
    })

    // Abort the request
    abortController.abort()
  })
})