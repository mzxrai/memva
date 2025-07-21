import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { expectInteraction } from '../test-utils/component-testing'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock the SettingsModal component
vi.mock('../components/SettingsModal', () => ({
  default: ({ isOpen, onClose, mode, sessionId }: any) => 
    isOpen ? (
      <div role="dialog" aria-label="Settings Modal">
        <p>Mode: {mode}</p>
        <p>Session ID: {sessionId}</p>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
}))

// Mock the SSE hook
vi.mock('../hooks/useSSEEvents', () => ({
  useSSEEvents: () => ({ newEvents: [], sessionStatus: null })
}))

// Mock the green line indicator hook
vi.mock('../hooks/useGreenLineIndicator', () => ({
  useGreenLineIndicator: () => ({
    isGreenLine: vi.fn(() => false),
    setLastGreenEvent: vi.fn(),
    clearGreenForSession: vi.fn()
  })
}))

import { loader } from '../routes/sessions.$sessionId'
import SessionDetail from '../routes/sessions.$sessionId'

describe('Session Detail Settings Button', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
    vi.clearAllMocks()
  })

  it('should display settings button in header', async () => {
    // Create a test session
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })

    // Create router with our session route
    const router = createMemoryRouter([
      {
        path: '/sessions/:sessionId',
        element: <SessionDetail />,
        loader
      }
    ], {
      initialEntries: [`/sessions/${session.id}`]
    })

    render(<RouterProvider router={router} />)

    // Wait for session to load
    await screen.findByText('Test Session')

    // Check for settings button
    const settingsButton = await screen.findByRole('button', { name: /settings/i })
    expect(settingsButton).toBeInTheDocument()
    expectInteraction.clickable(settingsButton)
  })

  it('should open settings modal when settings button is clicked', async () => {
    // Create a test session
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })

    // Create router with our session route
    const router = createMemoryRouter([
      {
        path: '/sessions/:sessionId',
        element: <SessionDetail />,
        loader
      }
    ], {
      initialEntries: [`/sessions/${session.id}`]
    })

    render(<RouterProvider router={router} />)

    // Wait for session to load
    await screen.findByText('Test Session')

    // Click settings button
    const settingsButton = await screen.findByRole('button', { name: /settings/i })
    fireEvent.click(settingsButton)

    // Check that modal is open
    const modal = await screen.findByRole('dialog', { name: 'Settings Modal' })
    expect(modal).toBeInTheDocument()
    
    // Check modal props
    expect(screen.getByText('Mode: session')).toBeInTheDocument()
    expect(screen.getByText(`Session ID: ${session.id}`)).toBeInTheDocument()
  })

  it('should close settings modal when close is triggered', async () => {
    // Create a test session
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })

    // Create router with our session route
    const router = createMemoryRouter([
      {
        path: '/sessions/:sessionId',
        element: <SessionDetail />,
        loader
      }
    ], {
      initialEntries: [`/sessions/${session.id}`]
    })

    render(<RouterProvider router={router} />)

    // Wait for session to load
    await screen.findByText('Test Session')

    // Open modal
    const settingsButton = await screen.findByRole('button', { name: /settings/i })
    fireEvent.click(settingsButton)

    // Check modal is open
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Close modal
    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    // Check modal is closed
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})