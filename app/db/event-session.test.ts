import { describe, it, expect, beforeEach } from 'vitest'
import { db, sessions, events } from './index'
import { createSession } from './sessions.service'
import { 
  associateEventsWithSession,
  getEventsForSession,
  getClaudeSessionsForMemvaSession
} from './event-session.service'
import { v4 as uuidv4 } from 'uuid'

describe('Event-Session Association', () => {
  beforeEach(async () => {
    // Clean up tables before each test
    await db.delete(events).execute()
    await db.delete(sessions).execute()
  })

  describe('associateEventsWithSession', () => {
    it('should associate multiple events with a memva session', async () => {
      const session = await createSession({
        title: 'Test Association',
        project_path: '/test'
      })

      // Create some events without memva_session_id
      const eventIds = [uuidv4(), uuidv4(), uuidv4()]
      for (const uuid of eventIds) {
        await db.insert(events).values({
          uuid,
          session_id: 'claude-session-1',
          event_type: 'user',
          timestamp: new Date().toISOString(),
          is_sidechain: false,
          cwd: '/test',
          project_name: 'test',
          data: { content: 'test' },
          file_path: '/test.jsonl',
          line_number: 1,
          synced_at: new Date().toISOString()
        }).execute()
      }

      // Associate events with session
      const updatedCount = await associateEventsWithSession(eventIds, session.id)
      
      expect(updatedCount).toBe(3)

      // Verify association
      const associatedEvents = await db
        .select()
        .from(events)
        .where(eq(events.memva_session_id, session.id))
        .execute()

      expect(associatedEvents).toHaveLength(3)
    })

    it('should only update events that exist', async () => {
      const session = await createSession({
        title: 'Test Partial',
        project_path: '/test'
      })

      // Create only one event
      const existingId = uuidv4()
      await db.insert(events).values({
        uuid: existingId,
        session_id: 'claude-session-1',
        event_type: 'user',
        timestamp: new Date().toISOString(),
        is_sidechain: false,
        cwd: '/test',
        project_name: 'test',
        data: { content: 'test' },
        file_path: '/test.jsonl',
        line_number: 1,
        synced_at: new Date().toISOString()
      }).execute()

      // Try to associate existing and non-existing events
      const eventIds = [existingId, 'non-existent-1', 'non-existent-2']
      const updatedCount = await associateEventsWithSession(eventIds, session.id)
      
      expect(updatedCount).toBe(1)
    })
  })

  describe('getEventsForSession', () => {
    it('should retrieve all events for a memva session ordered by timestamp', async () => {
      const session = await createSession({
        title: 'Test Retrieval',
        project_path: '/test'
      })

      // Create events with different timestamps
      const timestamps = [
        '2024-01-01T10:00:00Z',
        '2024-01-01T10:05:00Z',
        '2024-01-01T10:02:00Z'
      ]

      for (let i = 0; i < timestamps.length; i++) {
        await db.insert(events).values({
          uuid: uuidv4(),
          session_id: 'claude-session-1',
          memva_session_id: session.id,
          event_type: i % 2 === 0 ? 'user' : 'assistant',
          timestamp: timestamps[i],
          is_sidechain: false,
          cwd: '/test',
          project_name: 'test',
          data: { content: `Event ${i}` },
          file_path: '/test.jsonl',
          line_number: i + 1,
          synced_at: new Date().toISOString()
        }).execute()
      }

      const sessionEvents = await getEventsForSession(session.id)

      expect(sessionEvents).toHaveLength(3)
      // Should be ordered by timestamp
      expect(sessionEvents[0].timestamp).toBe('2024-01-01T10:00:00Z')
      expect(sessionEvents[1].timestamp).toBe('2024-01-01T10:02:00Z')
      expect(sessionEvents[2].timestamp).toBe('2024-01-01T10:05:00Z')
    })

    it('should filter by event type', async () => {
      const session = await createSession({
        title: 'Test Filter',
        project_path: '/test'
      })

      // Create mixed event types
      for (let i = 0; i < 4; i++) {
        await db.insert(events).values({
          uuid: uuidv4(),
          session_id: 'claude-session-1',
          memva_session_id: session.id,
          event_type: i % 2 === 0 ? 'user' : 'assistant',
          timestamp: new Date().toISOString(),
          is_sidechain: false,
          cwd: '/test',
          project_name: 'test',
          data: { content: `Event ${i}` },
          file_path: '/test.jsonl',
          line_number: i + 1,
          synced_at: new Date().toISOString()
        }).execute()
      }

      const userEvents = await getEventsForSession(session.id, { eventType: 'user' })
      const assistantEvents = await getEventsForSession(session.id, { eventType: 'assistant' })

      expect(userEvents).toHaveLength(2)
      expect(assistantEvents).toHaveLength(2)
      expect(userEvents.every(e => e.event_type === 'user')).toBe(true)
      expect(assistantEvents.every(e => e.event_type === 'assistant')).toBe(true)
    })

    it('should include sidechain events', async () => {
      const session = await createSession({
        title: 'Test Sidechain',
        project_path: '/test'
      })

      // Create main and sidechain events
      await db.insert(events).values([
        {
          uuid: uuidv4(),
          session_id: 'claude-session-1',
          memva_session_id: session.id,
          event_type: 'user',
          timestamp: new Date().toISOString(),
          is_sidechain: false,
          cwd: '/test',
          project_name: 'test',
          data: { content: 'Main event' },
          file_path: '/test.jsonl',
          line_number: 1,
          synced_at: new Date().toISOString()
        },
        {
          uuid: uuidv4(),
          session_id: 'claude-session-1',
          memva_session_id: session.id,
          event_type: 'assistant',
          timestamp: new Date().toISOString(),
          is_sidechain: true,
          cwd: '/test',
          project_name: 'test',
          data: { content: 'Sidechain event' },
          file_path: '/test.jsonl',
          line_number: 2,
          synced_at: new Date().toISOString()
        }
      ]).execute()

      const allEvents = await getEventsForSession(session.id)
      const mainOnly = await getEventsForSession(session.id, { includeSidechain: false })

      expect(allEvents).toHaveLength(2)
      expect(mainOnly).toHaveLength(1)
      expect(mainOnly[0].is_sidechain).toBe(false)
    })
  })

  describe('getClaudeSessionsForMemvaSession', () => {
    it('should get all unique Claude session IDs for a Memva session', async () => {
      const session = await createSession({
        title: 'Test Claude Sessions',
        project_path: '/test'
      })

      // Create events from multiple Claude sessions
      const claudeSessions = ['claude-1', 'claude-2', 'claude-1', 'claude-3']
      for (let i = 0; i < claudeSessions.length; i++) {
        await db.insert(events).values({
          uuid: uuidv4(),
          session_id: claudeSessions[i],
          memva_session_id: session.id,
          event_type: 'user',
          timestamp: new Date().toISOString(),
          is_sidechain: false,
          cwd: '/test',
          project_name: 'test',
          data: { content: 'test' },
          file_path: '/test.jsonl',
          line_number: i + 1,
          synced_at: new Date().toISOString()
        }).execute()
      }

      const uniqueSessions = await getClaudeSessionsForMemvaSession(session.id)

      expect(uniqueSessions).toHaveLength(3)
      expect(uniqueSessions.sort()).toEqual(['claude-1', 'claude-2', 'claude-3'])
    })

    it('should return empty array for session with no events', async () => {
      const session = await createSession({
        title: 'Empty Session',
        project_path: '/test'
      })

      const claudeSessions = await getClaudeSessionsForMemvaSession(session.id)

      expect(claudeSessions).toEqual([])
    })
  })
})

// Import eq for the tests
import { eq } from 'drizzle-orm'