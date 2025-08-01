import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { SessionWithStats } from '../db/sessions.service'

type EnhancedSession = SessionWithStats & {
  latest_user_message_at?: string | null
  pendingPermissionsCount?: number
  latestMessage?: {
    uuid: string
    timestamp: string
    data: unknown
  } | null
}

type HomepageData = {
  sessions: EnhancedSession[]
  archivedCount: number
  timestamp: string
}

export function useHomepageData() {
  const { data, error, isLoading } = useQuery<HomepageData>({
    queryKey: ['homepage-sessions'],
    queryFn: async () => {
      const response = await fetch('/api/sessions/homepage')
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`)
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - prevents conflicts with polling interval
    refetchInterval: 2000, // Poll every 2 seconds
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  })

  // Memoize sessions to maintain referential equality when data hasn't changed
  const sessions = useMemo(() => {
    return data?.sessions || [];
  }, [data?.sessions]);

  return {
    sessions,
    archivedCount: data?.archivedCount || 0,
    timestamp: data?.timestamp || new Date().toISOString(),
    error,
    isLoading,
  }
}