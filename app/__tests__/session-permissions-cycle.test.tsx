import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

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

// Mock the SettingsModal to avoid complexity
vi.mock('../components/SettingsModal', () => ({
  default: () => null
}))

import { loader } from '../routes/sessions.$sessionId'
import SessionDetail from '../routes/sessions.$sessionId'

describe('Session Permissions Cycling', () => {
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

  it('should display current permissions mode', async () => {
    // Create a session with specific permission mode
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })
    
    // Update session settings
    const { updateSessionSettings } = await import('../db/sessions.service')
    await updateSessionSettings(session.id, {
      maxTurns: 200,
      permissionMode: 'plan'
    })

    // Create router
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

    // Check for permissions badge
    const badge = await screen.findByRole('status', { name: /permissions mode/i })
    expect(badge).toHaveTextContent('Plan')
  })

  it('should cycle through permission modes on SHIFT+TAB', async () => {
    // Create a session
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })
    
    // Set initial mode to plan
    const { updateSessionSettings } = await import('../db/sessions.service')
    await updateSessionSettings(session.id, {
      maxTurns: 200,
      permissionMode: 'plan'
    })

    // Mock the fetch for settings update
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/session/') && url.includes('/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ maxTurns: 200, permissionMode: 'acceptEdits' })
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    // Create router
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

    // Find the badge
    const badge = await screen.findByRole('status', { name: /permissions mode/i })
    expect(badge).toHaveTextContent('Plan')

    // Press SHIFT+TAB
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true })

    // Should update to ACCEPT EDITS
    await waitFor(() => {
      expect(badge).toHaveTextContent('Accept Edits')
    })

    // Press SHIFT+TAB again
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true })

    // Should update to BYPASS PERMS
    await waitFor(() => {
      expect(badge).toHaveTextContent('Bypass Perms')
    })

    // Press SHIFT+TAB again to cycle back to PLAN
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true })

    await waitFor(() => {
      expect(badge).toHaveTextContent('Plan')
    })
  })

  it('should prevent default tab behavior when pressing SHIFT+TAB', async () => {
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })

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

    await screen.findByText('Test Session')

    // Create event with preventDefault spy
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    
    window.dispatchEvent(event)
    
    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should show updating state while saving', async () => {
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })

    // Mock a slow fetch
    global.fetch = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => {
        resolve({ ok: true, json: () => Promise.resolve({ maxTurns: 200, permissionMode: 'acceptEdits' }) })
      }, 100))
    )

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

    await screen.findByText('Test Session')

    // Press SHIFT+TAB
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true })

    // Should show updating state
    expect(await screen.findByText(/updating/i)).toBeInTheDocument()
  })
})