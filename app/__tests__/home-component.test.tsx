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
    expect(screen.getByPlaceholderText('Session title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/what would you like claude code to help you with/i)).toBeInTheDocument()
    const startButton = screen.getByRole('button', { name: 'Start' })
    expect(startButton).toBeInTheDocument()
  })

  it('should handle session creation form interactions', async () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    const titleInput = screen.getByPlaceholderText('Session title')
    const promptInput = screen.getByPlaceholderText(/what would you like claude code to help you with/i)
    const submitButton = screen.getByRole('button', { name: 'Start' })

    // Test initial state - button should be disabled
    expect(submitButton).toBeDisabled()

    // Test typing in title input only
    fireEvent.change(titleInput, { target: { value: 'New Session Title' } })
    
    // Button should still be disabled because prompt is empty
    expect(submitButton).toBeDisabled()

    // Test typing in prompt input
    fireEvent.change(promptInput, { target: { value: 'Help me build a component' } })
    
    // Test button becomes enabled when both fields are filled
    await waitFor(() => {
      expect(submitButton).toBeEnabled()
    })

    // Test input values are updated
    expect(titleInput).toHaveValue('New Session Title')
    expect(promptInput).toHaveValue('Help me build a component')
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

  it('should prevent form submission when title or prompt is empty', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    const titleInput = screen.getByPlaceholderText('Session title')
    const promptInput = screen.getByPlaceholderText(/what would you like claude code to help you with/i)
    const submitButton = screen.getByRole('button', { name: 'Start' })

    // Test empty inputs
    fireEvent.change(titleInput, { target: { value: '' } })
    fireEvent.change(promptInput, { target: { value: '' } })
    expect(submitButton).toBeDisabled()

    // Test whitespace-only inputs
    fireEvent.change(titleInput, { target: { value: '   ' } })
    fireEvent.change(promptInput, { target: { value: '   ' } })
    expect(submitButton).toBeDisabled()

    // Test valid title but empty prompt
    fireEvent.change(titleInput, { target: { value: 'Valid Title' } })
    fireEvent.change(promptInput, { target: { value: '' } })
    expect(submitButton).toBeDisabled()

    // Test empty title but valid prompt
    fireEvent.change(titleInput, { target: { value: '' } })
    fireEvent.change(promptInput, { target: { value: 'Valid prompt' } })
    expect(submitButton).toBeDisabled()

    // Test valid inputs
    fireEvent.change(titleInput, { target: { value: 'Valid Title' } })
    fireEvent.change(promptInput, { target: { value: 'Valid prompt' } })
    expect(submitButton).toBeEnabled()
  })

  it('should handle form accessibility correctly', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(<Home />)

    const titleInput = screen.getByPlaceholderText('Session title')
    const promptInput = screen.getByPlaceholderText(/what would you like claude code to help you with/i)
    const submitButton = screen.getByRole('button', { name: 'Start' })

    // Test form elements are accessible
    expect(titleInput).toBeInTheDocument()
    expect(titleInput).toHaveAttribute('type', 'text')
    expect(titleInput).toHaveAttribute('name', 'title')
    
    expect(promptInput).toBeInTheDocument()
    expect(promptInput).toHaveAttribute('name', 'prompt')
    
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toHaveAttribute('type', 'submit')
    
    // Test keyboard navigation - just check they can be focused
    titleInput.focus()
    expect(titleInput).toHaveFocus()
    
    promptInput.focus()
    expect(promptInput).toHaveFocus()
    
    // Note: disabled buttons cannot be focused, so only test when enabled
    fireEvent.change(titleInput, { target: { value: 'Test' } })
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } })
    expect(submitButton).toBeEnabled()
    submitButton.focus()
    expect(submitButton).toHaveFocus()
  })
})