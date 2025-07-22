import { listSessions, getSessionsWithStatsBatch } from "../db/sessions.service"
import { getLatestAssistantMessageBatch, getLatestUserMessageWithTextBatch } from "../db/event-session.service"
import { getPendingPermissionsCountBatch } from "../db/permissions.service"

export async function loader() {
  try {
    const sessions = await listSessions({ status: 'active' })
    
    if (sessions.length === 0) {
      return Response.json({
        sessions: [],
        timestamp: new Date().toISOString()
      })
    }
    
    const sessionIds = sessions.map(s => s.id)
    
    const [sessionStatsMap, latestMessagesMap, latestUserMessagesMap, pendingPermissionsMap] = await Promise.all([
      getSessionsWithStatsBatch(sessionIds),
      getLatestAssistantMessageBatch(sessionIds),
      getLatestUserMessageWithTextBatch(sessionIds),
      getPendingPermissionsCountBatch(sessionIds)
    ])
    
    const enhancedSessions = sessions.map(session => {
      const stats = sessionStatsMap.get(session.id)
      const latestMessage = latestMessagesMap.get(session.id)
      const latestUserMessage = latestUserMessagesMap.get(session.id)
      const pendingPermissionsCount = pendingPermissionsMap.get(session.id) || 0
      
      return {
        ...session,
        event_count: stats?.event_count || 0,
        last_event_at: stats?.last_event_at || session.updated_at,
        latest_user_message_at: latestUserMessage?.timestamp || null,
        pendingPermissionsCount,
        latestMessage: latestMessage ? {
          uuid: latestMessage.uuid,
          timestamp: latestMessage.timestamp,
          data: latestMessage.data
        } : null
      }
    })
    
    return Response.json({
      sessions: enhancedSessions,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[API Sessions Homepage] Error fetching data:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}