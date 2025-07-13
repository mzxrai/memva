import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import SessionDetail from '../routes/sessions.$sessionId'
import type { Session } from '../db/schema'

// Mock the database service
vi.mock('../db/sessions.service', () => ({
  getSession: vi.fn(),
  listSessions: vi.fn(),
  getSessionWithStats: vi.fn(),
  createSession: vi.fn()
}))

describe('Session Detail Page', () => {
  it('should display session details', async () => {
    const mockSession: Session = {
      id: 'test-session-id',
      title: 'Test Session',
      created_at: '2025-07-13T10:00:00Z',
      updated_at: '2025-07-13T10:00:00Z',
      status: 'active',
      project_path: '/Users/mbm-premva/dev/memva',
      metadata: { description: 'Test session metadata' }
    }

    const { getSession } = await import('../db/sessions.service')
    vi.mocked(getSession).mockResolvedValue(mockSession)

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: mockSession })
      }
    ])

    render(<Stub initialEntries={['/sessions/test-session-id']} />)

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument()
      expect(screen.getByText('/Users/mbm-premva/dev/memva', { exact: false })).toBeInTheDocument()
      expect(screen.getByText('active', { exact: false })).toBeInTheDocument()
    })
  })

  it('should handle missing session', async () => {
    const { getSession } = await import('../db/sessions.service')
    vi.mocked(getSession).mockResolvedValue(null)

    const Stub = createRoutesStub([
      {
        path: '/sessions/:sessionId',
        Component: SessionDetail,
        loader: async () => ({ session: null })
      }
    ])

    render(<Stub initialEntries={['/sessions/invalid-id']} />)

    await waitFor(() => {
      expect(screen.getByText(/session not found/i)).toBeInTheDocument()
    })
  })
})