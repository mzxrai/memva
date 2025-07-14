import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamClaudeCodeResponse } from '../services/claude-code.server'

// Mock the Claude Code SDK
vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn()
}))

// Mock the events service
vi.mock('../services/events.service', () => ({
  createEventFromMessage: vi.fn(),
  storeEvent: vi.fn()
}))

describe('Claude Code Server Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should stream messages from Claude Code SDK', async () => {
    const { query } = await import('@anthropic-ai/claude-code')
    
    const mockMessages = [
      { type: 'thinking', content: 'Analyzing...', timestamp: '2025-07-13T10:00:01Z' },
      { type: 'assistant', content: 'Here is my response', timestamp: '2025-07-13T10:00:02Z' },
      { type: 'result', subtype: 'success', content: '', timestamp: '2025-07-13T10:00:03Z' }
    ]

    // Mock the async iterator
    vi.mocked(query).mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        for (const message of mockMessages) {
          yield message
        }
      }
    } as any)

    const receivedMessages: any[] = []
    const onMessage = vi.fn((message) => {
      receivedMessages.push(message)
    })

    await streamClaudeCodeResponse({
      prompt: 'Test prompt',
      projectPath: '/test/path',
      onMessage
    })

    expect(query).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      abortController: expect.any(AbortController),
      options: {
        maxTurns: 10,
        cwd: '/test/path'
      }
    })

    expect(onMessage).toHaveBeenCalledTimes(3)
    expect(receivedMessages).toEqual(mockMessages)
  })

  it('should handle errors with onError callback', async () => {
    const { query } = await import('@anthropic-ai/claude-code')
    
    const testError = new Error('Claude Code error')
    
    vi.mocked(query).mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        throw testError
      }
    } as any)

    const onError = vi.fn()
    const onMessage = vi.fn()

    await streamClaudeCodeResponse({
      prompt: 'Test prompt',
      projectPath: '/test/path',
      onMessage,
      onError
    })

    expect(onError).toHaveBeenCalledWith(testError)
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('should throw error when no onError callback provided', async () => {
    const { query } = await import('@anthropic-ai/claude-code')
    
    const testError = new Error('Claude Code error')
    
    vi.mocked(query).mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        throw testError
      }
    } as any)

    const onMessage = vi.fn()

    await expect(streamClaudeCodeResponse({
      prompt: 'Test prompt',
      projectPath: '/test/path',
      onMessage
    })).rejects.toThrow('Claude Code error')
  })

  it('should support abort functionality', async () => {
    const { query } = await import('@anthropic-ai/claude-code')
    
    const abortController = new AbortController()
    const messagesSent: any[] = []
    
    vi.mocked(query).mockImplementation(({ abortController }) => {
      return {
        [Symbol.asyncIterator]: async function* () {
          const messages = [
            { type: 'thinking', content: 'Starting...', timestamp: '2025-07-13T10:00:01Z' },
            { type: 'assistant', content: 'First response', timestamp: '2025-07-13T10:00:02Z' },
            { type: 'tool_use', content: 'Using tool...', timestamp: '2025-07-13T10:00:03Z' },
            { type: 'assistant', content: 'Should not be sent if aborted', timestamp: '2025-07-13T10:00:04Z' },
            { type: 'result', content: 'Final result', timestamp: '2025-07-13T10:00:05Z' }
          ]
          
          for (const message of messages) {
            // Check if aborted before each message
            if (abortController.signal.aborted) {
              throw new Error('The operation was aborted')
            }
            
            yield message
            messagesSent.push(message)
            
            // Simulate delay between messages
            await new Promise(resolve => setTimeout(resolve, 30))
          }
        }
      } as any
    })

    const onMessage = vi.fn()
    const onError = vi.fn()

    const promise = streamClaudeCodeResponse({
      prompt: 'Test prompt',
      projectPath: '/test/path',
      onMessage,
      onError,
      abortController
    })

    // Abort after 75ms (should be after 2-3 messages)
    setTimeout(() => abortController.abort(), 75)

    await promise

    // Verify error was called
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'The operation was aborted'
    }))
    
    // Verify only some messages were sent (not all 5)
    expect(onMessage.mock.calls.length).toBeGreaterThan(0)
    expect(onMessage.mock.calls.length).toBeLessThan(5)
    
    // Verify the last messages were never sent
    const sentMessages = onMessage.mock.calls.map(call => call[0])
    expect(sentMessages).not.toContainEqual(
      expect.objectContaining({ content: 'Should not be sent if aborted' })
    )
    expect(sentMessages).not.toContainEqual(
      expect.objectContaining({ content: 'Final result' })
    )
  })

  it('should pass correct options to Claude Code SDK', async () => {
    const { query } = await import('@anthropic-ai/claude-code')
    
    vi.mocked(query).mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'result', subtype: 'success', content: '', timestamp: '2025-07-13T10:00:01Z' }
      }
    } as any)

    await streamClaudeCodeResponse({
      prompt: 'Complex coding task',
      projectPath: '/Users/test/project',
      onMessage: vi.fn()
    })

    expect(query).toHaveBeenCalledWith({
      prompt: 'Complex coding task',
      abortController: expect.any(AbortController),
      options: {
        maxTurns: 10,
        cwd: '/Users/test/project'
      }
    })
  })

  it('should handle non-Error exceptions', async () => {
    const { query } = await import('@anthropic-ai/claude-code')
    
    vi.mocked(query).mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        throw 'String error'
      }
    } as any)

    const onMessage = vi.fn()

    await expect(streamClaudeCodeResponse({
      prompt: 'Test prompt',
      projectPath: '/test/path',
      onMessage
    })).rejects.toBe('String error')
  })

  it('should store events when memvaSessionId is provided', async () => {
    const { query } = await import('@anthropic-ai/claude-code')
    const { createEventFromMessage, storeEvent } = await import('../services/events.service')
    
    const mockMessages = [
      { type: 'thinking', content: 'Analyzing...', timestamp: '2025-07-14T10:00:01Z' },
      { type: 'assistant', content: 'Here is my response', timestamp: '2025-07-14T10:00:02Z' },
      { type: 'result', subtype: 'success', content: '', timestamp: '2025-07-14T10:00:03Z' }
    ]

    vi.mocked(query).mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        for (const message of mockMessages) {
          yield message
        }
      }
    } as any)

    // Mock event creation
    let eventIndex = 0
    vi.mocked(createEventFromMessage).mockImplementation(({ message }) => ({
      uuid: `event-${eventIndex++}`,
      session_id: 'session-123',
      event_type: message.type,
      timestamp: message.timestamp,
      is_sidechain: false,
      parent_uuid: eventIndex > 1 ? `event-${eventIndex - 2}` : null,
      cwd: '/test/path',
      project_name: 'path',
      data: message,
      memva_session_id: 'memva-session-456'
    }))

    const onMessage = vi.fn()

    await streamClaudeCodeResponse({
      prompt: 'Test prompt',
      projectPath: '/test/path',
      onMessage,
      sessionId: 'session-123',
      memvaSessionId: 'memva-session-456'
    })

    // Should create and store events for each message
    expect(createEventFromMessage).toHaveBeenCalledTimes(3)
    expect(storeEvent).toHaveBeenCalledTimes(3)

    // Check event creation calls
    expect(createEventFromMessage).toHaveBeenNthCalledWith(1, {
      message: mockMessages[0],
      sessionId: 'session-123',
      memvaSessionId: 'memva-session-456',
      projectPath: '/test/path',
      parentUuid: null
    })

    expect(createEventFromMessage).toHaveBeenNthCalledWith(2, {
      message: mockMessages[1],
      sessionId: 'session-123',
      memvaSessionId: 'memva-session-456',
      projectPath: '/test/path',
      parentUuid: 'event-0'
    })

    // Messages should still be passed to onMessage
    expect(onMessage).toHaveBeenCalledTimes(3)
  })

  it('should not store events when memvaSessionId is not provided', async () => {
    const { query } = await import('@anthropic-ai/claude-code')
    const { storeEvent } = await import('../services/events.service')
    
    vi.mocked(query).mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'assistant', content: 'Test', timestamp: '2025-07-14T10:00:01Z' }
      }
    } as any)

    const onMessage = vi.fn()

    await streamClaudeCodeResponse({
      prompt: 'Test prompt',
      projectPath: '/test/path',
      onMessage
    })

    expect(storeEvent).not.toHaveBeenCalled()
    expect(onMessage).toHaveBeenCalledTimes(1)
  })
})