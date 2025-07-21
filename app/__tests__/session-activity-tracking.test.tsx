import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { loader } from '../routes/sessions.$sessionId'
import { createMockSession, createMockAssistantEvent } from '../test-utils/factories'
import { waitForCondition } from '../test-utils/async-testing'

// Mock the loader to avoid database calls
vi.mock('../routes/sessions.$sessionId', async () => {
  const actual = await vi.importActual('../routes/sessions.$sessionId')
  return {
    ...actual,
    loader: vi.fn()
  }
})

// Mock EventSource for SSE
global.EventSource = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 0,
  url: '',
  withCredentials: false,
  onerror: null,
  onmessage: null,
  onopen: null
})) as any

// Import after mocking
import SessionDetail from '../routes/sessions.$sessionId'

describe('Session Activity Tracking', () => {
  const mockSession = createMockSession({ id: 'test-session-1', title: 'Test Session' })
  const mockEvents = [createMockAssistantEvent('Test message')]
  const mockSettings = { permissionMode: 'acceptEdits' as const, maxTurns: 10 }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    
    // Mock the loader response
    vi.mocked(loader).mockResolvedValue({
      session: mockSession,
      events: mockEvents,
      settings: mockSettings
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should track activity when session detail page is mounted', async () => {
    const router = createMemoryRouter([
      {
        path: '/sessions/:sessionId',
        element: <SessionDetail />,
        loader
      }
    ], {
      initialEntries: ['/sessions/test-session-1']
    })

    render(<RouterProvider router={router} />)

    // Wait for activity to be tracked
    await waitForCondition(() => {
      const activity = JSON.parse(localStorage.getItem('memvaSessionActivity') || '{}')
      return activity['test-session-1'] !== undefined
    })

    const activity = JSON.parse(localStorage.getItem('memvaSessionActivity') || '{}')
    expect(activity['test-session-1']).toBeDefined()
    expect(activity['test-session-1']).toBeGreaterThan(Date.now() - 1000)
  })
})