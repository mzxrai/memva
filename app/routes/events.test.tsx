import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useLoaderData } from 'react-router'
import type { ReactNode } from 'react'
import Events, { loader } from './events'
import { getDatabase } from '../db/database'
import { events } from '../db/schema'
import { desc } from 'drizzle-orm'

vi.mock('../db/database')
vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLoaderData: vi.fn()
}))

describe('Events route', () => {
  it('should load 500 most recent events grouped by session', async () => {
    const mockEvents = Array.from({ length: 500 }, (_, i) => ({
      uuid: `event-${i}`,
      session_id: `session-${Math.floor(i / 10)}`,
      event_type: i % 2 === 0 ? 'user' : 'assistant',
      timestamp: new Date(2025, 0, 1, 0, 0, i).toISOString(),
      is_sidechain: false,
      parent_uuid: i > 0 ? `event-${i - 1}` : null,
      cwd: '/test/project',
      project_name: 'test-project',
      data: { type: i % 2 === 0 ? 'user' : 'assistant', message: `Test message ${i}` },
      file_path: '/test/file.jsonl',
      line_number: i + 1,
      synced_at: '2025-01-01T00:00:00.000Z'
    }))

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      all: vi.fn().mockReturnValue(mockEvents)
    }

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>)

    const result = await loader()
    
    expect(mockDb.select).toHaveBeenCalled()
    expect(mockDb.from).toHaveBeenCalledWith(events)
    expect(mockDb.orderBy).toHaveBeenCalledWith(desc(events.timestamp))
    expect(mockDb.limit).toHaveBeenCalledWith(500)
    expect(result.eventsBySession).toBeDefined()
    
    // Check that events are grouped by session
    const sessions = Object.keys(result.eventsBySession)
    expect(sessions.length).toBeGreaterThan(0)
    
    // Verify each session has events
    sessions.forEach(sessionId => {
      expect(result.eventsBySession[sessionId].length).toBeGreaterThan(0)
    })
  })

  it('should render session cards', () => {
    const eventsBySession = {
      'session-1': [
        {
          uuid: 'test-1',
          session_id: 'session-1',
          event_type: 'user',
          timestamp: '2025-01-01T00:00:00.000Z',
          is_sidechain: false,
          parent_uuid: null,
          cwd: '/test',
          project_name: 'test-project',
          data: { type: 'user', message: 'Hello' },
          file_path: 'test.jsonl',
          line_number: 1,
          synced_at: '2025-01-01T00:00:00.000Z',
          memva_session_id: null
        },
        {
          uuid: 'test-2',
          session_id: 'session-1',
          event_type: 'assistant',
          timestamp: '2025-01-01T00:00:01.000Z',
          is_sidechain: false,
          parent_uuid: 'test-1',
          cwd: '/test',
          project_name: 'test-project',
          data: { type: 'assistant', message: 'Hi there!' },
          file_path: 'test.jsonl',
          line_number: 2,
          synced_at: '2025-01-01T00:00:00.000Z',
          memva_session_id: null
        }
      ],
      'session-2': [
        {
          uuid: 'test-3',
          session_id: 'session-2',
          event_type: 'user',
          timestamp: '2025-01-01T00:01:00.000Z',
          is_sidechain: false,
          parent_uuid: null,
          cwd: '/other',
          project_name: 'other-project',
          data: { type: 'user', message: 'Another session' },
          file_path: 'test2.jsonl',
          line_number: 1,
          synced_at: '2025-01-01T00:00:00.000Z',
          memva_session_id: null
        }
      ]
    }

    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession })
    
    render(<Events />)

    expect(screen.getByText('Claude Code Events')).toBeInTheDocument()
    expect(screen.getByText('Recent sessions')).toBeInTheDocument()
    
    // Check that session cards are rendered
    expect(screen.getByText('test-project')).toBeInTheDocument()
    expect(screen.getByText('other-project')).toBeInTheDocument()
    
    // Check event counts (they're split across span elements)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('events')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('event')).toBeInTheDocument()
    
    // Check that "View Events" links are present
    const viewLinks = screen.getAllByText('View Events →')
    expect(viewLinks).toHaveLength(2)
  })

  it('should handle empty events list', () => {
    vi.mocked(useLoaderData).mockReturnValue({ eventsBySession: {} })
    
    render(<Events />)

    expect(screen.getByText('Claude Code Events')).toBeInTheDocument()
    expect(screen.getByText('No events found')).toBeInTheDocument()
  })
})