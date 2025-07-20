import { useState, useEffect, useCallback } from 'react'
import type { PermissionRequest } from '../db/schema'
import { getPendingPermissionRequests, updatePermissionDecision } from '../db/permissions.service'

interface UsePermissionPollingOptions {
  enabled?: boolean
  pollingInterval?: number
}

interface UsePermissionPollingReturn {
  permissions: PermissionRequest[]
  pendingCount: number
  isLoading: boolean
  error: string | null
  approve: (requestId: string) => Promise<void>
  deny: (requestId: string) => Promise<void>
}

export default function usePermissionPolling(options: UsePermissionPollingOptions = {}): UsePermissionPollingReturn {
  const { enabled = true, pollingInterval = 500 } = options
  
  const [permissions, setPermissions] = useState<PermissionRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPermissions = useCallback(async () => {
    try {
      const data = await getPendingPermissionRequests()
      setPermissions(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch permissions:', err)
      setError('Failed to fetch permissions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const approve = useCallback(async (requestId: string) => {
    try {
      await updatePermissionDecision(requestId, { decision: 'allow' })
      await fetchPermissions() // Refetch after update
    } catch (err) {
      console.error('Failed to approve permission:', err)
      throw err
    }
  }, [fetchPermissions])

  const deny = useCallback(async (requestId: string) => {
    try {
      await updatePermissionDecision(requestId, { decision: 'deny' })
      await fetchPermissions() // Refetch after update
    } catch (err) {
      console.error('Failed to deny permission:', err)
      throw err
    }
  }, [fetchPermissions])

  useEffect(() => {
    if (!enabled) return

    // Initial fetch
    fetchPermissions()

    // Set up polling
    const intervalId = setInterval(fetchPermissions, pollingInterval)

    return () => {
      clearInterval(intervalId)
    }
  }, [enabled, pollingInterval, fetchPermissions])

  const pendingCount = permissions.length

  return {
    permissions,
    pendingCount,
    isLoading,
    error,
    approve,
    deny
  }
}