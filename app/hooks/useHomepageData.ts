import { useQuery } from '@tanstack/react-query'
import type { SessionWithStats } from '../db/sessions.service'

type EnhancedSession = SessionWithStats & {
  latest_user_message_at?: string | null
  latestMessage?: {
    uuid: string
    timestamp: string
    data: unknown
  } | null
}

type HomepageData = {
  sessions: EnhancedSession[]
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
      return response.json()
    },
    refetchInterval: 3000, // Poll every 3 seconds
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  })

  return {
    sessions: data?.sessions || [],
    timestamp: data?.timestamp || new Date().toISOString(),
    error,
    isLoading,
  }
}