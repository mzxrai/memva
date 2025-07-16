import { db, events, type Event } from './index'
import { eq, desc } from 'drizzle-orm'

export async function getRecentEvents(limit: number): Promise<Event[]> {
  return db
    .select()
    .from(events)
    .orderBy(desc(events.timestamp))
    .limit(limit)
    .execute()
}

export async function getEventsForClaudeSession(sessionId: string): Promise<Event[]> {
  return db
    .select()
    .from(events)
    .where(eq(events.session_id, sessionId))
    .orderBy(desc(events.timestamp))
    .execute()
}

export async function groupEventsBySession(events: Event[]): Promise<Record<string, Event[]>> {
  const grouped: Record<string, Event[]> = {}
  
  for (const event of events) {
    if (!grouped[event.session_id]) {
      grouped[event.session_id] = []
    }
    grouped[event.session_id].push(event)
  }
  
  return grouped
}