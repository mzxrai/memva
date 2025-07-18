import { db, sessions, events, type Session, type NewSession } from './index'
import { eq, desc, and, ne } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export type CreateSessionInput = {
  title?: string
  project_path: string
  status?: 'active' | 'archived'
  metadata?: Record<string, unknown> | null
}

export type UpdateSessionInput = {
  title?: string
  status?: 'active' | 'archived'
  metadata?: Record<string, unknown> | null
}

export type ListSessionsOptions = {
  status?: 'active' | 'archived'
  limit?: number
}

export type SessionWithStats = Session & {
  event_count: number
  duration_minutes: number
  event_types: Record<string, number>
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const now = new Date().toISOString()
  const newSession: NewSession = {
    id: uuidv4(),
    title: input.title || null,
    created_at: now,
    updated_at: now,
    status: 'active',
    project_path: input.project_path,
    metadata: input.metadata || null
  }

  await db.insert(sessions).values(newSession).execute()
  
  const [created] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, newSession.id))
    .execute()
    
  return created
}

export async function updateSession(id: string, input: UpdateSessionInput): Promise<Session | null> {
  const updates: Partial<Session> = {
    updated_at: new Date().toISOString()
  }
  
  if (input.title !== undefined) updates.title = input.title
  if (input.status !== undefined) updates.status = input.status
  if (input.metadata !== undefined) updates.metadata = input.metadata
  
  await db
    .update(sessions)
    .set(updates)
    .where(eq(sessions.id, id))
    .execute()
    
  const [updated] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .execute()
    
  return updated || null
}

export async function getSession(id: string): Promise<Session | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .execute()
    
  return session || null
}

export async function listSessions(options: ListSessionsOptions = {}): Promise<Session[]> {
  const baseQuery = db.select().from(sessions)
  
  const query = options.status 
    ? baseQuery.where(eq(sessions.status, options.status))
    : baseQuery
    
  const orderedQuery = query.orderBy(desc(sessions.created_at))
  
  const finalQuery = options.limit
    ? orderedQuery.limit(options.limit)
    : orderedQuery
  
  return finalQuery.execute()
}

export async function getSessionWithStats(id: string): Promise<SessionWithStats | null> {
  const session = await getSession(id)
  if (!session) return null
  
  // Get all events for this session
  const sessionEvents = await db
    .select()
    .from(events)
    .where(eq(events.memva_session_id, id))
    .orderBy(events.timestamp)
    .execute()
  
  // Calculate stats
  const event_count = sessionEvents.length
  let duration_minutes = 0
  const event_types: Record<string, number> = {}
  
  if (sessionEvents.length > 0) {
    const firstTimestamp = new Date(sessionEvents[0].timestamp).getTime()
    const lastTimestamp = new Date(sessionEvents[sessionEvents.length - 1].timestamp).getTime()
    duration_minutes = Math.round((lastTimestamp - firstTimestamp) / (1000 * 60))
  }
  
  // Count event types
  for (const event of sessionEvents) {
    event_types[event.event_type] = (event_types[event.event_type] || 0) + 1
  }
  
  return {
    ...session,
    event_count,
    duration_minutes,
    event_types
  }
}

export async function getLatestClaudeSessionId(memvaSessionId: string): Promise<string | null> {
  const result = await db
    .select({ session_id: events.session_id })
    .from(events)
    .where(
      and(
        eq(events.memva_session_id, memvaSessionId),
        ne(events.session_id, '')
      )
    )
    .orderBy(desc(events.timestamp))
    .limit(1)
    .execute()
  
  const sessionId = result[0]?.session_id || null
  console.log(`[getLatestClaudeSessionId] For memva session ${memvaSessionId}, found Claude session: ${sessionId}`)
  return sessionId
}

export async function updateClaudeSessionId(memvaSessionId: string, claudeSessionId: string): Promise<void> {
  // First get the existing session to ensure it exists
  const existingSession = await getSession(memvaSessionId)
  if (!existingSession) {
    throw new Error('Session not found')
  }
  
  // Update the metadata with the Claude session ID
  const updatedMetadata = {
    ...(existingSession.metadata || {}),
    claude_session_id: claudeSessionId
  }
  
  await db
    .update(sessions)
    .set({ 
      metadata: updatedMetadata,
      updated_at: new Date().toISOString()
    })
    .where(eq(sessions.id, memvaSessionId))
    .execute()
}

export async function updateSessionClaudeStatus(sessionId: string, status: string): Promise<void> {
  // First get the existing session to ensure it exists
  const existingSession = await getSession(sessionId)
  if (!existingSession) {
    throw new Error('Session not found')
  }
  
  await db
    .update(sessions)
    .set({ 
      claude_status: status,
      updated_at: new Date().toISOString()
    })
    .where(eq(sessions.id, sessionId))
    .execute()
  
  // Emit status change event for SSE
  const { sessionStatusEmitter } = await import('../services/session-status-emitter.server')
  sessionStatusEmitter.emitStatusChange(sessionId, status)
}