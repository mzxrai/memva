import { useState, useEffect, useRef } from 'react'
import type { Event } from '../db/schema'

type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

type UseSSEEventsReturn = {
  newEvents: Event[]
  error: string | null
  connectionState: SSEConnectionState
}

export function useSSEEvents(sessionId: string): UseSSEEventsReturn {
  const [newEvents, setNewEvents] = useState<Event[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!sessionId) return

    setConnectionState('connecting')
    setError(null)

    // Create EventSource connection to SSE endpoint
    const eventSource = new EventSource(`/api/claude-code/${sessionId}`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnectionState('connected')
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Filter out connection/protocol messages - only process actual events
        if (data.type === 'connection' || !data.uuid || !data.event_type) {
          console.log('SSE protocol message:', data)
          return
        }
        
        // Only add if it's a new event (not already in our list)
        setNewEvents(prev => {
          const eventExists = prev.some(e => e.uuid === data.uuid)
          if (eventExists) return prev
          return [...prev, data]
        })
      } catch (err) {
        console.error('Error parsing SSE message:', err)
        setError('Failed to parse incoming event')
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err)
      setConnectionState('error')
      setError('Connection to server lost')
    }

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setConnectionState('disconnected')
    }
  }, [sessionId])

  return {
    newEvents,
    error,
    connectionState
  }
}