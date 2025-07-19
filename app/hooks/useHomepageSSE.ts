import { useState, useEffect, useRef } from 'react'

type SessionUpdate = {
  status?: string
  latestMessage?: {
    uuid: string
    timestamp: string
    data: unknown
  } | null
  eventCount?: number
  lastEventAt?: string
}

type UseHomepageSSEReturn = {
  sessionUpdates: Map<string, SessionUpdate>
  lastTimeSync: number
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export function useHomepageSSE(): UseHomepageSSEReturn {
  const [sessionUpdates, setSessionUpdates] = useState<Map<string, SessionUpdate>>(new Map())
  const [lastTimeSync, setLastTimeSync] = useState(Date.now())
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    setConnectionState('connecting')

    // Create EventSource connection to homepage SSE endpoint
    const eventSource = new EventSource('/api/homepage-updates')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnectionState('connected')
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'connection':
            // Connection confirmed
            break
            
          case 'session_status':
            // Update status for a specific session
            setSessionUpdates(prev => {
              const next = new Map(prev)
              const existing = next.get(data.sessionId) || {}
              next.set(data.sessionId, {
                ...existing,
                status: data.status
              })
              return next
            })
            break
            
          case 'message_updates':
            // Batch update messages and event counts
            setSessionUpdates(prev => {
              const next = new Map(prev)
              data.updates.forEach((update: {
                sessionId: string
                message: { uuid: string; timestamp: string; data: unknown } | null
                eventCount: number
                lastEventAt?: string
              }) => {
                const existing = next.get(update.sessionId) || {}
                const newUpdate: SessionUpdate = {
                  ...existing,
                  eventCount: update.eventCount
                }
                
                // Only update latestMessage if we have a text message
                if (update.message !== null) {
                  // Check if this is a text message (not tool use)
                  const messageData = update.message.data as { message?: { content?: Array<{ type: string }> } } | null
                  const hasTextContent = messageData && 
                    typeof messageData === 'object' && 
                    'message' in messageData &&
                    messageData.message?.content?.some(item => item.type === 'text')
                  
                  if (hasTextContent) {
                    // Update with new text message
                    newUpdate.latestMessage = update.message
                  } else if (existing.latestMessage) {
                    // Preserve existing message when receiving non-text messages
                    newUpdate.latestMessage = existing.latestMessage
                  }
                } else if (existing.latestMessage) {
                  // Preserve existing message if update has null message
                  newUpdate.latestMessage = existing.latestMessage
                }
                
                // Update last event timestamp if provided
                if (update.lastEventAt) {
                  newUpdate.lastEventAt = update.lastEventAt
                }
                
                next.set(update.sessionId, newUpdate)
              })
              return next
            })
            break
            
          case 'time_sync':
            // Update time sync for relative time displays
            setLastTimeSync(data.timestamp)
            break
            
          default:
            // Unknown message type - ignore
        }
      } catch (err) {
        console.error('[Homepage SSE] Error parsing message:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('[Homepage SSE] Connection error:', err)
      setConnectionState('error')
      
      // EventSource will auto-reconnect, but we can add custom logic here if needed
      // For now, just log the error
    }

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setConnectionState('disconnected')
    }
  }, []) // Empty deps - only connect once on mount

  return {
    sessionUpdates,
    lastTimeSync,
    connectionState
  }
}