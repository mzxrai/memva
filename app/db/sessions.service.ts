import { db, sessions, events, type Session, type NewSession, type Event } from './index'
import { eq, desc, and, ne, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getSettings } from './settings.service'
import type { SettingsConfig } from '../types/settings'

export type CreateSessionInput = {
  title?: string
  project_path: string
  status?: 'active' | 'archived'
  metadata?: Record<string, unknown> | null
}

export { type NewSession } from './index'

export type UpdateSessionInput = {
  title?: string
  status?: 'active' | 'archived'
  metadata?: Record<string, unknown> | null
}

export type ListSessionsOptions = {
  status?: 'active' | 'archived'
  limit?: number
}

export type TokenStats = {
  total_tokens: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  context_percentage: number
  cache_efficiency: number
  context_used: number
}

export type SessionWithStats = Session & {
  event_count: number
  duration_minutes: number
  event_types: Record<string, number>
  last_event_at?: string
  token_stats?: TokenStats
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const now = new Date().toISOString()
  
  // Get global settings to copy to the new session
  const globalSettings = await getSettings()
  
  // Truncate title to prevent performance issues with huge prompts
  const MAX_TITLE_LENGTH = 100
  let truncatedTitle = input.title || null
  if (truncatedTitle && truncatedTitle.length > MAX_TITLE_LENGTH) {
    truncatedTitle = truncatedTitle.substring(0, MAX_TITLE_LENGTH - 3) + '...'
  }
  
  const newSession: NewSession = {
    id: uuidv4(),
    title: truncatedTitle,
    created_at: now,
    updated_at: now,
    status: 'active',
    project_path: input.project_path,
    metadata: input.metadata || null,
    settings: globalSettings
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
  
  // Truncate title to prevent performance issues
  const MAX_TITLE_LENGTH = 100
  if (input.title !== undefined) {
    let truncatedTitle = input.title
    if (truncatedTitle && truncatedTitle.length > MAX_TITLE_LENGTH) {
      truncatedTitle = truncatedTitle.substring(0, MAX_TITLE_LENGTH - 3) + '...'
    }
    updates.title = truncatedTitle
  }
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

// Helper function to count visible events the same way as the detail page
function getVisibleEventCount(sessionEvents: Event[]): number {
  let count = 0
  
  for (const event of sessionEvents) {
    // Skip invisible events (system and result events are already marked visible: false)
    if (event.visible === false) continue
    
    // Skip user events that contain only tool_result content
    if (event.event_type === 'user' && event.data && typeof event.data === 'object') {
      const data = event.data as Record<string, unknown>
      if ('message' in data && typeof data.message === 'object' && data.message) {
        const message = data.message as Record<string, unknown>
        if ('content' in message && Array.isArray(message.content)) {
          const hasNonToolResultContent = message.content.some((item: unknown) => 
            item && typeof item === 'object' && 'type' in item && (item as { type: string }).type !== 'tool_result'
          )
          if (!hasNonToolResultContent) {
            // This is a user event with only tool results - don't count it
            continue
          }
        }
      }
    }
    
    count++
  }
  
  return count
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
  
  // Count visible events the same way as the detail page
  const visibleEventCount = getVisibleEventCount(sessionEvents)
  
  let duration_minutes = 0
  let last_event_at: string | undefined
  const event_types: Record<string, number> = {}
  
  if (sessionEvents.length > 0) {
    const firstTimestamp = new Date(sessionEvents[0].timestamp).getTime()
    const lastTimestamp = new Date(sessionEvents[sessionEvents.length - 1].timestamp).getTime()
    duration_minutes = Math.round((lastTimestamp - firstTimestamp) / (1000 * 60))
    last_event_at = sessionEvents[sessionEvents.length - 1].timestamp
  }
  
  // Count event types
  for (const event of sessionEvents) {
    event_types[event.event_type] = (event_types[event.event_type] || 0) + 1
  }
  
  // Get token stats
  const token_stats = await getSessionTokenStats(id)
  
  return {
    ...session,
    event_count: visibleEventCount,
    duration_minutes,
    event_types,
    last_event_at,
    token_stats: token_stats || undefined
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
}

export async function getSessionsWithStatsBatch(sessionIds: string[]): Promise<Map<string, SessionWithStats>> {
  if (sessionIds.length === 0) {
    return new Map()
  }

  // Get all requested sessions in one query
  const sessionsList = await db
    .select()
    .from(sessions)
    .where(inArray(sessions.id, sessionIds))
    .execute()
  
  // Create a map for quick lookup
  const sessionMap = new Map<string, Session>()
  sessionsList.forEach(session => {
    sessionMap.set(session.id, session)
  })

  // Get all events for all sessions in one query
  const allEvents = await db
    .select()
    .from(events)
    .where(inArray(events.memva_session_id, sessionIds))
    .orderBy(events.memva_session_id, events.timestamp)
    .execute()

  // Group events by session
  const eventsBySession = new Map<string, typeof allEvents>()
  allEvents.forEach(event => {
    if (!event.memva_session_id) return
    
    if (!eventsBySession.has(event.memva_session_id)) {
      eventsBySession.set(event.memva_session_id, [])
    }
    const sessionEvents = eventsBySession.get(event.memva_session_id)
    if (sessionEvents) {
      sessionEvents.push(event)
    }
  })

  // Calculate stats for each session
  const resultsMap = new Map<string, SessionWithStats>()
  
  sessionIds.forEach(sessionId => {
    const session = sessionMap.get(sessionId)
    if (!session) return
    
    const sessionEvents = eventsBySession.get(sessionId) || []
    const event_count = getVisibleEventCount(sessionEvents)
    let duration_minutes = 0
    let last_event_at: string | undefined
    const event_types: Record<string, number> = {}
    
    if (sessionEvents.length > 0) {
      const firstTimestamp = new Date(sessionEvents[0].timestamp).getTime()
      const lastTimestamp = new Date(sessionEvents[sessionEvents.length - 1].timestamp).getTime()
      duration_minutes = Math.round((lastTimestamp - firstTimestamp) / (1000 * 60))
      last_event_at = sessionEvents[sessionEvents.length - 1].timestamp
    }
    
    // Count event types
    for (const event of sessionEvents) {
      event_types[event.event_type] = (event_types[event.event_type] || 0) + 1
    }
    
    resultsMap.set(sessionId, {
      ...session,
      event_count,
      duration_minutes,
      event_types,
      last_event_at
    })
  })
  
  return resultsMap
}

export async function updateSessionSettings(sessionId: string, settings: Partial<SettingsConfig>): Promise<void> {
  // First get the existing session to ensure it exists
  const existingSession = await getSession(sessionId)
  if (!existingSession) {
    throw new Error('Session not found')
  }
  
  // Merge the new settings with existing settings
  const currentSettings = existingSession.settings || {}
  const updatedSettings = {
    ...currentSettings,
    ...settings
  }
  
  await db
    .update(sessions)
    .set({ 
      settings: updatedSettings,
      updated_at: new Date().toISOString()
    })
    .where(eq(sessions.id, sessionId))
    .execute()
}

export async function getSessionSettings(sessionId: string): Promise<SettingsConfig> {
  const session = await getSession(sessionId)
  if (!session) {
    throw new Error('Session not found')
  }
  
  // Return session settings if available, otherwise fall back to global settings
  if (session.settings && typeof session.settings === 'object' && Object.keys(session.settings).length > 0) {
    return session.settings as SettingsConfig
  }
  
  return await getSettings()
}

export async function countArchivedSessions(): Promise<number> {
  const result = await db
    .select({ count: sessions.id })
    .from(sessions)
    .where(eq(sessions.status, 'archived'))
    .execute()
  
  return result.length
}

export async function getSessionTokenStats(sessionId: string): Promise<TokenStats | null> {
  // Get the latest result event which contains the current Claude session's token usage
  const resultEvents = await db
    .select({
      data: events.data,
      timestamp: events.timestamp
    })
    .from(events)
    .where(
      and(
        eq(events.memva_session_id, sessionId),
        eq(events.event_type, 'result')
      )
    )
    .orderBy(desc(events.timestamp))
    .limit(1)
    .execute()
  
  if (resultEvents.length === 0) {
    return null
  }
  
  const latestResult = resultEvents[0]
  
  if (latestResult.data && typeof latestResult.data === 'object') {
    const data = latestResult.data as Record<string, unknown>
    const usage = data.usage as {
      input_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
      output_tokens?: number
    } | undefined
    
    if (!usage) {
      return null
    }
    
    const totalInputTokens = usage.input_tokens || 0
    const totalCacheReadTokens = usage.cache_read_input_tokens || 0
    const totalCacheCreationTokens = usage.cache_creation_input_tokens || 0
    const totalOutputTokens = usage.output_tokens || 0
    
    // Context usage: what actually counts against Claude's limit (excluding cache creation)
    const contextUsed = totalInputTokens + totalOutputTokens + totalCacheReadTokens
    
    // Total tokens for activity tracking (includes cache creation)
    const totalTokens = contextUsed + totalCacheCreationTokens
    
    // Estimate percentage of context window used (200k limit)
    const contextPercentage = Math.min(100, (contextUsed / 200000) * 100)
    
    // Calculate cache efficiency
    const totalInputIncludingCache = totalInputTokens + totalCacheReadTokens
    const cacheEfficiency = totalInputIncludingCache > 0 
      ? (totalCacheReadTokens / totalInputIncludingCache) * 100 
      : 0
    
    return {
      total_tokens: totalTokens,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cache_read_tokens: totalCacheReadTokens,
      cache_creation_tokens: totalCacheCreationTokens,
      context_percentage: Math.round(contextPercentage * 100) / 100,
      cache_efficiency: Math.round(cacheEfficiency * 100) / 100,
      context_used: contextUsed
    }
  }
  
  return null
}