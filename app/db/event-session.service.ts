import { db, events, type Event } from './index'
import { eq, and, desc, inArray } from 'drizzle-orm'

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

export async function getRecentAssistantMessages(
  memvaSessionId: string,
  limit: number = 5
): Promise<Event[]> {
  return getEventsForSession(memvaSessionId, {
    eventType: 'assistant',
    includeSidechain: false
  }).then(events => events.slice(0, limit))
}

export async function getLatestAssistantMessageBatch(
  memvaSessionIds: string[]
): Promise<Map<string, Event | null>> {
  if (memvaSessionIds.length === 0) {
    return new Map()
  }

  // Get all assistant messages and filter for text content
  // SQLite doesn't have good JSON support for complex filtering
  const latestMessages = await db
    .select({
      memva_session_id: events.memva_session_id,
      uuid: events.uuid,
      session_id: events.session_id,
      event_type: events.event_type,
      timestamp: events.timestamp,
      is_sidechain: events.is_sidechain,
      parent_uuid: events.parent_uuid,
      cwd: events.cwd,
      project_name: events.project_name,
      data: events.data
    })
    .from(events)
    .where(
      and(
        inArray(events.memva_session_id, memvaSessionIds),
        eq(events.event_type, 'assistant'),
        eq(events.is_sidechain, false)
      )
    )
    .orderBy(desc(events.timestamp))
    .execute()

  // Group by session and take only the first TEXT message per session
  const resultMap = new Map<string, Event | null>()
  
  // Initialize with null for all requested sessions
  memvaSessionIds.forEach(id => resultMap.set(id, null))
  
  // Process results - since ordered by timestamp desc, first text occurrence is latest text message
  const seenSessions = new Set<string>()
  for (const message of latestMessages) {
    if (message.memva_session_id && !seenSessions.has(message.memva_session_id)) {
      // Check if this message contains text content
      try {
        const messageData = message.data as { message?: { content?: Array<{ type: string }> } } | null
        const hasTextContent = messageData && 
          typeof messageData === 'object' && 
          'message' in messageData &&
          messageData.message?.content?.some(item => item.type === 'text')
        
        if (hasTextContent) {
          seenSessions.add(message.memva_session_id)
          resultMap.set(message.memva_session_id, message as Event)
        }
      } catch {
        // Skip malformed messages
      }
    }
  }
  
  return resultMap
}