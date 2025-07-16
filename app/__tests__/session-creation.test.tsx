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

// Mock Claude Code service to avoid external dependencies
vi.mock('../services/claude-code.service', () => ({
  sendPromptToClaudeCode: vi.fn()
}))

// Mock event session service
vi.mock('../db/event-session.service', () => ({
  getEventsForSession: vi.fn().mockResolvedValue([])
}))

describe('Session Creation', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should display a session creation input bar', async () => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader
      }
    ])

    render(<Stub />)

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/start a new claude code session/i)
      expect(input).toBeInTheDocument()
    })
  })

  it('should create a new session when Enter is pressed on title input', async () => {
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

    await waitFor(() => screen.getByPlaceholderText(/session title/i))
    
    const titleInput = screen.getByPlaceholderText(/session title/i)
    const promptInput = screen.getByPlaceholderText(/what would you like claude code to help/i)
    
    await user.type(promptInput, 'Help me fix authentication bug')
    await user.type(titleInput, 'Fix authentication bug{Enter}')

    // Should redirect to session page and display session details
    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('/Users/mbm-premva/dev/memva')).toBeInTheDocument()
    })
  })


  it('should not create session with empty input on Enter press', async () => {
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

    await waitFor(() => screen.getByPlaceholderText(/session title/i))

    const titleInput = screen.getByPlaceholderText(/session title/i)
    const promptInput = screen.getByPlaceholderText(/what would you like claude code to help/i)
    const button = screen.getByRole('button', { name: /start/i })
    
    await user.type(titleInput, 'Implement new feature')
    await user.type(promptInput, 'Help me implement a new feature')
    await user.click(button)

    // Should redirect to session page and display session details
    await waitFor(() => {
      expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      expect(screen.getByText('Status: active')).toBeInTheDocument()
      expect(screen.getByText('Project: /Users/mbm-premva/dev/memva')).toBeInTheDocument()
    })
  })

  it('should not create session with empty input', async () => {
    const user = userEvent.setup()
    
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader,
        action: homeAction
      }
    ])

    render(<Stub />)

    await waitFor(() => screen.getByRole('button', { name: /start/i }))

    const button = screen.getByRole('button', { name: /start/i })
    await user.click(button)

    // Should not redirect - stays on same page
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const titleInput = screen.getByPlaceholderText(/session title/i)
    expect(titleInput).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
  })

  it('should allow typing in the input fields', async () => {
    const user = userEvent.setup()
    
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader
      }
    ])

    render(<Stub />)

    await waitFor(() => screen.getByPlaceholderText(/session title/i))
    
    const titleInput = screen.getByPlaceholderText(/session title/i)
    const promptInput = screen.getByPlaceholderText(/what would you like claude code to help/i)
    
    await user.type(titleInput, 'Test session title')
    await user.type(promptInput, 'Test prompt')

    expect(titleInput).toHaveValue('Test session title')
    expect(promptInput).toHaveValue('Test prompt')
  })

  it('should disable Start button when inputs are empty', async () => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader
      }
    ])

    render(<Stub />)

    await waitFor(() => screen.getByRole('button', { name: /start/i }))
    
    const button = screen.getByRole('button', { name: /start/i })
    expect(button).toBeDisabled()
  })

  it('should enable Start button when both inputs have text', async () => {
    const user = userEvent.setup()
    
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader
      }
    ])

    render(<Stub />)

    await waitFor(() => screen.getByPlaceholderText(/session title/i))
    
    const titleInput = screen.getByPlaceholderText(/session title/i)
    const promptInput = screen.getByPlaceholderText(/what would you like claude code to help/i)
    const button = screen.getByRole('button', { name: /start/i })
    
    expect(button).toBeDisabled()
    
    await user.type(titleInput, 'Test session')
    expect(button).toBeDisabled() // Still disabled with only title
    
    await user.type(promptInput, 'Test prompt')
    expect(button).not.toBeDisabled() // Enabled with both fields
  })
})