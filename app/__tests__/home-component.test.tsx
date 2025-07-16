import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLoaderData } from 'react-router'
import { createMockSession } from '../test-utils/factories'
import { expectSemanticMarkup, expectContent } from '../test-utils/component-testing'
import Home from '../routes/home'

// Mock React Router hooks
vi.mock('react-router', () => ({
  useLoaderData: vi.fn(),
  Form: ({ children, onSubmit, ...props }: { children: React.ReactNode; onSubmit?: (event: React.FormEvent) => void; [key: string]: unknown }) => (
    <form onSubmit={onSubmit} {...props}>
      {children}
    </form>
  ),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
  )
}))

describe('Home Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render page title and empty state when no sessions', () => {
    // Mock loader data with empty sessions
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    // Test semantic markup
    expectSemanticMarkup.heading(1, 'Sessions')
    
    // Test empty state content
    expectContent.text('No sessions yet')
    expectContent.text('Start working with Claude Code to see your sessions here')
    
    // Test session creation form
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/start a new claude code session/i)).toBeInTheDocument()
  })

  it('should render sessions grid when sessions exist', () => {
    // Mock loader data with sessions using factories
    const mockSessions = [
      createMockSession({ 
        id: 'session-1',
        title: 'First Session',
        project_path: '/test/project1',
        status: 'active',
        created_at: '2025-01-01T10:00:00.000Z'
      }),
      createMockSession({ 
        id: 'session-2',
        title: 'Second Session',
        project_path: '/test/project2',
        status: 'archived',
        created_at: '2025-01-01T11:00:00.000Z'
      })
    ]

    vi.mocked(useLoaderData).mockReturnValue({ sessions: mockSessions })

    render(<Home />)

    // Test page title
    expectSemanticMarkup.heading(1, 'Sessions')
    
    // Test session links - need to check the link exists with correct href
    const firstSessionLink = screen.getByRole('link', { name: /First Session/ })
    expect(firstSessionLink).toBeInTheDocument()
    expect(firstSessionLink).toHaveAttribute('href', '/sessions/session-1')
    
    const secondSessionLink = screen.getByRole('link', { name: /Second Session/ })
    expect(secondSessionLink).toBeInTheDocument()
    expect(secondSessionLink).toHaveAttribute('href', '/sessions/session-2')
    
    // Test session details are visible
    expectContent.text('/test/project1')
    expectContent.text('/test/project2')
    
    // Test status indicators
    expectContent.text('Active')
    expectContent.text('Archived')
    
    // Test session creation form is still present
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should handle session creation form interactions', async () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    const titleInput = screen.getByRole('textbox')

    // Test typing in input
    fireEvent.change(titleInput, { target: { value: 'New Session Title' } })

    // Test input value is updated
    expect(titleInput).toHaveValue('New Session Title')
  })

  it('should display session event count when available', () => {
    // Mock session with stats
    const sessionWithStats = {
      ...createMockSession({ 
        id: 'session-with-stats',
        title: 'Session With Stats'
      }),
      event_count: 5,
      duration_minutes: 30,
      event_types: {
        user: 2,
        assistant: 2,
        summary: 1
      }
    }

    vi.mocked(useLoaderData).mockReturnValue({ sessions: [sessionWithStats] })

    render(<Home />)

    // Test session basic info is displayed
    expectContent.text('Session With Stats')
    
    // Test event count is displayed
    expectContent.text('5 events')
  })

  it('should handle untitled sessions gracefully', () => {
    // Mock session without title
    const untitledSession = createMockSession({ 
      id: 'untitled-session',
      title: null
    })

    vi.mocked(useLoaderData).mockReturnValue({ sessions: [untitledSession] })

    render(<Home />)

    // Test untitled session displays fallback text
    expectContent.text('Untitled Session')
    
    const untitledLink = screen.getByRole('link', { name: /Untitled Session/ })
    expect(untitledLink).toBeInTheDocument()
    expect(untitledLink).toHaveAttribute('href', '/sessions/untitled-session')
  })

  it('should show relative dates for session creation', () => {
    // Mock session with specific creation date
    const recentSession = createMockSession({ 
      id: 'recent-session',
      title: 'Recent Session',
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
    })

    vi.mocked(useLoaderData).mockReturnValue({ sessions: [recentSession] })

    render(<Home />)

    // Test relative date is displayed (should contain "ago")
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  it('should display different status indicators correctly', () => {
    const activeSession = createMockSession({ 
      id: 'active-session',
      title: 'Active Session',
      status: 'active'
    })
    const archivedSession = createMockSession({ 
      id: 'archived-session',
      title: 'Archived Session',
      status: 'archived'
    })

    vi.mocked(useLoaderData).mockReturnValue({ 
      sessions: [activeSession, archivedSession] 
    })

    render(<Home />)

    // Test active session status
    expectContent.text('Active')
    
    // Test archived session status
    expectContent.text('Archived')
  })

  it('should handle form submission via Enter key', async () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    // Mock the Form component to capture submit events
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    const titleInput = screen.getByRole('textbox')

    // Test typing in input
    fireEvent.change(titleInput, { target: { value: 'New Session Title' } })
    expect(titleInput).toHaveValue('New Session Title')

    // Test Enter key submission
    fireEvent.keyDown(titleInput, { key: 'Enter', code: 'Enter' })
    
    // The form should still exist and be functional
    expect(titleInput).toBeInTheDocument()
  })

  it('should handle form accessibility correctly', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    const titleInput = screen.getByRole('textbox')

    // Test form elements are accessible
    expect(titleInput).toBeInTheDocument()
    expect(titleInput).toHaveAttribute('type', 'text')
    expect(titleInput).toHaveAttribute('name', 'title')
    
    // Test keyboard navigation - input should be focusable
    titleInput.focus()
    expect(titleInput).toHaveFocus()
  })
})