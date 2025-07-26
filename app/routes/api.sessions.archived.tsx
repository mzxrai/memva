import { listSessions, getSessionsWithStatsBatch } from "../db/sessions.service"
import { getLatestAssistantMessageBatch, getLatestUserMessageWithTextBatch } from "../db/event-session.service"

export async function loader() {
  try {
    const sessions = await listSessions({ status: 'archived' })
    
    if (sessions.length === 0) {
      return Response.json({
        sessions: [],
        timestamp: new Date().toISOString()
      })
    }
    
    const sessionIds = sessions.map(s => s.id)
    
    const [sessionStatsMap, latestMessagesMap, latestUserMessagesMap] = await Promise.all([
      getSessionsWithStatsBatch(sessionIds),
      getLatestAssistantMessageBatch(sessionIds),
      getLatestUserMessageWithTextBatch(sessionIds)
    ])
    
    const enhancedSessions = sessions.map(session => {
      const stats = sessionStatsMap.get(session.id)
      const latestMessage = latestMessagesMap.get(session.id)
      const latestUserMessage = latestUserMessagesMap.get(session.id)
      
      return {
        ...session,
        event_count: stats?.event_count || 0,
        last_event_at: stats?.last_event_at || session.updated_at,
        latest_user_message_at: latestUserMessage?.timestamp || null,
        latestMessage: latestMessage ? {
          uuid: latestMessage.uuid,
          timestamp: latestMessage.timestamp,
          data: latestMessage.data
        } : null
      }
    })
    
    // Sort by updated_at (archive time) in descending order
    const sortedSessions = enhancedSessions.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    
    return Response.json({
      sessions: sortedSessions,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[API Sessions Archived] Error fetching data:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}