import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'
import { eq } from 'drizzle-orm'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { loader } from '../routes/sessions.$sessionId'
import { sessions } from '../db/schema'

// Mock event session service
vi.mock('../db/event-session.service', () => ({
  getEventsForSession: vi.fn()
}))

describe('SessionDetail Loader Integration Tests', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
    vi.clearAllMocks()
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should load existing session successfully', async () => {
    // Create a session in the database
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/Users/test/project'
    })

    const { getEventsForSession } = await import('../db/event-session.service')
    vi.mocked(getEventsForSession).mockResolvedValue([])

    // Call the loader
    const result = await loader({ 
      params: { sessionId: session.id } 
    } as any)

    expect(result.session).not.toBeNull()
    expect(result.session?.id).toBe(session.id)
    expect(result.session?.title).toBe('Test Session')
    expect(result.session?.project_path).toBe('/Users/test/project')
    expect(result.events).toEqual([])
  })

  it('should return null for non-existent session', async () => {
    const { getEventsForSession } = await import('../db/event-session.service')
    vi.mocked(getEventsForSession).mockResolvedValue([])

    // Call loader with non-existent session ID
    const result = await loader({ 
      params: { sessionId: 'non-existent-id' } 
    } as any)

    expect(result.session).toBeNull()
    expect(result.events).toEqual([])
  })

  it('should load session with events', async () => {
    // Create a session
    const session = testDb.createSession({
      title: 'Session with Events',
      project_path: '/Users/test/project'
    })

    // Mock events for this session
    const mockEvents = [
      createMockEvent({
        session_id: 'claude-session-123',
        event_type: 'user',
        memva_session_id: session.id,
        data: { type: 'user', content: 'Hello' }
      }),
      createMockEvent({
        session_id: 'claude-session-123',
        event_type: 'assistant',
        memva_session_id: session.id,
        data: { type: 'assistant', content: 'Hi there!' }
      })
    ]

    const { getEventsForSession } = await import('../db/event-session.service')
    vi.mocked(getEventsForSession).mockResolvedValue(mockEvents)

    // Call the loader
    const result = await loader({ 
      params: { sessionId: session.id } 
    } as any)

    expect(result.session).not.toBeNull()
    expect(result.session?.id).toBe(session.id)
    expect(result.events).toHaveLength(2)
    expect(result.events[0].event_type).toBe('user')
    expect(result.events[1].event_type).toBe('assistant')
  })

  it('should handle sessions with different statuses', async () => {
    // Create an archived session
    const archivedSession = testDb.createSession({
      title: 'Archived Session',
      project_path: '/Users/test/project'
    })

    // Update to archived status
    testDb.db.update(sessions)
      .set({ status: 'archived' })
      .where(eq(sessions.id, archivedSession.id))
      .run()

    const { getEventsForSession } = await import('../db/event-session.service')
    vi.mocked(getEventsForSession).mockResolvedValue([])

    // Call the loader
    const result = await loader({ 
      params: { sessionId: archivedSession.id } 
    } as any)

    expect(result.session).not.toBeNull()
    expect(result.session?.status).toBe('archived')
  })

  it('should handle sessions with metadata', async () => {
    // Create session with metadata
    const sessionWithMetadata = testDb.createSession({
      title: 'Session with Metadata',
      project_path: '/Users/test/project'
    })

    // Update with metadata
    testDb.db.update(sessions)
      .set({ 
        metadata: { 
          should_auto_start: true,
          user_preferences: { theme: 'dark' }
        } 
      })
      .where(eq(sessions.id, sessionWithMetadata.id))
      .run()

    const { getEventsForSession } = await import('../db/event-session.service')
    vi.mocked(getEventsForSession).mockResolvedValue([])

    // Call the loader
    const result = await loader({ 
      params: { sessionId: sessionWithMetadata.id } 
    } as any)

    expect(result.session).not.toBeNull()
    expect(result.session?.metadata).toEqual({
      should_auto_start: true,
      user_preferences: { theme: 'dark' }
    })
  })
})