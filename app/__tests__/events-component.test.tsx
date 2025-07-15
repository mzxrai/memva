import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useLoaderData } from 'react-router'
import type { ReactNode } from 'react'
import { createMockEvent } from '../test-utils/factories'
import Events from '../routes/events'

// Mock React Router
vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLoaderData: vi.fn()
}))

describe('Events Component', () => {
  it('should render page heading and description', () => {
    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession: {} })
    
    render(<Events />)

    expect(screen.getByRole('heading', { level: 1, name: 'Claude Code Events' })).toBeInTheDocument()
    expect(screen.getByText('Recent sessions')).toBeInTheDocument()
  })

  it('should render session cards with project information', () => {
    const session1Events = [
      createMockEvent({ 
        session_id: 'session-1', 
        event_type: 'user', 
        timestamp: '2025-01-01T00:00:00.000Z',
        project_name: 'test-project' 
      }),
      createMockEvent({ 
        session_id: 'session-1', 
        event_type: 'assistant', 
        timestamp: '2025-01-01T00:00:01.000Z',
        project_name: 'test-project' 
      })
    ]
    
    const session2Events = [
      createMockEvent({ 
        session_id: 'session-2', 
        event_type: 'user', 
        timestamp: '2025-01-01T00:01:00.000Z',
        project_name: 'other-project' 
      })
    ]

    const eventsBySession = {
      'session-1': session1Events,
      'session-2': session2Events
    }

    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession })
    
    render(<Events />)

    // Check project names are displayed
    expect(screen.getByRole('heading', { level: 2, name: 'test-project' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'other-project' })).toBeInTheDocument()
    
    // Check session IDs are displayed
    expect(screen.getByText('session-1')).toBeInTheDocument()
    expect(screen.getByText('session-2')).toBeInTheDocument()
  })

  it('should display event counts and duration', () => {
    const sessionEvents = [
      createMockEvent({ 
        session_id: 'session-1', 
        event_type: 'user', 
        timestamp: '2025-01-01T00:00:00.000Z',
        project_name: 'test-project' 
      }),
      createMockEvent({ 
        session_id: 'session-1', 
        event_type: 'assistant', 
        timestamp: '2025-01-01T00:01:00.000Z',
        project_name: 'test-project' 
      })
    ]

    const eventsBySession = {
      'session-1': sessionEvents
    }

    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession })
    
    render(<Events />)

    // Check event count is displayed
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('events')).toBeInTheDocument()
    
    // Check duration is displayed (should be 1 minute)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('minute')).toBeInTheDocument()
  })

  it('should display event type counts with badges', () => {
    const sessionEvents = [
      createMockEvent({ 
        session_id: 'session-1', 
        event_type: 'user', 
        timestamp: '2025-01-01T00:00:00.000Z',
        project_name: 'test-project' 
      }),
      createMockEvent({ 
        session_id: 'session-1', 
        event_type: 'user', 
        timestamp: '2025-01-01T00:00:01.000Z',
        project_name: 'test-project' 
      }),
      createMockEvent({ 
        session_id: 'session-1', 
        event_type: 'assistant', 
        timestamp: '2025-01-01T00:00:02.000Z',
        project_name: 'test-project' 
      })
    ]

    const eventsBySession = {
      'session-1': sessionEvents
    }

    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession })
    
    render(<Events />)

    // Check event type badges are displayed
    expect(screen.getByText('user: 2')).toBeInTheDocument()
    expect(screen.getByText('assistant: 1')).toBeInTheDocument()
  })

  it('should render View Events links', () => {
    const session1Events = [
      createMockEvent({ 
        session_id: 'session-1', 
        project_name: 'test-project' 
      })
    ]
    
    const session2Events = [
      createMockEvent({ 
        session_id: 'session-2', 
        project_name: 'other-project' 
      })
    ]

    const eventsBySession = {
      'session-1': session1Events,
      'session-2': session2Events
    }

    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession })
    
    render(<Events />)

    // Check that View Events links are present
    const viewLinks = screen.getAllByText('View Events →')
    expect(viewLinks).toHaveLength(2)
    
    // Check that links have correct href attributes
    const linkElements = screen.getAllByRole('link')
    expect(linkElements.find(link => link.getAttribute('href') === '/events/session-1')).toBeInTheDocument()
    expect(linkElements.find(link => link.getAttribute('href') === '/events/session-2')).toBeInTheDocument()
  })

  it('should handle empty events list', () => {
    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession: {} })
    
    render(<Events />)

    expect(screen.getByRole('heading', { level: 1, name: 'Claude Code Events' })).toBeInTheDocument()
    expect(screen.getByText('No events found')).toBeInTheDocument()
  })

  it('should display session timestamp', () => {
    const sessionEvents = [
      createMockEvent({ 
        session_id: 'session-1', 
        timestamp: '2025-01-01T12:34:56.000Z',
        project_name: 'test-project' 
      })
    ]

    const eventsBySession = {
      'session-1': sessionEvents
    }

    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession })
    
    render(<Events />)

    // Check that formatted timestamp is displayed
    // The exact format depends on locale, but we can check that a date is rendered
    expect(screen.getByText(/1\/1\/2025/)).toBeInTheDocument()
  })

  it('should handle singular vs plural event counts', () => {
    const singleEventSession = [
      createMockEvent({ 
        session_id: 'session-1', 
        project_name: 'test-project' 
      })
    ]

    const multiEventSession = [
      createMockEvent({ 
        session_id: 'session-2', 
        project_name: 'other-project' 
      }),
      createMockEvent({ 
        session_id: 'session-2', 
        project_name: 'other-project' 
      })
    ]

    const eventsBySession = {
      'session-1': singleEventSession,
      'session-2': multiEventSession
    }

    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession })
    
    render(<Events />)

    // Check singular form
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('event')).toBeInTheDocument()
    
    // Check plural form
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('events')).toBeInTheDocument()
  })
})