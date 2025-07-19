import { EventEmitter } from 'events'
import { listSessions, getSessionWithStats } from '../db/sessions.service'
import { getLatestAssistantMessageBatch } from '../db/event-session.service'

type PollResult = {
  sessionId: string
  message: {
    uuid: string
    timestamp: string
    data: unknown
  } | null
  eventCount: number
}

class HomepagePoller extends EventEmitter {
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private connectionCount = 0

  startPolling() {
    this.connectionCount++
    console.log(`[HomepagePoller] Connection added, total: ${this.connectionCount}`)
    
    // Only start polling if this is the first connection
    if (this.connectionCount === 1) {
      console.log('[HomepagePoller] Starting global polling')
      this.pollInterval = setInterval(() => this.poll(), 1000)
      // Initial poll
      this.poll()
    }
  }

  stopPolling() {
    this.connectionCount--
    console.log(`[HomepagePoller] Connection removed, total: ${this.connectionCount}`)
    
    // Only stop polling if there are no more connections
    if (this.connectionCount === 0 && this.pollInterval) {
      console.log('[HomepagePoller] Stopping global polling')
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  private async poll() {
    try {
      const sessions = await listSessions({ status: 'active' })
      const sessionIds = sessions.map(s => s.id)
      
      if (sessionIds.length === 0) return
      
      const latestMessagesMap = await getLatestAssistantMessageBatch(sessionIds)
      console.log(`[HomepagePoller] Found ${latestMessagesMap.size} sessions, ${Array.from(latestMessagesMap.values()).filter(v => v !== null).length} with assistant messages`)
      
      const sessionStatsMap = new Map<string, number>(
        await Promise.all(
          sessions.map(async (session): Promise<[string, number]> => {
            if ('event_count' in session && typeof session.event_count === 'number') {
              return [session.id, session.event_count]
            }
            const stats = await getSessionWithStats(session.id)
            return [session.id, stats?.event_count || 0]
          })
        )
      )
      
      const updates: PollResult[] = sessionIds.map(sessionId => {
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
      
      // Emit the updates to all listeners
      this.emit('updates', updates)
    } catch (error) {
      console.error('[HomepagePoller] Error polling messages:', error)
    }
  }
}

// Global singleton instance
export const homepagePoller = new HomepagePoller()