import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRoutesStub } from 'react-router'
import Home, { loader as homeLoader, action as homeAction } from '../routes/home'
import SessionDetail, { loader as sessionDetailLoader } from '../routes/sessions.$sessionId'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock external dependencies only
vi.mock('../services/claude-code.service', () => ({
  sendPromptToClaudeCode: vi.fn()
}))

// The event-session.service is already mocked by setupDatabaseMocks
// We just need to make sure the test database is set up correctly

describe('Homepage Initial Prompt Behavior', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should create session and show initial prompt on session page', async () => {
    const user = userEvent.setup()
    
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader,
        action: homeAction
      },
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader
      }
    ])

    render(<Stub />)

    // Wait for home page to load
    await waitFor(() => screen.getByPlaceholderText(/session title/i))
    
    // Enter title and prompt, then submit
    const titleInput = screen.getByPlaceholderText(/session title/i)
    const promptInput = screen.getByPlaceholderText(/what would you like claude code to help/i)
    
    await user.type(titleInput, 'Help me implement a new feature')
    await user.type(promptInput, 'I need help implementing a new feature')
    await user.click(screen.getByRole('button', { name: /start/i }))

    // Should navigate to session page and display the session with correct title
    await waitFor(() => {
      expect(screen.getByText('Help me implement a new feature')).toBeInTheDocument()
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('/Users/mbm-premva/dev/memva')).toBeInTheDocument()
    })
  })

  it('should handle session creation from homepage form via Enter key', async () => {
    const user = userEvent.setup()
    
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader,
        action: homeAction
      },
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader
      }
    ])

    render(<Stub />)

    // Wait for home page to load
    await waitFor(() => screen.getByPlaceholderText(/session title/i))
    
    // Enter prompt and submit with Enter key
    const input = screen.getByPlaceholderText(/start a new claude code session/i)
    await user.type(input, 'Create a React component{Enter}')

    // Should navigate to session page and display session details
    await waitFor(() => {
      expect(screen.getByText('Create a React component')).toBeInTheDocument()
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('/Users/mbm-premva/dev/memva')).toBeInTheDocument()
    })
  })

  it('should show session page with auto-start for new sessions', async () => {
    const user = userEvent.setup()
    
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader,
        action: homeAction
      },
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: sessionDetailLoader
      }
    ])

    render(<Stub />)

    // Wait for home page to load
    await waitFor(() => screen.getByPlaceholderText(/session title/i))
    
    // Create a new session
    const titleInput = screen.getByPlaceholderText(/session title/i)
    const promptInput = screen.getByPlaceholderText(/what would you like claude code to help/i)
    
    await user.type(titleInput, 'Test session')
    await user.type(promptInput, 'Test prompt')
    await user.click(screen.getByRole('button', { name: /start/i }))

    // Should show session page with session details
    await waitFor(() => {
      expect(screen.getByText('Test session')).toBeInTheDocument()
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('/Users/mbm-premva/dev/memva')).toBeInTheDocument()
    })
  })
})