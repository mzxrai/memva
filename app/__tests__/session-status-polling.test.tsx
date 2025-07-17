import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockNewSession } from '../test-utils/factories'
import { eq } from 'drizzle-orm'
import { sessions } from '../db/schema'
import { useLoaderData, useParams } from 'react-router'

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
      session: createdSession,
      events: []
    })

    // Verify session was created in test db
    expect(testDb.getSession('test-session-id')).toBeTruthy()
    console.log('Created session:', createdSession)

    const { default: SessionDetail } = await import('../routes/sessions.$sessionId')

    await act(async () => {
      render(<SessionDetail />)
    })

    // Wait for async hooks to load session data
    await waitFor(() => {
      expect(screen.queryByText('Session not found')).not.toBeInTheDocument()
    })

    const promptInput = screen.getByRole('textbox')
    expect(promptInput).toBeDisabled()
    expect(promptInput).toHaveAttribute('placeholder', 'Processing...')
  })

  it('should show error message when status is error', async () => {
    const session = createMockNewSession({
      id: 'test-session-id',
      claude_status: 'error'
    })
    const createdSession = testDb.createSession(session)

    // Mock useLoaderData to return the test session
    vi.mocked(useLoaderData).mockReturnValue({
      session: createdSession,
      events: []
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

    for (const [index, status] of readyStates.entries()) {
      // Use fixed session ID
      const sessionId = 'test-session-id'

      const session = createMockNewSession({
        id: sessionId,
        claude_status: status as any
      })
      testDb.createSession(session)

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
      session: createdSession,
      events: []
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
      fireEvent.submit(promptInput.closest('form')!)

      // Simulate the action updating the session status to processing
      // This mimics what the form action would do
      testDb.db.update(sessions).set({ claude_status: 'processing' }).where(eq(sessions.id, 'test-session-id')).run()
    })

    // Error message should be hidden after form submission and status change
    await waitFor(() => {
      expect(screen.queryByText('An error occurred while processing your request. Please try again.')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})