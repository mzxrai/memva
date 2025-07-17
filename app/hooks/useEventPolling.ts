import { useState, useEffect } from 'react'
import type { Event } from '../db/schema'

export function useEventPolling(sessionId: string) {
  const [events, setEvents] = useState<Event[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let isMounted = true

    const pollEvents = async () => {
      if (!isMounted) return

      try {
        setIsPolling(true)
        const response = await fetch(`/api/session/${sessionId}`)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (isMounted) {
          setEvents(data.events)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch events')
        }
      } finally {
        if (isMounted) {
          setIsPolling(false)
        }
      }
    }

    // Initial fetch
    pollEvents()

    // Poll every 2 seconds
    intervalId = setInterval(pollEvents, 2000)

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [sessionId])

  return { events, error, isPolling }
}