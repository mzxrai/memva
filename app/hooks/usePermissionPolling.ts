import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PermissionRequest } from '../db/schema'

interface UsePermissionPollingOptions {
  enabled?: boolean
  pollingInterval?: number
  sessionId?: string
  onPermissionsCleared?: () => void
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
  const { enabled = true, pollingInterval = 1000, sessionId, onPermissionsCleared } = options
  const queryClient = useQueryClient()
  
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
      const newPermissions = data.permissions || []
      
      // Only update state if permissions have actually changed
      setPermissions(prev => {
        // Quick length check first
        if (prev.length !== newPermissions.length) {
          return newPermissions
        }
        
        // Deep comparison of permission IDs
        const prevIds = prev.map(p => p.id).sort()
        const newIds = newPermissions.map(p => p.id).sort()
        const hasChanged = prevIds.some((id, index) => id !== newIds[index])
        
        return hasChanged ? newPermissions : prev
      })
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
      // Check if this will be the last permission
      const willBeLastPermission = permissions.filter(p => p.status === 'pending').length === 1;
      
      // Optimistically remove the approved permission from state
      setPermissions(prev => prev.filter(p => p.id !== requestId))
      
      setIsProcessing(true)
      const response = await fetch(`/api/permissions/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'allow' })
      })
      
      if (!response.ok) {
        const error = await response.json()
        // Revert optimistic update on error
        await fetchPermissions()
        throw new Error(error.error || 'Failed to approve permission')
      }
      
      // Invalidate homepage data to update session status
      queryClient.invalidateQueries({ queryKey: ['homepage-sessions'] })
      
      // If this was the last permission, notify the parent
      if (willBeLastPermission && onPermissionsCleared) {
        onPermissionsCleared()
      }
      
      // Don't refetch after successful approval - we already updated optimistically
    } catch (err) {
      console.error('Failed to approve permission:', err)
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [fetchPermissions, queryClient, permissions, onPermissionsCleared])

  const deny = useCallback(async (requestId: string) => {
    try {
      // Check if this will be the last permission
      const willBeLastPermission = permissions.filter(p => p.status === 'pending').length === 1;
      
      // Optimistically remove the denied permission from state
      setPermissions(prev => prev.filter(p => p.id !== requestId))
      
      setIsProcessing(true)
      const response = await fetch(`/api/permissions/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'deny' })
      })
      
      if (!response.ok) {
        const error = await response.json()
        // Revert optimistic update on error
        await fetchPermissions()
        throw new Error(error.error || 'Failed to deny permission')
      }
      
      // Invalidate homepage data to update session status
      queryClient.invalidateQueries({ queryKey: ['homepage-sessions'] })
      
      // If this was the last permission, notify the parent
      if (willBeLastPermission && onPermissionsCleared) {
        onPermissionsCleared()
      }
      
      // Don't refetch after successful denial - we already updated optimistically
      // This prevents the UI from showing stale data while the backend processes
    } catch (err) {
      console.error('Failed to deny permission:', err)
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [fetchPermissions, queryClient, permissions, onPermissionsCleared])

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

  const pendingCount = permissions?.length || 0

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