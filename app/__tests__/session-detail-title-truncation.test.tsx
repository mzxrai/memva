import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { expectSemanticMarkup } from '../test-utils/component-testing'

// Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock MSW server (already configured for Claude Code API)
import '../test-utils/msw-server'

// Import after mocks are set up
import SessionDetail, { loader } from '../routes/sessions.$sessionId'

// Mock the SSE hooks to prevent real-time updates in tests
vi.mock('../hooks/useSSEEvents', () => ({
  useSSEEvents: () => ({ newEvents: [], sessionStatus: null })
}))

vi.mock('../hooks/useMessageTracking', () => ({
  useSessionActivity: () => ({})
}))

describe('Session Detail Title Display', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  const renderSessionDetail = async (sessionId: string) => {
    const routes = [
      {
        path: '/sessions/:sessionId',
        element: <SessionDetail />,
        loader
      }
    ]

    const router = createMemoryRouter(routes, {
      initialEntries: [`/sessions/${sessionId}`],
    })

    render(<RouterProvider router={router} />)
    
    // Wait for loader to complete
    await screen.findByRole('heading', { level: 1 })
  }

  it('should display long session titles with proper tooltip', async () => {
    const longTitle = 'This is a very long session title that should be truncated when displayed in the session detail page to prevent layout issues and maintain a clean interface'
    const session = testDb.createSession({
      title: longTitle,
      project_path: '/test/project'
    })

    await renderSessionDetail(session.id)

    // Verify title is displayed
    expectSemanticMarkup.heading(1, longTitle)
    
    // Verify full title is available via title attribute for tooltip
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveAttribute('title', longTitle)
  })

  it('should display short session titles with tooltip', async () => {
    const shortTitle = 'Short Title'
    const session = testDb.createSession({
      title: shortTitle,
      project_path: '/test/project'
    })

    await renderSessionDetail(session.id)

    // Verify title is displayed
    expectSemanticMarkup.heading(1, shortTitle)
    
    // Verify title attribute is present
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveAttribute('title', shortTitle)
  })

  it('should handle untitled sessions properly', async () => {
    const session = testDb.createSession({
      title: '',
      project_path: '/test/project'
    })

    await renderSessionDetail(session.id)

    // Should show "Untitled Session"
    expectSemanticMarkup.heading(1, 'Untitled Session')
    
    // Should have title attribute
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveAttribute('title', 'Untitled Session')
  })
})