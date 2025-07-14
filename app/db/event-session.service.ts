import { db, events, type Event } from './index'
import { eq, and, asc, desc, inArray } from 'drizzle-orm'

type GetEventsOptions = {
  eventType?: string
  includeSidechain?: boolean
}

export async function associateEventsWithSession(
  eventIds: string[],
  memvaSessionId: string
): Promise<number> {
  if (eventIds.length === 0) return 0
  
  // Update events in batches to handle large arrays
  await db
    .update(events)
    .set({ memva_session_id: memvaSessionId })
    .where(inArray(events.uuid, eventIds))
    .execute()
  
  // Count how many were actually updated
  const updated = await db
    .select({ count: events.uuid })
    .from(events)
    .where(and(
      inArray(events.uuid, eventIds),
      eq(events.memva_session_id, memvaSessionId)
    ))
    .execute()
  
  return updated.length
}

export async function getEventsForSession(
  memvaSessionId: string,
  options: GetEventsOptions = {}
): Promise<Event[]> {
  // Build conditions
  const conditions = [eq(events.memva_session_id, memvaSessionId)]
  
  if (options.eventType) {
    conditions.push(eq(events.event_type, options.eventType))
  }
  
  if (options.includeSidechain === false) {
    conditions.push(eq(events.is_sidechain, false))
  }
  
  // Execute query with all conditions - newest first
  return db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.timestamp))
    .execute()
}

export async function getClaudeSessionsForMemvaSession(
  memvaSessionId: string
): Promise<string[]> {
  const result = await db
    .selectDistinct({ session_id: events.session_id })
    .from(events)
    .where(eq(events.memva_session_id, memvaSessionId))
    .execute()
  
  return result.map(row => row.session_id).sort()
}