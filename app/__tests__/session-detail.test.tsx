import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRoutesStub } from 'react-router'
import SessionDetail, { loader as sessionDetailLoader } from '../routes/sessions.$sessionId'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)
import type { Session } from '../db/schema'

// Mock external dependencies only
vi.mock('../services/claude-code.service', () => ({
  sendPromptToClaudeCode: vi.fn(),
  SDKMessage: {}
}))

vi.mock('../db/event-session.service', () => ({
  getEventsForSession: vi.fn().mockResolvedValue([])
}))

describe('Session Detail Page', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
    vi.clearAllMocks()
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })
  it('should display session details', async () => {
    // Create a real session in the test database
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/Users/mbm-premva/dev/memva'
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader as any
      }
    ])

    render(<Stub initialEntries={[`/sessions/${session.id}`]} />)

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument()
      expect(screen.getByText('/Users/mbm-premva/dev/memva', { exact: false })).toBeInTheDocument()
      expect(screen.getByText('active', { exact: false })).toBeInTheDocument()
    })
  })

  it('should handle missing session', async () => {
    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader as any
      }
    ])

    render(<Stub initialEntries={['/sessions/invalid-id']} />)

    await waitFor(() => {
      expect(screen.getByText(/session not found/i)).toBeInTheDocument()
    })
  })

  it('should display prompt input form', async () => {
    // Create a session without auto-start metadata
    const session = testDb.createSession({
      title: undefined,
      project_path: '/Users/mbm-premva/dev/memva'
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader as any
      }
    ])

    render(<Stub initialEntries={[`/sessions/${session.id}`]} />)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByText(/send/i)).toBeInTheDocument()
    })
  })

  it('should send prompt to Claude Code and display messages', async () => {
    const user = userEvent.setup()
    
    // Create a session with title to display
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/Users/mbm-premva/dev/memva'
    })

    const { sendPromptToClaudeCode } = await import('../services/claude-code.service')
    
    // Mock Claude Code to simulate streaming messages
    vi.mocked(sendPromptToClaudeCode).mockImplementation(({ prompt, onMessage }) => {
      setTimeout(() => {
        onMessage({ type: 'user', content: prompt, timestamp: '2025-07-13T10:00:00Z' })
        onMessage({ type: 'assistant', content: 'Test response', timestamp: '2025-07-13T10:00:01Z' })
        onMessage({ type: 'result', content: '', timestamp: '2025-07-13T10:00:02Z' })
      }, 0)
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader as any
      }
    ])

    render(<Stub initialEntries={[`/sessions/${session.id}`]} />)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    // Type a prompt and submit
    const input = screen.getByRole('textbox')
    const sendButton = screen.getByText(/send/i)

    await user.type(input, 'Test prompt')
    await user.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText("Test prompt")).toBeInTheDocument()
      expect(screen.getByText("Test response")).toBeInTheDocument()
    })

    expect(sendPromptToClaudeCode).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      sessionId: session.id,
      onMessage: expect.any(Function),
      onError: expect.any(Function),
      signal: expect.any(AbortSignal)
    })
  })

  it('should display streaming messages in real-time', async () => {
    const user = userEvent.setup()
    
    // Create session without auto-start
    const session = testDb.createSession({
      title: undefined,
      project_path: '/Users/mbm-premva/dev/memva'
    })

    const { sendPromptToClaudeCode } = await import('../services/claude-code.service')
    
    // Mock Claude Code to simulate streaming with different message types
    vi.mocked(sendPromptToClaudeCode).mockImplementation(({ prompt, onMessage }) => {
      setTimeout(() => {
        onMessage({ type: 'user', content: prompt, timestamp: '2025-07-13T10:00:00Z' })
        onMessage({ 
          type: 'assistant', 
          content: 'Analyzing the request...',
          timestamp: '2025-07-13T10:00:01Z' 
        })
        onMessage({ 
          type: 'system', 
          content: 'file_read',
          timestamp: '2025-07-13T10:00:02Z' 
        })
        onMessage({ type: 'assistant', content: 'I can help you with that feature', timestamp: '2025-07-13T10:00:03Z' })
        onMessage({ type: 'result', content: '', timestamp: '2025-07-13T10:00:04Z' })
      }, 0)
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader as any
      }
    ])

    render(<Stub initialEntries={[`/sessions/${session.id}`]} />)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    // Submit a prompt
    const input = screen.getByRole('textbox')
    const sendButton = screen.getByText(/send/i)

    await user.type(input, 'Help me implement a feature')
    await user.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText("Help me implement a feature")).toBeInTheDocument()
      expect(screen.getByText("Analyzing the request...")).toBeInTheDocument()
      expect(screen.getByText(/file_read/)).toBeInTheDocument()
      expect(screen.getByText("I can help you with that feature")).toBeInTheDocument()
    })
  })

  it('should show stop button while loading and allow aborting', async () => {
    const user = userEvent.setup()
    
    // Create session without auto-start
    const session = testDb.createSession({
      title: undefined,
      project_path: '/Users/mbm-premva/dev/memva'
    })

    const { sendPromptToClaudeCode } = await import('../services/claude-code.service')
    
    let capturedSignal: AbortSignal | undefined
    
    // Mock Claude Code to capture the abort signal
    vi.mocked(sendPromptToClaudeCode).mockImplementation(({ prompt, signal, onMessage, onError }) => {
      capturedSignal = signal
      
      onMessage({ type: 'user', content: prompt, timestamp: '2025-07-13T10:00:00Z' })
      onMessage({ type: 'system', content: 'Processing...', timestamp: '2025-07-13T10:00:01Z' })
      
      // Simulate ongoing processing that can be aborted
      const timeoutId = setTimeout(() => {
        if (signal?.aborted) {
          onError?.(new Error('BodyStreamBuffer was aborted'))
        }
      }, 100)
      
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
          onError?.(new Error('BodyStreamBuffer was aborted'))
        })
      }
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader as any
      }
    ])

    render(<Stub initialEntries={[`/sessions/${session.id}`]} />)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    // Type a prompt and submit
    const input = screen.getByRole('textbox')
    const sendButton = screen.getByText(/send/i)

    await user.type(input, 'Long running task')
    await user.click(sendButton)

    // Stop button should appear
    await waitFor(() => {
      expect(screen.getByText(/stop/i)).toBeInTheDocument()
    })

    // Wait for processing message to appear
    await waitFor(() => {
      expect(screen.getByText("Processing...")).toBeInTheDocument()
    })

    // Click stop button
    const stopButton = screen.getByText(/stop/i)
    await user.click(stopButton)

    // Verify abort signal was triggered
    expect(capturedSignal?.aborted).toBe(true)

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText("Error: BodyStreamBuffer was aborted")).toBeInTheDocument()
    })

    // Send button should reappear
    await waitFor(() => {
      expect(screen.getByText(/send/i)).toBeInTheDocument()
      expect(screen.queryByText(/stop/i)).not.toBeInTheDocument()
    })
  })

  it('should load and display historical events on mount', async () => {
    // Create session without auto-start
    const session = testDb.createSession({
      title: undefined,
      project_path: '/Users/mbm-premva/dev/memva'
    })

    const { getEventsForSession } = await import('../db/event-session.service')
    
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
        memva_session_id: session.id
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
        memva_session_id: session.id
      }
    ]
    
    vi.mocked(getEventsForSession).mockResolvedValue(mockEvents)

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader as any
      }
    ])

    render(<Stub initialEntries={[`/sessions/${session.id}`]} />)

    await waitFor(() => {
      // Should display historical events
      expect(screen.getByText("Previous question")).toBeInTheDocument()
      expect(screen.getByText("Previous answer")).toBeInTheDocument()
    })

    // Should have called getEventsForSession
    expect(getEventsForSession).toHaveBeenCalledWith(session.id)
  })

  it('should disable input and show stop button during processing', async () => {
    const user = userEvent.setup()
    
    // Create session without auto-start
    const session = testDb.createSession({
      title: undefined,
      project_path: '/Users/mbm-premva/dev/memva'
    })

    const { sendPromptToClaudeCode } = await import('../services/claude-code.service')
    
    // Mock Claude Code to simulate processing
    vi.mocked(sendPromptToClaudeCode).mockImplementation(({ prompt, onMessage }) => {
      setTimeout(() => {
        onMessage({ type: 'user', content: prompt, timestamp: '2025-07-13T10:00:00Z' })
        onMessage({ type: 'system', content: 'Processing...', timestamp: '2025-07-13T10:00:01Z' })
      }, 50)
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader as any
      }
    ])

    render(<Stub initialEntries={[`/sessions/${session.id}`]} />)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    const input = screen.getByRole('textbox') as HTMLInputElement
    const sendButton = screen.getByText(/send/i) as HTMLButtonElement

    // Input should be enabled initially, button disabled (no text)
    expect(input.disabled).toBe(false)
    expect(sendButton.disabled).toBe(true)

    // Submit a prompt
    await user.type(input, 'Test prompt')
    await user.click(sendButton)

    // Input should be disabled and stop button should appear during processing
    await waitFor(() => {
      expect(input.disabled).toBe(true)
      expect(screen.getByText(/stop/i)).toBeInTheDocument()
    })
  })

  it('should show empty state for new sessions', async () => {
    // Create session without auto-start
    const session = testDb.createSession({
      title: undefined,
      project_path: '/Users/mbm-premva/dev/memva'
    })

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader as any
      }
    ])

    render(<Stub initialEntries={[`/sessions/${session.id}`]} />)

    await waitFor(() => {
      expect(screen.getByText('No messages yet. Start by asking Claude Code something!')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByText(/send/i)).toBeInTheDocument()
    })
  })

})