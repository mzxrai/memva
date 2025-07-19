import { listSessions, getSessionsWithStatsBatch } from "../db/sessions.service"
import { getLatestAssistantMessageBatch } from "../db/event-session.service"

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
    
    const [sessionStatsMap, latestMessagesMap] = await Promise.all([
      getSessionsWithStatsBatch(sessionIds),
      getLatestAssistantMessageBatch(sessionIds)
    ])
    
    const enhancedSessions = sessions.map(session => {
      const stats = sessionStatsMap.get(session.id)
      const latestMessage = latestMessagesMap.get(session.id)
      
      if (latestMessage) {
        console.log(`[API Sessions Homepage] Session ${session.id} has latest message:`, {
          uuid: latestMessage.uuid,
          timestamp: latestMessage.timestamp
        })
      }
      
      return {
        ...session,
        event_count: stats?.event_count || 0,
        last_event_at: stats?.last_event_at || session.updated_at,
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