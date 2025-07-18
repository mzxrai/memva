import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '../routes/home'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock external dependencies only
vi.mock('../services/claude-code.service', () => ({
  sendPromptToClaudeCode: vi.fn()
}))

// Mock job creation
vi.mock('../db/jobs.service', () => ({
  createJob: vi.fn().mockResolvedValue({ id: 'test-job-id' })
}))

vi.mock('../workers/job-types', () => ({
  createSessionRunnerJob: vi.fn((data) => ({
    type: 'session-runner',
    data,
    priority: 8
  }))
}))

// Mock the hooks used by SessionDetail
vi.mock('../hooks/useSessionStatus', () => ({
  useSessionStatus: vi.fn(() => ({ 
    session: null, 
    error: null, 
    isLoading: false 
  }))
}))

vi.mock('../hooks/useEventPolling', () => ({
  useEventPolling: vi.fn(() => ({ 
    events: [], 
    error: null, 
    isPolling: false 
  }))
}))

vi.mock('../hooks/useSSEEvents', () => ({
  useSSEEvents: vi.fn(() => ({ 
    newEvents: [], 
    error: null, 
    connectionState: 'connected' 
  }))
}))

// Mock React Router for component testing
vi.mock('react-router', () => ({
  useLoaderData: vi.fn(() => ({ sessions: [] })),
  Form: ({ children, onSubmit, ...props }: any) => (
    <form onSubmit={onSubmit} {...props}>
      {children}
    </form>
  ),
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  redirect: vi.fn()
}))

describe('Homepage Initial Prompt Behavior', () => {
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

  it('should accept user input for creating new sessions', async () => {
    const user = userEvent.setup()
    
    render(<Home />)

    // User should see the input field
    const input = screen.getByPlaceholderText(/start a new claude code session/i)
    expect(input).toBeInTheDocument()
    
    // User should be able to type into it
    await user.type(input, 'Help me implement a new feature')
    expect(input).toHaveValue('Help me implement a new feature')
  })

  it('should show empty state when no sessions exist', () => {
    render(<Home />)
    
    // User should see empty state messaging
    expect(screen.getByText('No sessions yet')).toBeInTheDocument()
    expect(screen.getByText(/Start working with Claude Code/)).toBeInTheDocument()
  })

  it('should require input before submitting', async () => {
    const user = userEvent.setup()
    
    render(<Home />)

    const input = screen.getByPlaceholderText(/start a new claude code session/i)
    
    // Try to submit empty form
    await user.type(input, '{Enter}')
    
    // Form should not submit when empty (input remains visible)
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('')
  })
})