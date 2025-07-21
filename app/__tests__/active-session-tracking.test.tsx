import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { loader } from '../routes/sessions.$sessionId'
import { createMockSession, createMockAssistantEvent } from '../test-utils/factories'

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

describe('Active Session Tracking', () => {
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

  it('should set activeSession in localStorage when session detail page mounts', async () => {
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

    await waitFor(() => {
      expect(localStorage.getItem('activeSession')).toBe('test-session-1')
    })
  })

  it('should remove activeSession when component unmounts', async () => {
    const router = createMemoryRouter([
      {
        path: '/sessions/:sessionId',
        element: <SessionDetail />,
        loader
      }
    ], {
      initialEntries: ['/sessions/test-session-1']
    })

    const { unmount } = render(<RouterProvider router={router} />)

    // Wait for mount
    await waitFor(() => {
      expect(localStorage.getItem('activeSession')).toBe('test-session-1')
    })

    // Unmount component
    unmount()

    // Should clear activeSession
    expect(localStorage.getItem('activeSession')).toBeNull()
  })

  it('should update activeSession when navigating between sessions', async () => {
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

    await waitFor(() => {
      expect(localStorage.getItem('activeSession')).toBe('test-session-1')
    })

    // Navigate to different session
    vi.mocked(loader).mockResolvedValue({
      session: createMockSession({ id: 'test-session-2', title: 'Session 2' }),
      events: [],
      settings: mockSettings
    })

    // Navigate using router
    router.navigate('/sessions/test-session-2')

    await waitFor(() => {
      expect(localStorage.getItem('activeSession')).toBe('test-session-2')
    })
  })

  it('should handle visibility changes correctly', async () => {
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

    await waitFor(() => {
      expect(localStorage.getItem('activeSession')).toBe('test-session-1')
    })

    // Simulate tab becoming hidden
    Object.defineProperty(document, 'hidden', {
      writable: true,
      configurable: true,
      value: true
    })
    
    const event = new Event('visibilitychange')
    document.dispatchEvent(event)

    // Should remove activeSession when tab is hidden
    expect(localStorage.getItem('activeSession')).toBeNull()

    // Simulate tab becoming visible again
    Object.defineProperty(document, 'hidden', {
      writable: true,
      configurable: true,
      value: false
    })
    
    document.dispatchEvent(event)

    // Should restore activeSession when tab is visible
    expect(localStorage.getItem('activeSession')).toBe('test-session-1')
  })
})