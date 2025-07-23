import { db, events, type Event, type NewEvent } from './index'
import { eq, desc, asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { SDKMessage } from '@anthropic-ai/claude-code'

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
    .orderBy(asc(events.timestamp))
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

// Claude Code integration functions
type ExtendedMessage = SDKMessage | {
  type: 'user_cancelled'
  content: string
  session_id: string
} | {
  type: 'user'
  content: string
  session_id: string
}

interface CreateEventOptions {
  message: ExtendedMessage
  memvaSessionId: string
  projectPath: string
  parentUuid: string | null
  timestamp?: string
  visible?: boolean
}

export function createEventFromMessage({
  message,
  memvaSessionId,
  projectPath,
  parentUuid,
  timestamp,
  visible = true
}: CreateEventOptions): NewEvent {
  const pathParts = projectPath.split('/')
  const projectName = pathParts[pathParts.length - 1] || 'root'

  // Auto-hide system and result events at the database level
  if (message.type === 'system' || message.type === 'result') {
    visible = false
  }

  return {
    uuid: uuidv4(),
    session_id: 'session_id' in message ? message.session_id : '',
    event_type: message.type,
    timestamp: timestamp || new Date().toISOString(),
    is_sidechain: false,
    parent_uuid: parentUuid,
    cwd: projectPath,
    project_name: projectName,
    data: message,
    memva_session_id: memvaSessionId,
    visible
  }
}

export async function storeEvent(event: NewEvent): Promise<void> {
  if (event.event_type === 'result') {
    console.log(`[EVENT STORAGE DEBUG] Storing result event at ${event.timestamp} for session ${event.memva_session_id}`)
  }
  await db.insert(events).values(event).execute()
}