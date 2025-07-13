import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useLoaderData } from 'react-router'
import SessionEvents, { loader } from './events.$sessionId'
import { getDatabase } from '../db/database'
import { events } from '../db/schema'
import { eq, asc } from 'drizzle-orm'

vi.mock('../db/database')
vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLoaderData: vi.fn()
}))

describe('Session Events route', () => {
  it('should load events for a specific session', async () => {
    const mockEvents = [
      {
        uuid: 'event-1',
        session_id: 'session-123',
        event_type: 'user',
        timestamp: '2025-01-01T00:00:00.000Z',
        is_sidechain: false,
        parent_uuid: null,
        cwd: '/test/project',
        project_name: 'test-project',
        data: { type: 'user', message: 'Hello' },
        file_path: '/test/file.jsonl',
        line_number: 1,
        synced_at: '2025-01-01T00:00:00.000Z'
      },
      {
        uuid: 'event-2',
        session_id: 'session-123',
        event_type: 'assistant',
        timestamp: '2025-01-01T00:00:05.000Z',
        is_sidechain: false,
        parent_uuid: 'event-1',
        cwd: '/test/project',
        project_name: 'test-project',
        data: { type: 'assistant', message: 'Hi there!' },
        file_path: '/test/file.jsonl',
        line_number: 2,
        synced_at: '2025-01-01T00:00:00.000Z'
      }
    ]

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      all: vi.fn().mockReturnValue(mockEvents)
    }

    vi.mocked(getDatabase).mockReturnValue(mockDb as any)

    const result = await loader({ params: { sessionId: 'session-123' } } as any)
    
    expect(mockDb.where).toHaveBeenCalledWith(eq(events.session_id, 'session-123'))
    expect(mockDb.orderBy).toHaveBeenCalledWith(asc(events.timestamp))
    expect(result.sessionEvents).toHaveLength(2)
    expect(result.sessionId).toBe('session-123')
  })

  it('should render session events with timeline', () => {
    const sessionEvents = [
      {
        uuid: 'event-1',
        session_id: 'session-123',
        event_type: 'user',
        timestamp: '2025-01-01T00:00:00.000Z',
        is_sidechain: false,
        parent_uuid: null,
        cwd: '/test/project',
        project_name: 'test-project',
        data: { type: 'user', message: 'Hello' },
        file_path: '/test/file.jsonl',
        line_number: 1,
        synced_at: '2025-01-01T00:00:00.000Z',
        memva_session_id: null
      },
      {
        uuid: 'event-2',
        session_id: 'session-123',
        event_type: 'assistant',
        timestamp: '2025-01-01T00:00:05.000Z',
        is_sidechain: true,
        parent_uuid: 'event-1',
        cwd: '/test/project',
        project_name: 'test-project',
        data: { type: 'assistant', message: 'Hi there!' },
        file_path: '/test/file.jsonl',
        line_number: 2,
        synced_at: '2025-01-01T00:00:00.000Z',
        memva_session_id: null
      }
    ]

    // Mock the useLoaderData hook to return our test data
    vi.mocked(useLoaderData).mockReturnValue({ sessionEvents, sessionId: 'session-123' })
    
    render(<SessionEvents />)

    expect(screen.getByText('Session Details')).toBeInTheDocument()
    expect(screen.getByText('← Back to all sessions')).toBeInTheDocument()
    expect(screen.getByText('test-project')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Total events
    expect(screen.getByText('Events Timeline')).toBeInTheDocument()
    
    // Check event type indicators
    expect(screen.getByText('U')).toBeInTheDocument() // User event
    expect(screen.getByText('A')).toBeInTheDocument() // Assistant event
    
    // Check sidechain badge
    expect(screen.getByText('Sidechain')).toBeInTheDocument()
  })

  it('should handle session not found', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessionEvents: [], sessionId: 'unknown' })
    
    render(<SessionEvents />)

    expect(screen.getByText('Session Not Found')).toBeInTheDocument()
    expect(screen.getByText('← Back to all sessions')).toBeInTheDocument()
  })
})