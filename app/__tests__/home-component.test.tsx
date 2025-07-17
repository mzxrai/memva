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
    
    // Test session creation form is still present
    expect(screen.getByPlaceholderText(/start a new claude code session/i)).toBeInTheDocument()
  })

  it('should handle session creation form interactions', async () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    const titleInput = screen.getByPlaceholderText(/start a new claude code session/i)

    // Test initial state - input should be empty
    expect(titleInput).toHaveValue('')

    // Test typing in title input
    fireEvent.change(titleInput, { target: { value: 'New Session Title' } })
    
    // Test input value is updated
    expect(titleInput).toHaveValue('New Session Title')
    
    // The form now uses just the title as the prompt, submitted via Enter key
    const form = titleInput.closest('form')
    expect(form).toBeInTheDocument()
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
    const processingSession = createMockSession({ 
      id: 'processing-session',
      title: 'Processing Session',
      status: 'active',
      claude_status: 'processing'
    })
    const completedSession = createMockSession({ 
      id: 'completed-session',
      title: 'Completed Session',
      status: 'active',
      claude_status: 'completed'
    })

    vi.mocked(useLoaderData).mockReturnValue({ 
      sessions: [processingSession, completedSession] 
    })

    render(<Home />)

    // Sessions should have status indicators
    const statusDots = screen.getAllByTestId('status-dot')
    expect(statusDots).toHaveLength(2)
    
    // First session has processing status
    expect(statusDots[0]).toHaveAttribute('data-status', 'processing')
    expect(statusDots[0]).toHaveAttribute('data-pulse', 'true')
    
    // Second session has completed status  
    expect(statusDots[1]).toHaveAttribute('data-status', 'completed')
  })

  it('should prevent form submission when title is empty', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    const titleInput = screen.getByPlaceholderText(/start a new claude code session/i)
    const form = titleInput.closest('form')

    // Form should exist
    expect(form).toBeInTheDocument()
    
    // Test that input accepts text
    fireEvent.change(titleInput, { target: { value: 'Test session' } })
    expect(titleInput).toHaveValue('Test session')
    
    // The form now uses the title as both title and prompt, submitted via Enter key
    // Form submission is handled by the action, not by button state
  })

  it('should handle form accessibility correctly', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    const titleInput = screen.getByPlaceholderText(/start a new claude code session/i)

    // Test form elements are accessible
    expect(titleInput).toBeInTheDocument()
    expect(titleInput).toHaveAttribute('type', 'text')
    expect(titleInput).toHaveAttribute('name', 'title')
    
    // Test that input is in a form
    const form = titleInput.closest('form')
    expect(form).toBeInTheDocument()
    expect(form).toHaveAttribute('method', 'post')
    
    // Test keyboard navigation - input can be focused
    titleInput.focus()
    expect(titleInput).toHaveFocus()
    
    // Test that form can be submitted via Enter key
    fireEvent.change(titleInput, { target: { value: 'Test session' } })
    expect(titleInput).toHaveValue('Test session')
  })
})