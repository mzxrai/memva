import { useState, useEffect, useCallback } from 'react'
import type { PermissionRequest } from '../db/schema'

interface UsePermissionPollingOptions {
  enabled?: boolean
  pollingInterval?: number
  sessionId?: string
}

interface UsePermissionPollingReturn {
  permissions: PermissionRequest[]
  pendingCount: number
  isLoading: boolean
  error: string | null
  approve: (requestId: string) => Promise<void>
  deny: (requestId: string) => Promise<void>
  isProcessing: boolean
}

export default function usePermissionPolling(options: UsePermissionPollingOptions = {}): UsePermissionPollingReturn {
  const { enabled = true, pollingInterval = 500, sessionId } = options
  
  const [permissions, setPermissions] = useState<PermissionRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchPermissions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (sessionId) {
        params.append('sessionId', sessionId)
      }
      params.append('status', 'pending')
      
      const response = await fetch(`/api/permissions?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch permissions')
      }
      
      const data = await response.json() as { permissions: PermissionRequest[] }
      setPermissions(data.permissions)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch permissions:', err)
      setError('Failed to fetch permissions')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  const approve = useCallback(async (requestId: string) => {
    try {
      setIsProcessing(true)
      const response = await fetch(`/api/permissions/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'allow' })
      })
      
      if (!response.ok) {
        throw new Error('Failed to approve permission')
      }
      
      await fetchPermissions() // Refetch after update
    } catch (err) {
      console.error('Failed to approve permission:', err)
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [fetchPermissions])

  const deny = useCallback(async (requestId: string) => {
    try {
      setIsProcessing(true)
      const response = await fetch(`/api/permissions/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'deny' })
      })
      
      if (!response.ok) {
        throw new Error('Failed to deny permission')
      }
      
      await fetchPermissions() // Refetch after update
    } catch (err) {
      console.error('Failed to deny permission:', err)
      throw err
    } finally {
      setIsProcessing(false)
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
    deny,
    isProcessing
  }
}