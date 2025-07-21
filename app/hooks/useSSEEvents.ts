import { useState, useEffect, useRef } from 'react'
import type { Event } from '../db/schema'

type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

type UseSSEEventsReturn = {
  newEvents: Event[]
  error: string | null
  connectionState: SSEConnectionState
  sessionStatus: string | null
}

export function useSSEEvents(sessionId: string): UseSSEEventsReturn {
  const [newEvents, setNewEvents] = useState<Event[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected')
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const eventUUIDsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!sessionId) return

    // Clear the event UUIDs when switching sessions
    eventUUIDsRef.current.clear()
    
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
        
        // Handle connection messages with initial session status
        if (data.type === 'connection') {
          if (data.sessionStatus) {
            setSessionStatus(data.sessionStatus)
          }
          return
        }
        
        // Handle session status updates
        if (data.type === 'session_status') {
          setSessionStatus(data.status)
          return
        }
        
        // Filter out protocol messages - only process actual events
        if (!data.uuid || !data.event_type) {
          return
        }
        
        // Only add if it's a new event (not already in our list)
        if (!eventUUIDsRef.current.has(data.uuid)) {
          eventUUIDsRef.current.add(data.uuid)
          setNewEvents(prev => [...prev, data])
        }
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
    connectionState,
    sessionStatus
  }
}