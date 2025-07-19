import type { Route } from "./+types/api.homepage-updates"
import { listSessions, getSessionWithStats, getSessionsWithStatsBatch } from "../db/sessions.service"
import { getLatestAssistantMessageBatch } from "../db/event-session.service"
import type { SessionStatusEvent } from "../services/session-status-emitter.server"

// GET endpoint for SSE updates for all active sessions on homepage
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loader({ request }: Route.LoaderArgs) {
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  })

  // Import the session status emitter
  const { sessionStatusEmitter } = await import('../services/session-status-emitter.server')

  // Create unique connection ID for debugging
  const connectionId = Math.random().toString(36).substring(7)
  console.log(`[Homepage SSE] New connection: ${connectionId}`)

  // Create SSE stream that sends updates for all active sessions
  let statusChangeHandler: ((event: SessionStatusEvent) => void) | null = null
  let homepageUpdateHandler: ((event: import('../services/homepage-events.server').HomepageEvent) => Promise<void>) | null = null
  let timeSyncInterval: ReturnType<typeof setInterval> | null = null
  let isActive = true // Track if this stream is still active
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      // Helper to send SSE messages
      const send = (data: Record<string, unknown>) => {
        if (!isActive) {
          return
        }
        
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        } catch (error) {
          console.error(`[Homepage SSE] Connection ${connectionId}: Error sending message:`, error)
          // Mark as inactive to prevent further attempts
          isActive = false
        }
      }
      
      
      // Send initial connection message
      send({ 
        type: 'connection', 
        status: 'connected',
        timestamp: new Date().toISOString()
      })
      
      // 1. Listen for ALL session status changes
      statusChangeHandler = (event: SessionStatusEvent) => {
        send({
          type: 'session_status',
          sessionId: event.sessionId,
          status: event.status,
          timestamp: event.timestamp
        })
      }
      
      // Listen to the general status-change event (not session-specific)
      sessionStatusEmitter.on('status-change', statusChangeHandler)
      
      // 2. Listen for homepage events (event-driven instead of polling)
      const { homepageEvents } = await import('../services/homepage-events.server')
      
      // Handler for homepage updates
      homepageUpdateHandler = async (event: import('../services/homepage-events.server').HomepageEvent) => {
        console.log(`[Homepage SSE] Received event: ${event.type} for session ${event.sessionId}`)
        
        // When we get an event, fetch fresh data for that session
        if (event.type === 'message_created' || event.type === 'event_created') {
          try {
            const session = await getSessionWithStats(event.sessionId)
            if (!session || session.status !== 'active') return
            
            // Get latest assistant message for this session
            const latestMessagesMap = await getLatestAssistantMessageBatch([event.sessionId])
            const latestMessage = latestMessagesMap.get(event.sessionId)
            
            // Send update for this specific session
            send({
              type: 'message_updates',
              updates: [{
                sessionId: event.sessionId,
                message: latestMessage ? {
                  uuid: latestMessage.uuid,
                  timestamp: latestMessage.timestamp,
                  data: latestMessage.data
                } : null,
                eventCount: session.event_count || 0,
                lastEventAt: session.last_event_at
              }],
              timestamp: new Date().toISOString()
            })
          } catch (error) {
            console.error(`[Homepage SSE] Error handling event for session ${event.sessionId}:`, error)
          }
        }
      }
      
      // Listen for events
      homepageEvents.on('homepage_update', homepageUpdateHandler)
      
      // Send initial data once on connection
      const sendInitialData = async () => {
        try {
          const sessions = await listSessions({ status: 'active' })
          const sessionIds = sessions.map(s => s.id)
          
          if (sessionIds.length === 0) return
          
          // Fetch all data in parallel with just 2 queries total!
          const [latestMessagesMap, sessionsWithStatsMap] = await Promise.all([
            getLatestAssistantMessageBatch(sessionIds),
            getSessionsWithStatsBatch(sessionIds)
          ])
          
          const updates = sessionIds.map(sessionId => {
            const latestMessage = latestMessagesMap.get(sessionId)
            const stats = sessionsWithStatsMap.get(sessionId)
            return {
              sessionId,
              message: latestMessage ? {
                uuid: latestMessage.uuid,
                timestamp: latestMessage.timestamp,
                data: latestMessage.data
              } : null,
              eventCount: stats?.event_count || 0,
              lastEventAt: stats?.last_event_at
            }
          })
          
          send({
            type: 'message_updates',
            updates,
            timestamp: new Date().toISOString()
          })
        } catch (error) {
          console.error('[Homepage SSE] Error sending initial data:', error)
        }
      }
      
      await sendInitialData()
      
      // 3. Time sync for relative time updates
      timeSyncInterval = setInterval(() => {
        send({
          type: 'time_sync',
          timestamp: Date.now()
        })
      }, 30000) // Every 30 seconds
      
      // Cleanup will be handled in cancel method
    },
    async cancel() {
      // Mark stream as inactive first
      isActive = false
      
      
      // Stream canceled - cleanup
      if (statusChangeHandler) {
        sessionStatusEmitter.off('status-change', statusChangeHandler)
        statusChangeHandler = null
      }
      
      // Remove homepage event listener
      if (homepageUpdateHandler) {
        const { homepageEvents } = await import('../services/homepage-events.server')
        homepageEvents.off('homepage_update', homepageUpdateHandler)
        homepageUpdateHandler = null
      }
      
      if (timeSyncInterval) {
        clearInterval(timeSyncInterval)
        timeSyncInterval = null
      }
      
      console.log(`[Homepage SSE] Connection ${connectionId}: Closed, cleanup complete`)
    }
  })

  return new Response(stream, { headers })
}