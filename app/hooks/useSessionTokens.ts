import { useQuery } from '@tanstack/react-query'
import { useEventStore } from '../stores/event-store'
import type { TokenStats } from '../db/sessions.service'
import { useEffect } from 'react'

export function useSessionTokens(sessionId: string) {
  // Get event count from store to trigger refetch when new events arrive
  const eventCount = useEventStore(state => 
    Array.from(state.events.values()).filter(e => 
      e.memva_session_id === sessionId && e.event_type === 'assistant'
    ).length
  )
  
  const { data: tokenStats, refetch } = useQuery<TokenStats | null>({
    queryKey: ['session-tokens', sessionId, eventCount],
    queryFn: async () => {
      const response = await fetch(`/api/session/${sessionId}/tokens`)
      if (!response.ok) {
        throw new Error('Failed to fetch token stats')
      }
      const data = await response.json()
      return data.tokenStats
    },
    enabled: !!sessionId,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
  
  // Refetch when new assistant events are added
  useEffect(() => {
    if (eventCount > 0) {
      refetch()
    }
  }, [eventCount, refetch])
  
  return {
    tokenStats,
    refetch
  }
}