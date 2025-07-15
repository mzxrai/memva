import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useLoaderData } from 'react-router'
import type { ReactNode } from 'react'
import SessionEvents from '../routes/events.$sessionId'
import { createMockEvent } from '../test-utils/factories'
import { expectSemanticMarkup, expectContent } from '../test-utils/component-testing'

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLoaderData: vi.fn()
}))

describe('SessionEvents Component', () => {
  it('should render session details with proper semantic structure', () => {
    const sessionEvents = [
      createMockEvent({
        session_id: 'session-123',
        event_type: 'user',
        timestamp: '2025-01-01T10:00:00.000Z',
        project_name: 'test-project',
        data: { type: 'user', content: 'Hello' }
      }),
      createMockEvent({
        session_id: 'session-123',
        event_type: 'assistant',
        timestamp: '2025-01-01T10:05:00.000Z',
        project_name: 'test-project',
        data: { type: 'assistant', content: 'Hi there!' }
      })
    ]

    vi.mocked(useLoaderData).mockReturnValue({ sessionEvents, sessionId: 'session-123' })
    
    render(<SessionEvents />)

    // Test semantic structure
    expectSemanticMarkup.heading(1, 'Session Details')
    expectSemanticMarkup.heading(2, 'Events Timeline')
    expectSemanticMarkup.link('← Back to all sessions', '/events')
    
    // Test session information display
    expect(screen.getByText('Session ID:')).toBeInTheDocument()
    expect(screen.getByText('session-123')).toBeInTheDocument()
    expect(screen.getByText('Project:')).toBeInTheDocument()
    expect(screen.getByText('test-project')).toBeInTheDocument()
    expect(screen.getByText('Total Events:')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    
    // Test duration display (should show formatted timestamps)
    expect(screen.getByText(/Duration:/)).toBeInTheDocument()
  })

  it('should display event timeline with proper indicators', () => {
    const sessionEvents = [
      createMockEvent({
        session_id: 'session-123',
        event_type: 'user',
        timestamp: '2025-01-01T10:00:00.000Z',
        project_name: 'test-project',
        data: { type: 'user', content: 'Hello' }
      }),
      createMockEvent({
        session_id: 'session-123',
        event_type: 'assistant',
        timestamp: '2025-01-01T10:05:00.000Z',
        project_name: 'test-project',
        data: { type: 'assistant', content: 'Hi there!' }
      }),
      createMockEvent({
        session_id: 'session-123',
        event_type: 'system',
        timestamp: '2025-01-01T10:01:00.000Z',
        project_name: 'test-project',
        data: { type: 'system', content: 'System message' }
      })
    ]

    vi.mocked(useLoaderData).mockReturnValue({ sessionEvents, sessionId: 'session-123' })
    
    render(<SessionEvents />)

    // Test event type indicators are visible
    expectContent.text('U') // User event indicator
    expectContent.text('A') // Assistant event indicator
    expectContent.text('S') // System event indicator
    
    // Test event type labels are displayed
    expectContent.text('user')
    expectContent.text('assistant')
    expectContent.text('system')
  })

  it('should display sidechain badge for sidechain events', () => {
    const sessionEvents = [
      createMockEvent({
        session_id: 'session-123',
        event_type: 'assistant',
        is_sidechain: true,
        timestamp: '2025-01-01T10:00:00.000Z',
        project_name: 'test-project',
        data: { type: 'assistant', content: 'Sidechain message' }
      }),
      createMockEvent({
        session_id: 'session-123',
        event_type: 'user',
        is_sidechain: false,
        timestamp: '2025-01-01T10:05:00.000Z',
        project_name: 'test-project',
        data: { type: 'user', content: 'Regular message' }
      })
    ]

    vi.mocked(useLoaderData).mockReturnValue({ sessionEvents, sessionId: 'session-123' })
    
    render(<SessionEvents />)

    // Should show sidechain badge only for sidechain events
    expectContent.text('Sidechain')
    
    // Should show one sidechain badge (not for regular events)
    const sidechainBadges = screen.queryAllByText('Sidechain')
    expect(sidechainBadges).toHaveLength(1)
  })

  it('should display event JSON data in preformatted block', () => {
    const eventData = {
      type: 'user',
      message: {
        role: 'user',
        content: 'Test message with complex data'
      }
    }
    
    const sessionEvents = [
      createMockEvent({
        session_id: 'session-123',
        event_type: 'user',
        timestamp: '2025-01-01T10:00:00.000Z',
        project_name: 'test-project',
        data: eventData
      })
    ]

    vi.mocked(useLoaderData).mockReturnValue({ sessionEvents, sessionId: 'session-123' })
    
    render(<SessionEvents />)

    // Should display JSON data in preformatted block
    const preElements = screen.getAllByText(/"session_id": "session-123"/i)
    expect(preElements.length).toBeGreaterThan(0)
    
    // Should be in a pre element for proper formatting
    const preElement = preElements[0].closest('pre')
    expect(preElement).toBeInTheDocument()
    expect(preElement?.tagName).toBe('PRE')
  })

  it('should handle session not found state', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessionEvents: [], sessionId: 'unknown' })
    
    render(<SessionEvents />)

    // Test not found state
    expectSemanticMarkup.heading(1, 'Session Not Found')
    expectSemanticMarkup.link('← Back to all sessions', '/events')
    
    // Should not show session details or timeline
    expect(screen.queryByText('Events Timeline')).not.toBeInTheDocument()
    expect(screen.queryByText('Session Details')).not.toBeInTheDocument()
  })

  it('should format timestamps properly', () => {
    const sessionEvents = [
      createMockEvent({
        session_id: 'session-123',
        event_type: 'user',
        timestamp: '2025-01-01T10:00:00.000Z',
        project_name: 'test-project',
        data: { type: 'user', content: 'Hello' }
      })
    ]

    vi.mocked(useLoaderData).mockReturnValue({ sessionEvents, sessionId: 'session-123' })
    
    render(<SessionEvents />)

    // Should display formatted time (toLocaleTimeString format will vary by locale)
    // Just check that some formatted time is displayed
    const timeElements = screen.getAllByText(/AM|PM/i)
    expect(timeElements.length).toBeGreaterThan(0)
  })

  it('should display multiple events with proper spacing', () => {
    const sessionEvents = [
      createMockEvent({
        session_id: 'session-123',
        event_type: 'user',
        timestamp: '2025-01-01T10:00:00.000Z',
        project_name: 'test-project',
        data: { type: 'user', content: 'First message' }
      }),
      createMockEvent({
        session_id: 'session-123',
        event_type: 'assistant',
        timestamp: '2025-01-01T10:05:00.000Z',
        project_name: 'test-project',
        data: { type: 'assistant', content: 'Second message' }
      }),
      createMockEvent({
        session_id: 'session-123',
        event_type: 'system',
        timestamp: '2025-01-01T10:10:00.000Z',
        project_name: 'test-project',
        data: { type: 'system', content: 'Third message' }
      })
    ]

    vi.mocked(useLoaderData).mockReturnValue({ sessionEvents, sessionId: 'session-123' })
    
    render(<SessionEvents />)

    // Should display all events
    expect(screen.getByText('Total Events:')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    
    // Should show all event type indicators
    expectContent.text('U')
    expectContent.text('A')
    expectContent.text('S')
    
    // Should show all event types
    expectContent.text('user')
    expectContent.text('assistant')
    expectContent.text('system')
  })
})