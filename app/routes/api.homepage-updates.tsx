import type { Route } from "./+types/api.homepage-updates"
import { listSessions, getSessionWithStats } from "../db/sessions.service"
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

  // Create SSE stream that sends updates for all active sessions
  let statusChangeHandler: ((event: SessionStatusEvent) => void) | null = null
  let pollInterval: ReturnType<typeof setInterval> | null = null
  let timeSyncInterval: ReturnType<typeof setInterval> | null = null
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      // Helper to send SSE messages
      const send = (data: Record<string, unknown>) => {
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        } catch (error) {
          console.error('[Homepage SSE] Error sending message:', error)
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
      
      // 2. Poll for latest messages and event counts
      const pollMessages = async () => {
        try {
          // Get all active sessions with stats
          const sessions = await listSessions({ status: 'active' })
          const sessionIds = sessions.map(s => s.id)
          
          if (sessionIds.length === 0) return
          
          // Single efficient query for all latest messages
          const latestMessagesMap = await getLatestAssistantMessageBatch(sessionIds)
          console.log(`[Homepage SSE] Found ${latestMessagesMap.size} sessions, ${Array.from(latestMessagesMap.values()).filter(v => v !== null).length} with assistant messages`)
          
          // Get stats for event counts (we already have this from listSessions if they're SessionWithStats)
          const sessionStatsMap = new Map<string, number>(
            await Promise.all(
              sessions.map(async (session): Promise<[string, number]> => {
                // If session already has event_count, use it
                if ('event_count' in session && typeof session.event_count === 'number') {
                  return [session.id, session.event_count]
                }
                // Otherwise fetch stats
                const stats = await getSessionWithStats(session.id)
                return [session.id, stats?.event_count || 0]
              })
            )
          )
          
          // Build updates array
          const updates = sessionIds.map(sessionId => {
            const latestMessage = latestMessagesMap.get(sessionId)
            return {
              sessionId,
              message: latestMessage ? {
                uuid: latestMessage.uuid,
                timestamp: latestMessage.timestamp,
                data: latestMessage.data
              } : null,
              eventCount: sessionStatsMap.get(sessionId) || 0
            }
          })
          
          // Send batch update
          send({
            type: 'message_updates',
            updates,
            timestamp: new Date().toISOString()
          })
        } catch (error) {
          console.error('[Homepage SSE] Error polling messages:', error)
        }
      }
      
      // Initial poll
      await pollMessages()
      
      // Poll every 1 second for more responsive updates
      pollInterval = setInterval(pollMessages, 1000)
      
      // 3. Time sync for relative time updates
      timeSyncInterval = setInterval(() => {
        send({
          type: 'time_sync',
          timestamp: Date.now()
        })
      }, 30000) // Every 30 seconds
      
      // Cleanup will be handled in cancel method
    },
    cancel() {
      // Stream canceled - cleanup
      if (statusChangeHandler) {
        sessionStatusEmitter.off('status-change', statusChangeHandler)
        statusChangeHandler = null
      }
      
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
      
      if (timeSyncInterval) {
        clearInterval(timeSyncInterval)
        timeSyncInterval = null
      }
      
      console.log('[Homepage SSE] Connection closed, cleanup complete')
    }
  })

  return new Response(stream, { headers })
}