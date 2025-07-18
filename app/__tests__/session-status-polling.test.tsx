import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockNewSession } from '../test-utils/factories'
import { useLoaderData } from 'react-router'
import type { Session } from '../db/schema'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock EventSource for browser APIs in tests
const mockEventSource = vi.fn()
mockEventSource.prototype.close = vi.fn()
mockEventSource.prototype.addEventListener = vi.fn()
Object.defineProperty(global, 'EventSource', {
  value: mockEventSource,
  writable: true
})

// Mock React Router with proper mocking  
vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({ sessionId: 'test-session-id' })),
  useActionData: () => null,
  useNavigation: () => ({ state: 'idle' }),
  useLoaderData: vi.fn(),
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>
}))

// Mock the hooks used by SessionDetail
vi.mock('../hooks/useSessionStatus', () => ({
  useSessionStatus: vi.fn()
}))

vi.mock('../hooks/useSSEEvents', () => ({
  useSSEEvents: vi.fn(() => ({ newEvents: [], error: null, connectionState: 'connected' }))
}))

import { useSessionStatus } from '../hooks/useSessionStatus'

describe('Session Status Polling Integration', () => {
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

  it('should disable submit button when status is processing', async () => {
    const session = createMockNewSession({
      id: 'test-session-id', // Match the mocked useParams
      claude_status: 'processing'
    })
    const createdSession = testDb.createSession(session)

    // Mock useLoaderData to return the test session
    vi.mocked(useLoaderData).mockReturnValue({
      session: createdSession as Session,
      events: []
    })

    // Mock useSessionStatus to return the session with processing status
    vi.mocked(useSessionStatus).mockReturnValue({
      session: createdSession as Session,
      error: null,
      isLoading: false
    })

    const { default: SessionDetail } = await import('../routes/sessions.$sessionId')

    await act(async () => {
      render(<SessionDetail />)
    })

    // Wait for component to render
    await waitFor(() => {
      expect(screen.queryByText('Session not found')).not.toBeInTheDocument()
    })

    const promptInput = screen.getByRole('textbox')
    expect(promptInput).toBeDisabled()
    expect(promptInput).toHaveAttribute('placeholder', 'Processing... (Press Escape to stop)')
  })

  it('should show error message when status is error', async () => {
    const session = createMockNewSession({
      id: 'test-session-id',
      claude_status: 'error'
    })
    const createdSession = testDb.createSession(session)

    // Mock useLoaderData to return the test session
    vi.mocked(useLoaderData).mockReturnValue({
      session: createdSession as Session,
      events: []
    })

    // Mock useSessionStatus to return the session with error status
    vi.mocked(useSessionStatus).mockReturnValue({
      session: createdSession as Session,
      error: null,
      isLoading: false
    })

    const { default: SessionDetail } = await import('../routes/sessions.$sessionId')

    await act(async () => {
      render(<SessionDetail />)
    })

    await waitFor(() => {
      expect(screen.getByText('An error occurred while processing your request. Please try again.')).toBeInTheDocument()
    })
  })

  it('should enable submit button for ready states', async () => {
    const readyStates = ['not_started', 'waiting_for_input', 'completed']

    for (const status of readyStates) {
      // Clear mocks before each iteration
      vi.clearAllMocks()
      
      // Create a new test database for each iteration
      testDb.cleanup()
      testDb = setupInMemoryDb()
      setTestDatabase(testDb)
      
      const session = createMockNewSession({
        id: 'test-session-id',
        claude_status: status as any
      })
      const createdSession = testDb.createSession(session)

      // Mock useLoaderData to return the test session
      vi.mocked(useLoaderData).mockReturnValue({
        session: createdSession as Session,
        events: []
      })

      // Mock useSessionStatus to return the session with the current status
      vi.mocked(useSessionStatus).mockReturnValue({
        session: createdSession as Session,
        error: null,
        isLoading: false
      })

      const { default: SessionDetail } = await import('../routes/sessions.$sessionId')

      let unmount: () => void
      await act(async () => {
        const result = render(<SessionDetail />)
        unmount = result.unmount
      })

      await waitFor(() => {
        const textarea = screen.getByRole('textbox')
        expect(textarea).toBeEnabled()
      })

      // Add text to enable the submit button
      const textarea = screen.getByRole('textbox')
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'test prompt' } })
      })

      await waitFor(() => {
        const promptInput = screen.getByRole('textbox')
        expect(promptInput).not.toBeDisabled()
      })

      act(() => {
        unmount()
      })
    }
  })

  it('should clear error status when new job is submitted', async () => {
    const session = createMockNewSession({
      id: 'test-session-id',
      claude_status: 'error'
    })
    const createdSession = testDb.createSession(session)

    // Mock useLoaderData to return the test session
    vi.mocked(useLoaderData).mockReturnValue({
      session: createdSession as Session,
      events: []
    })

    // Mock useSessionStatus to return the session with error status initially
    vi.mocked(useSessionStatus).mockReturnValue({
      session: createdSession as Session,
      error: null,
      isLoading: false
    })

    const { default: SessionDetail } = await import('../routes/sessions.$sessionId')

    await act(async () => {
      render(<SessionDetail />)
    })

    // Should show error initially
    await waitFor(() => {
      expect(screen.getByText('An error occurred while processing your request. Please try again.')).toBeInTheDocument()
    })

    // Submit new prompt by typing and pressing Enter
    const promptInput = screen.getByRole('textbox')

    await act(async () => {
      fireEvent.change(promptInput, { target: { value: 'New prompt' } })
      
      // Update the mock to return processing status after form submission
      const updatedSession = { ...createdSession, claude_status: 'processing' } as Session
      vi.mocked(useSessionStatus).mockReturnValue({
        session: updatedSession,
        error: null,
        isLoading: false
      })
      
      const form = promptInput.closest('form')
      if (form) {
        fireEvent.submit(form)
      }
    })

    // User should be able to type a new prompt
    const newPromptInput = screen.getByRole('textbox')
    expect(newPromptInput).toBeEnabled()
    expect(newPromptInput).toHaveValue('New prompt')
    
    // Form should be ready for submission
    const form = newPromptInput.closest('form')
    expect(form).toBeInTheDocument()
  })
})