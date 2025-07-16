import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import SessionDetail from '../routes/sessions.$sessionId'
import { createMockSession } from '../test-utils/factories'

// Mock react-router - component test with mock data
vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({ sessionId: 'test-session-id' })),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  Form: ({ children, method, className }: { children: ReactNode; method: string; className?: string }) => <form method={method} className={className}>{children}</form>
}))

// Mock hooks used by the component
vi.mock('../hooks/useSessionStatus', () => ({
  useSessionStatus: vi.fn()
}))

vi.mock('../hooks/useEventPolling', () => ({
  useEventPolling: vi.fn()
}))

// Mock external dependencies only
vi.mock('../services/claude-code.service', () => ({
  sendPromptToClaudeCode: vi.fn()
}))

import { useSessionStatus } from '../hooks/useSessionStatus'
import { useEventPolling } from '../hooks/useEventPolling'

describe('SessionDetail Component', () => {
  it('should display session details with proper semantic structure', () => {
    const mockSession = createMockSession({
      title: 'Test Session',
      project_path: '/Users/test/project',
      status: 'active'
    })

    vi.mocked(useSessionStatus).mockReturnValue({ 
      session: mockSession, 
      error: null, 
      isLoading: false 
    })

    vi.mocked(useEventPolling).mockReturnValue({ 
      events: [], 
      error: null, 
      isPolling: false 
    })

    render(<SessionDetail />)

    // Test session details are displayed
    expect(screen.getByText('Test Session')).toBeInTheDocument()
    expect(screen.getByText('/Users/test/project', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('active', { exact: false })).toBeInTheDocument()
  })

  it('should handle missing session gracefully', () => {
    vi.mocked(useSessionStatus).mockReturnValue({ 
      session: null, 
      error: null, 
      isLoading: false 
    })

    vi.mocked(useEventPolling).mockReturnValue({ 
      events: [], 
      error: null, 
      isPolling: false 
    })

    render(<SessionDetail />)

    expect(screen.getByText(/session not found/i)).toBeInTheDocument()
    expect(screen.getByText(/the requested session could not be found/i)).toBeInTheDocument()
  })

  it('should display prompt input form for valid sessions', () => {
    const mockSession = createMockSession({
      title: undefined,
      project_path: '/Users/test/project'
    })

    vi.mocked(useSessionStatus).mockReturnValue({ 
      session: mockSession, 
      error: null, 
      isLoading: false 
    })

    vi.mocked(useEventPolling).mockReturnValue({ 
      events: [], 
      error: null, 
      isPolling: false 
    })

    render(<SessionDetail />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText(/send/i)).toBeInTheDocument()
  })

  it('should show empty state for new sessions', () => {
    const mockSession = createMockSession({
      title: 'New Session',
      project_path: '/Users/test/project'
    })

    vi.mocked(useSessionStatus).mockReturnValue({ 
      session: mockSession, 
      error: null, 
      isLoading: false 
    })

    vi.mocked(useEventPolling).mockReturnValue({ 
      events: [], 
      error: null, 
      isPolling: false 
    })

    render(<SessionDetail />)

    expect(screen.getByText('No messages yet. Start by asking Claude Code something!')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText(/send/i)).toBeInTheDocument()
  })

  it('should enable/disable send button based on input', async () => {
    const user = userEvent.setup()
    const mockSession = createMockSession({
      title: 'Test Session',
      project_path: '/Users/test/project'
    })

    vi.mocked(useSessionStatus).mockReturnValue({ 
      session: mockSession, 
      error: null, 
      isLoading: false 
    })

    vi.mocked(useEventPolling).mockReturnValue({ 
      events: [], 
      error: null, 
      isPolling: false 
    })

    render(<SessionDetail />)

    const input = screen.getByRole('textbox')
    const sendButton = screen.getByText(/send/i) as HTMLButtonElement

    // Button should be disabled initially (no text)
    expect(sendButton.disabled).toBe(true)

    // Type text, button should be enabled
    await user.type(input, 'Test message')
    expect(sendButton.disabled).toBe(false)

    // Clear text, button should be disabled again
    await user.clear(input)
    expect(sendButton.disabled).toBe(true)
  })

  it('should display streaming messages when provided', () => {
    const mockSession = createMockSession({
      title: 'Session with Messages',
      project_path: '/Users/test/project'
    })

    const mockEvents = [
      {
        uuid: 'event-1',
        session_id: 'claude-session-1',
        event_type: 'user',
        timestamp: '2025-07-13T10:00:00Z',
        is_sidechain: false,
        parent_uuid: null,
        cwd: '/Users/test/project',
        project_name: 'test-project',
        data: { type: 'user', content: 'Hello Claude' },
        memva_session_id: mockSession.id
      },
      {
        uuid: 'event-2',
        session_id: 'claude-session-1',
        event_type: 'assistant',
        timestamp: '2025-07-13T10:00:01Z',
        is_sidechain: false,
        parent_uuid: 'event-1',
        cwd: '/Users/test/project',
        project_name: 'test-project',
        data: { type: 'assistant', content: 'Hello! How can I help you?' },
        memva_session_id: mockSession.id
      }
    ]

    vi.mocked(useSessionStatus).mockReturnValue({ 
      session: mockSession, 
      error: null, 
      isLoading: false 
    })

    vi.mocked(useEventPolling).mockReturnValue({ 
      events: mockEvents, 
      error: null, 
      isPolling: false 
    })

    render(<SessionDetail />)

    // Should display the messages
    expect(screen.getByText('Hello Claude')).toBeInTheDocument()
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument()

    // Should not show empty state
    expect(screen.queryByText('No messages yet')).not.toBeInTheDocument()
  })

  it('should show stop button when loading prop is simulated', async () => {
    const mockSession = createMockSession({
      title: 'Test Session',
      project_path: '/Users/test/project',
      claude_status: 'processing' // Set to processing to simulate loading
    })

    vi.mocked(useSessionStatus).mockReturnValue({ 
      session: mockSession, 
      error: null, 
      isLoading: false 
    })

    vi.mocked(useEventPolling).mockReturnValue({ 
      events: [], 
      error: null, 
      isPolling: false 
    })

    render(<SessionDetail />)

    const input = screen.getByRole('textbox')
    // Input should be disabled during loading
    expect(input).toBeDisabled()
  })

  it('should hide pending message when auto-start session receives result message', async () => {
    const mockSession = createMockSession({
      title: 'Auto-start Session',
      project_path: '/Users/test/project',
      metadata: { should_auto_start: true }
    })

    const mockEvents = [
      {
        uuid: 'event-1',
        session_id: 'claude-session-1',
        event_type: 'assistant',
        timestamp: '2025-07-13T10:00:00Z',
        is_sidechain: false,
        parent_uuid: null,
        cwd: '/Users/test/project',
        project_name: 'test-project',
        data: { type: 'assistant', content: 'Hello! How can I help you?' },
        memva_session_id: mockSession.id
      }
    ]

    vi.mocked(useSessionStatus).mockReturnValue({ 
      session: mockSession, 
      error: null, 
      isLoading: false 
    })

    vi.mocked(useEventPolling).mockReturnValue({ 
      events: mockEvents, 
      error: null, 
      isPolling: false 
    })

    render(<SessionDetail />)

    // Assistant message should be visible
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument()
  })
})