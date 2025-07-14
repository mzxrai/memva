import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import SessionDetail from '../routes/sessions.$sessionId'
import type { Session } from '../db/schema'

// Mock the database service
vi.mock('../db/sessions.service', () => ({
  getSession: vi.fn(),
  listSessions: vi.fn(),
  getSessionWithStats: vi.fn(),
  createSession: vi.fn()
}))

// Mock the event service
vi.mock('../db/event-session.service', () => ({
  getEventsForSession: vi.fn()
}))

// Mock the Claude Code service
vi.mock('../services/claude-code.service', () => ({
  sendPromptToClaudeCode: vi.fn(),
  SDKMessage: {}
}))

describe('Session Detail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('should display session details', async () => {
    const mockSession: Session = {
      id: 'test-session-id',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/Users/mbm-premva/dev/memva',
      metadata: { description: 'Test session metadata' }
    }

    const { getSession } = await import('../db/sessions.service')
    vi.mocked(getSession).mockResolvedValue(mockSession)

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: mockSession })
      }
    ])

    render(<Stub initialEntries={['/sessions/test-session-id']} />)

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument()
      expect(screen.getByText('/Users/mbm-premva/dev/memva', { exact: false })).toBeInTheDocument()
      expect(screen.getByText('active', { exact: false })).toBeInTheDocument()
    })
  })

  it('should handle missing session', async () => {
    const { getSession } = await import('../db/sessions.service')
    vi.mocked(getSession).mockResolvedValue(null)

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: null })
      }
    ])

    render(<Stub initialEntries={['/sessions/invalid-id']} />)

    await waitFor(() => {
      expect(screen.getByText(/session not found/i)).toBeInTheDocument()
    })
  })

  it('should display prompt input form', async () => {
    const mockSession: Session = {
      id: 'test-session-id',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/Users/mbm-premva/dev/memva',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    vi.mocked(getSession).mockResolvedValue(mockSession)

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: mockSession })
      }
    ])

    render(<Stub initialEntries={['/sessions/test-session-id']} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask claude code/i)).toBeInTheDocument()
      expect(screen.getByText(/send/i)).toBeInTheDocument()
    })
  })

  it('should send prompt to Claude Code and display messages', async () => {
    const mockSession: Session = {
      id: 'test-session-id',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/Users/mbm-premva/dev/memva',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    const { sendPromptToClaudeCode } = await import('../services/claude-code.service')
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    // Mock Claude Code to simulate streaming messages
    vi.mocked(sendPromptToClaudeCode).mockImplementation(({ onMessage }) => {
      // Simulate async streaming
      setTimeout(() => {
        onMessage({ type: 'assistant', content: 'Test response', timestamp: '2025-07-13T10:00:01Z' })
        onMessage({ type: 'result', content: '', timestamp: '2025-07-13T10:00:02Z' })
      }, 0)
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: mockSession })
      }
    ])

    render(<Stub initialEntries={['/sessions/test-session-id']} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask claude code/i)).toBeInTheDocument()
    })

    // Type a prompt and submit
    const input = screen.getByPlaceholderText(/ask claude code/i)
    const sendButton = screen.getByText(/send/i)

    fireEvent.change(input, { target: { value: 'Test prompt' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText(/"content": "Test prompt"/)).toBeInTheDocument()
      expect(screen.getByText(/"content": "Test response"/)).toBeInTheDocument()
    })

    expect(sendPromptToClaudeCode).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      sessionId: 'test-session-id',
      onMessage: expect.any(Function),
      onError: expect.any(Function),
      signal: expect.any(AbortSignal)
    })
  })

  it('should display streaming messages in real-time', async () => {
    const mockSession: Session = {
      id: 'test-session-id',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/Users/mbm-premva/dev/memva',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    const { sendPromptToClaudeCode } = await import('../services/claude-code.service')
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    // Mock Claude Code to simulate streaming with different message types
    vi.mocked(sendPromptToClaudeCode).mockImplementation(({ onMessage }) => {
      setTimeout(() => {
        onMessage({ type: 'thinking', content: 'Analyzing the request...', timestamp: '2025-07-13T10:00:01Z' })
        onMessage({ type: 'tool_use', content: '{"name": "file_read", "input": {"path": "app.tsx"}}', timestamp: '2025-07-13T10:00:02Z' })
        onMessage({ type: 'assistant', content: 'I can help you with that feature', timestamp: '2025-07-13T10:00:03Z' })
        onMessage({ type: 'result', content: '', timestamp: '2025-07-13T10:00:04Z' })
      }, 0)
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: mockSession })
      }
    ])

    render(<Stub initialEntries={['/sessions/test-session-id']} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask claude code/i)).toBeInTheDocument()
    })

    // Submit a prompt
    const input = screen.getByPlaceholderText(/ask claude code/i)
    const sendButton = screen.getByText(/send/i)

    fireEvent.change(input, { target: { value: 'Help me implement a feature' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText(/"content": "Help me implement a feature"/)).toBeInTheDocument()
      expect(screen.getByText(/"content": "Analyzing the request..."/)).toBeInTheDocument()
      expect(screen.getByText(/file_read/)).toBeInTheDocument()
      expect(screen.getByText(/"content": "I can help you with that feature"/)).toBeInTheDocument()
    })
  })

  it('should show stop button while loading and allow aborting', async () => {
    const mockSession: Session = {
      id: 'test-session-id',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/Users/mbm-premva/dev/memva',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    const { sendPromptToClaudeCode } = await import('../services/claude-code.service')
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    let capturedSignal: AbortSignal | undefined
    
    // Mock Claude Code to capture the abort signal and simulate ongoing messages
    vi.mocked(sendPromptToClaudeCode).mockImplementation(({ signal, onMessage, onError }) => {
      capturedSignal = signal
      
      // Simulate multiple messages being sent over time
      const messages = [
        { type: 'thinking', content: 'Processing...', timestamp: '2025-07-13T10:00:01Z' },
        { type: 'assistant', content: 'Starting analysis...', timestamp: '2025-07-13T10:00:02Z' },
        { type: 'tool_use', content: 'Reading files...', timestamp: '2025-07-13T10:00:03Z' },
        { type: 'assistant', content: 'This should not appear if aborted', timestamp: '2025-07-13T10:00:04Z' }
      ]
      
      let messageIndex = 0
      const intervalId = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(intervalId)
          // Simulate the actual error we see in the browser
          onError?.(new Error('BodyStreamBuffer was aborted'))
          return
        }
        
        if (messageIndex < messages.length) {
          onMessage(messages[messageIndex])
          messageIndex++
        }
      }, 50)
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: mockSession })
      }
    ])

    render(<Stub initialEntries={['/sessions/test-session-id']} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask claude code/i)).toBeInTheDocument()
    })

    // Type a prompt and submit
    const input = screen.getByPlaceholderText(/ask claude code/i)
    const sendButton = screen.getByText(/send/i)

    fireEvent.change(input, { target: { value: 'Long running task' } })
    fireEvent.click(sendButton)

    // Stop button should appear
    await waitFor(() => {
      expect(screen.getByText(/stop/i)).toBeInTheDocument()
    })

    // Wait for at least one message to appear
    await waitFor(() => {
      expect(screen.getByText(/"content": "Processing..."/)).toBeInTheDocument()
    })

    // Click stop button
    const stopButton = screen.getByText(/stop/i)
    fireEvent.click(stopButton)

    // Verify abort signal was triggered
    expect(capturedSignal?.aborted).toBe(true)

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(/"content": "Error: BodyStreamBuffer was aborted"/)).toBeInTheDocument()
    })

    // Verify that later messages did NOT appear
    expect(screen.queryByText(/"content": "This should not appear if aborted"/)).not.toBeInTheDocument()

    // Send button should reappear (but still disabled because input is empty)
    await waitFor(() => {
      const sendButton = screen.getByText(/send/i)
      expect(sendButton).toBeInTheDocument()
      // Stop button should be gone
      expect(screen.queryByText(/stop/i)).not.toBeInTheDocument()
    })

    // Wait a bit more to ensure no more messages arrive
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(screen.queryByText(/"content": "This should not appear if aborted"/)).not.toBeInTheDocument()
  })

  it('should load and display historical events on mount', async () => {
    const mockSession: Session = {
      id: 'test-session-id',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/Users/mbm-premva/dev/memva',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    const { getEventsForSession } = await import('../db/event-session.service')
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    // Mock historical events
    const mockEvents = [
      {
        uuid: 'event-1',
        session_id: 'claude-session-123',
        event_type: 'user',
        timestamp: '2025-07-13T10:00:00Z',
        is_sidechain: false,
        parent_uuid: null,
        cwd: '/Users/mbm-premva/dev/memva',
        project_name: 'memva',
        data: { type: 'user', content: 'Previous question', timestamp: '2025-07-13T10:00:00Z' },
        memva_session_id: 'test-session-id'
      },
      {
        uuid: 'event-2',
        session_id: 'claude-session-123',
        event_type: 'assistant',
        timestamp: '2025-07-13T10:00:01Z',
        is_sidechain: false,
        parent_uuid: 'event-1',
        cwd: '/Users/mbm-premva/dev/memva',
        project_name: 'memva',
        data: { type: 'assistant', content: 'Previous answer', timestamp: '2025-07-13T10:00:01Z' },
        memva_session_id: 'test-session-id'
      }
    ]
    
    vi.mocked(getEventsForSession).mockResolvedValue(mockEvents)

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async ({ params }) => {
          const session = await getSession(params.sessionId!)
          const events = await getEventsForSession(params.sessionId!)
          return { session, events }
        }
      }
    ])

    render(<Stub initialEntries={['/sessions/test-session-id']} />)

    await waitFor(() => {
      // Should display historical events
      expect(screen.getByText(/"content": "Previous question"/)).toBeInTheDocument()
      expect(screen.getByText(/"content": "Previous answer"/)).toBeInTheDocument()
    })

    // Should have called getEventsForSession
    expect(getEventsForSession).toHaveBeenCalledWith('test-session-id')
  })

  it('should disable input and send button during processing', async () => {
    const mockSession: Session = {
      id: 'test-session-id',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/Users/mbm-premva/dev/memva',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    const { sendPromptToClaudeCode } = await import('../services/claude-code.service')
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    // Mock Claude Code to simulate processing
    vi.mocked(sendPromptToClaudeCode).mockImplementation(({ onMessage }) => {
      setTimeout(() => {
        onMessage({ type: 'thinking', content: 'Processing...', timestamp: '2025-07-13T10:00:01Z' })
      }, 50)
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: mockSession })
      }
    ])

    render(<Stub initialEntries={['/sessions/test-session-id']} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask claude code/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/ask claude code/i) as HTMLInputElement
    const sendButton = screen.getByText(/send/i) as HTMLButtonElement

    // Input should be enabled initially, button disabled (no text)
    expect(input.disabled).toBe(false)
    expect(sendButton.disabled).toBe(true)

    // Submit a prompt
    fireEvent.change(input, { target: { value: 'Test prompt' } })
    fireEvent.click(sendButton)

    // Input and send button should be disabled during processing
    await waitFor(() => {
      expect(input.disabled).toBe(true)
      expect(screen.getByText(/stop/i)).toBeInTheDocument()
    })
  })

  it('should keep input area visible when messages overflow', async () => {
    const mockSession: Session = {
      id: 'test-session-id',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/Users/mbm-premva/dev/memva',
      metadata: null
    }

    const { getSession } = await import('../db/sessions.service')
    const { sendPromptToClaudeCode } = await import('../services/claude-code.service')
    
    vi.mocked(getSession).mockResolvedValue(mockSession)
    
    // Mock Claude Code to send many messages
    vi.mocked(sendPromptToClaudeCode).mockImplementation(({ onMessage }) => {
      // Send many messages to cause overflow
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          onMessage({ 
            type: 'assistant', 
            content: `Message ${i + 1}: This is a long message that will cause the page to scroll. `.repeat(5), 
            timestamp: new Date().toISOString() 
          })
        }, i * 10)
      }
      
      setTimeout(() => {
        onMessage({ type: 'result', content: '', timestamp: new Date().toISOString() })
      }, 250)
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: mockSession })
      }
    ])

    render(<Stub initialEntries={['/sessions/test-session-id']} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask claude code/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/ask claude code/i)
    const sendButton = screen.getByText(/send/i)

    // Submit a prompt
    fireEvent.change(input, { target: { value: 'Generate many messages' } })
    fireEvent.click(sendButton)

    // Wait for messages to appear
    await waitFor(() => {
      expect(screen.getByText(/Message 1:/)).toBeInTheDocument()
    })

    // Input and button should still be visible and in the document
    // Note: We can't test actual visibility/positioning in jsdom, but we can verify they're in the DOM
    expect(screen.getByPlaceholderText(/ask claude code/i)).toBeInTheDocument()
    
    // During loading, stop button should be present
    expect(screen.getByText(/stop/i)).toBeInTheDocument()
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/send/i)).toBeInTheDocument()
    }, { timeout: 500 })
  })
})