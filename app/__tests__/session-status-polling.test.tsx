import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockSession } from '../test-utils/factories'
import { eq } from 'drizzle-orm'
import { sessions } from '../db/schema'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock React Router with proper mocking
const mockUseParams = vi.fn(() => ({ sessionId: 'test-session-id' }))
vi.mock('react-router', () => ({
  useParams: mockUseParams,
  useActionData: () => null,
  useNavigation: () => ({ state: 'idle' }),
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>
}))

describe('Session Status Polling Integration', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
    // Reset the mock to default session ID
    mockUseParams.mockReturnValue({ sessionId: 'test-session-id' })
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should disable submit button when status is processing', async () => {
    const session = createMockSession({
      id: 'test-session-id', // Match the mocked useParams
      claude_status: 'processing'
    })
    const createdSession = testDb.createSession(session)
    
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
    
    const submitButton = screen.getByRole('button', { name: /send/i })
    expect(submitButton).toBeDisabled()
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('should show error message when status is error', async () => {
    const session = createMockSession({
      id: 'test-session-id',
      claude_status: 'error'
    })
    testDb.createSession(session)
    
    const { default: SessionDetail } = await import('../routes/sessions.$sessionId')
    
    await act(async () => {
      render(<SessionDetail />)
    })
    
    await waitFor(() => {
      expect(screen.getByText(/an error occurred while processing/i)).toBeInTheDocument()
      expect(screen.getByText(/please try again/i)).toBeInTheDocument()
    })
  })

  it('should enable submit button for ready states', async () => {
    const readyStates = ['not_started', 'waiting_for_input', 'completed']
    
    for (const [index, status] of readyStates.entries()) {
      // Use unique session ID for each iteration
      const sessionId = `test-session-id-${index}`
      
      // Mock useParams to return the current session ID
      mockUseParams.mockReturnValue({ sessionId })
      
      const session = createMockSession({
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
        const submitButton = screen.getByRole('button', { name: /send/i })
        expect(submitButton).toBeEnabled()
      })
      
      act(() => {
        unmount()
      })
    }
  })

  it('should clear error status when new job is submitted', async () => {
    const session = createMockSession({
      id: 'test-session-id',
      claude_status: 'error'
    })
    testDb.createSession(session)
    
    const { default: SessionDetail } = await import('../routes/sessions.$sessionId')
    
    await act(async () => {
      render(<SessionDetail />)
    })
    
    // Should show error initially
    await waitFor(() => {
      expect(screen.getByText(/an error occurred while processing/i)).toBeInTheDocument()
    })
    
    // Submit new prompt
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: /send/i })
    
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'New prompt' } })
    })
    
    await act(async () => {
      fireEvent.click(submitButton)
      
      // Simulate the action updating the session status to processing
      // This mimics what the form action would do
      testDb.db.update(sessions).set({ claude_status: 'processing' }).where(eq(sessions.id, 'test-session-id')).run()
    })
    
    // Error message should be hidden after form submission and status change
    await waitFor(() => {
      expect(screen.queryByText(/an error occurred while processing/i)).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})