import { useState, useEffect } from 'react'
import { getSession } from '../db/sessions.service'
import type { Session } from '../db/schema'

export function useSessionStatus(sessionId: string) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let isMounted = true

    const pollSession = async () => {
      if (!isMounted) return

      try {
        setIsLoading(true)
        const fetchedSession = await getSession(sessionId)
        
        if (isMounted) {
          setSession(fetchedSession)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch session')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    // Initial fetch
    pollSession()

    // Poll every 2 seconds
    intervalId = setInterval(pollSession, 2000)

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [sessionId])

  return { session, error, isLoading }
}