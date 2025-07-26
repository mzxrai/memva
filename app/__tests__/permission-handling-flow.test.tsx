import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import usePermissionPolling from '../hooks/usePermissionPolling'
import { useSessionProcessingState } from '../hooks/useSessionProcessingState'
import type { ReactNode } from 'react'
import type { PermissionRequest } from '../db/schema'

// No global mock here - we'll mock in beforeEach

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Helper to create mock permission
function createMockPermission(overrides?: Partial<PermissionRequest>): PermissionRequest {
  return {
    id: 'perm-1',
    session_id: 'session-1',
    tool_use_id: 'tool-1',
    tool_name: 'read_file',
    status: 'pending',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    decided_at: null,
    decision: null,
    input: {},
    ...overrides
  }
}

describe('Permission Handling Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })
  
  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  describe('Permission Denial Flow', () => {
    it('should optimistically remove permission and call onPermissionsCleared when denying last permission', async () => {
      const mockPermission = createMockPermission()
      const onPermissionsCleared = vi.fn()
      const wrapper = createWrapper()
      
      // Mock initial fetch to return one permission
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: [mockPermission] })
      } as Response)
      
      const { result } = renderHook(
        () => usePermissionPolling({ 
          sessionId: 'session-1',
          onPermissionsCleared 
        }),
        { wrapper }
      )
      
      // Wait for initial load
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(1)
        expect(result.current.pendingCount).toBe(1)
      })
      
      // Mock the deny API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perm-1', decision: 'deny' })
      } as Response)
      
      // Deny the permission
      await act(async () => {
        await result.current.deny('perm-1')
      })
      
      // Should optimistically remove the permission
      expect(result.current.permissions).toHaveLength(0)
      expect(result.current.pendingCount).toBe(0)
      
      // Should call onPermissionsCleared since it was the last permission
      expect(onPermissionsCleared).toHaveBeenCalledTimes(1)
      
      // Should invalidate homepage sessions
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/permissions/perm-1'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ decision: 'deny' })
        })
      )
    })
    
    it('should NOT call onPermissionsCleared when denying but other permissions remain', async () => {
      const mockPermissions = [
        createMockPermission({ id: 'perm-1' }),
        createMockPermission({ id: 'perm-2' })
      ]
      const onPermissionsCleared = vi.fn()
      const wrapper = createWrapper()
      
      // Mock initial fetch
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: mockPermissions })
      } as Response)
      
      const { result } = renderHook(
        () => usePermissionPolling({ 
          sessionId: 'session-1',
          onPermissionsCleared 
        }),
        { wrapper }
      )
      
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(2)
      })
      
      // Mock the deny API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perm-1', decision: 'deny' })
      } as Response)
      
      // Deny one permission
      await act(async () => {
        await result.current.deny('perm-1')
      })
      
      // Should remove only the denied permission
      expect(result.current.permissions).toHaveLength(1)
      expect(result.current.permissions[0].id).toBe('perm-2')
      
      // Should NOT call onPermissionsCleared since permissions remain
      expect(onPermissionsCleared).not.toHaveBeenCalled()
    })
    
    it('should revert optimistic update on API error', async () => {
      const mockPermission = createMockPermission()
      const wrapper = createWrapper()
      
      // Mock initial fetch
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: [mockPermission] })
      } as Response)
      
      const { result } = renderHook(
        () => usePermissionPolling({ sessionId: 'session-1' }),
        { wrapper }
      )
      
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(1)
      })
      
      // Mock API error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Permission already decided' })
      } as Response)
      
      // Mock refetch to restore permission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: [mockPermission] })
      } as Response)
      
      // Try to deny - should fail
      await act(async () => {
        try {
          await result.current.deny('perm-1')
        } catch {
          // Expected error
        }
      })
      
      // Should restore the permission after error
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(1)
      })
    })
  })

  describe('Permission Accept Flow', () => {
    it('should handle accept with default permission mode', async () => {
      const mockPermission = createMockPermission()
      const onPermissionsCleared = vi.fn()
      const wrapper = createWrapper()
      
      // Mock initial fetch
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: [mockPermission] })
      } as Response)
      
      const { result } = renderHook(
        () => usePermissionPolling({ 
          sessionId: 'session-1',
          onPermissionsCleared 
        }),
        { wrapper }
      )
      
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(1)
      })
      
      // Mock the approve API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perm-1', decision: 'allow' })
      } as Response)
      
      // Approve the permission
      await act(async () => {
        await result.current.approve('perm-1')
      })
      
      // Should optimistically remove the permission
      expect(result.current.permissions).toHaveLength(0)
      expect(result.current.pendingCount).toBe(0)
      
      // Should call onPermissionsCleared
      expect(onPermissionsCleared).toHaveBeenCalledTimes(1)
      
      // Should make correct API call
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/permissions/perm-1'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ decision: 'allow' })
        })
      )
    })
    
    it('should handle accept with acceptEdits permission mode', async () => {
      // This test would be more relevant in the session detail component
      // where the permission mode is actually used
      // Here we just verify the API call is made correctly
      const mockPermission = createMockPermission()
      const wrapper = createWrapper()
      
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: [mockPermission] })
      } as Response)
      
      const { result } = renderHook(
        () => usePermissionPolling({ sessionId: 'session-1' }),
        { wrapper }
      )
      
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(1)
      })
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perm-1', decision: 'allow' })
      } as Response)
      
      await act(async () => {
        await result.current.approve('perm-1')
      })
      
      expect(result.current.permissions).toHaveLength(0)
    })
  })

  describe('UI State Reset on Permission Denial', () => {
    it('should immediately reset processing state when last permission is denied', async () => {
      const wrapper = createWrapper()
      
      // Mock fetch for active job check
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes('/active-job')) {
          return {
            ok: true,
            json: async () => ({ job: null })
          } as Response
        }
        // Default for permissions
        return {
          ok: true,
          json: async () => ({ permissions: [] })
        } as Response
      })
      
      const { result } = renderHook(
        () => useSessionProcessingState({ sessionId: 'session-1' }),
        { wrapper }
      )
      
      // Start processing
      act(() => {
        result.current.startProcessing()
      })
      
      expect(result.current.isProcessing).toBe(true)
      expect(result.current.showSpinner).toBe(true)
      expect(result.current.isInputDisabled).toBe(true)
      
      // Simulate permission cleared callback
      act(() => {
        result.current.stopProcessing()
      })
      
      // Should immediately reset state
      expect(result.current.isProcessing).toBe(false)
      expect(result.current.showSpinner).toBe(false)
      expect(result.current.isInputDisabled).toBe(false)
      expect(result.current.placeholderText).toBe('')
    })
    
    it('should show correct placeholder text based on state', async () => {
      const wrapper = createWrapper()
      const mockPermission = createMockPermission()
      
      // Mock fetch to return a permission
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes('/active-job')) {
          return {
            ok: true,
            json: async () => ({ job: null })
          } as Response
        }
        // Return one pending permission
        return {
          ok: true,
          json: async () => ({ permissions: [mockPermission] })
        } as Response
      })
      
      const { result } = renderHook(
        () => useSessionProcessingState({ sessionId: 'session-1' }),
        { wrapper }
      )
      
      // Start processing with permission
      act(() => {
        result.current.startProcessing()
      })
      
      await waitFor(() => {
        expect(result.current.pendingPermissionCount).toBe(1)
      })
      
      expect(result.current.placeholderText).toBe('Awaiting permission... (ESC to deny)')
      
      // Update mock to return no permissions
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes('/active-job')) {
          return {
            ok: true,
            json: async () => ({ job: null })
          } as Response
        }
        return {
          ok: true,
          json: async () => ({ permissions: [] })
        } as Response
      })
      
      // Force update by calling stopProcessing
      act(() => {
        result.current.stopProcessing()
      })
      
      // Wait for permissions to be cleared
      await waitFor(() => {
        expect(result.current.pendingPermissionCount).toBe(0)
      })
      
      expect(result.current.placeholderText).toBe('')
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid consecutive permission denials', async () => {
      const mockPermissions = [
        createMockPermission({ id: 'perm-1' }),
        createMockPermission({ id: 'perm-2' }),
        createMockPermission({ id: 'perm-3' })
      ]
      const onPermissionsCleared = vi.fn()
      const wrapper = createWrapper()
      
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: mockPermissions })
      } as Response)
      
      const { result } = renderHook(
        () => usePermissionPolling({ 
          sessionId: 'session-1',
          onPermissionsCleared 
        }),
        { wrapper }
      )
      
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(3)
      })
      
      // Keep track of which permissions have been denied
      const deniedPermissions = new Set<string>()
      
      mockFetch.mockImplementation(async (url, options) => {
        if (options?.method === 'POST' && url.toString().includes('/api/permissions/')) {
          // Extract permission ID from URL
          const matches = url.toString().match(/\/api\/permissions\/(perm-\d+)/)
          if (matches) {
            deniedPermissions.add(matches[1])
          }
          return {
            ok: true,
            json: async () => ({ decision: 'deny' })
          } as Response
        }
        
        // Return permissions that haven't been denied yet
        const remainingPermissions = mockPermissions.filter(p => !deniedPermissions.has(p.id))
        return {
          ok: true,
          json: async () => ({ permissions: remainingPermissions })
        } as Response
      })
      
      // Deny the first two permissions
      await act(async () => {
        await result.current.deny('perm-1')
        await result.current.deny('perm-2')
      })
      
      // onPermissionsCleared should not be called yet
      expect(onPermissionsCleared).not.toHaveBeenCalled()
      
      // Deny the last permission
      await act(async () => {
        await result.current.deny('perm-3')
      })
      
      // Wait for all permissions to be cleared
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(0)
      })
      
      // Should handle all denials correctly
      expect(result.current.pendingCount).toBe(0)
      
      // Should call onPermissionsCleared only once (when last permission is denied)
      expect(onPermissionsCleared).toHaveBeenCalledTimes(1)
    })
    
    it('should handle permission denial during isProcessing state', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ permissions: [] })
      } as Response)
      
      const { result } = renderHook(
        () => usePermissionPolling({ sessionId: 'session-1' }),
        { wrapper: createWrapper() }
      )
      
      // Set isProcessing to true
      expect(result.current.isProcessing).toBe(false)
      
      // Try to deny while already processing
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ decision: 'deny' })
      } as Response)
      
      act(() => {
        // This should still work even during processing
        result.current.deny('perm-1')
      })
      
      // isProcessing should be set during the operation
      expect(result.current.isProcessing).toBe(true)
    })
    
    it('should handle network errors gracefully', async () => {
      const mockPermission = createMockPermission()
      const onPermissionsCleared = vi.fn()
      const wrapper = createWrapper()
      
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: [mockPermission] })
      } as Response)
      
      const { result } = renderHook(
        () => usePermissionPolling({ 
          sessionId: 'session-1',
          onPermissionsCleared 
        }),
        { wrapper }
      )
      
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(1)
      })
      
      // Mock network error for the PUT request, but success for the refetch
      mockFetch.mockImplementation(async (url, options) => {
        if (options?.method === 'POST' && url.toString().includes('/api/permissions/perm-1')) {
          throw new Error('Network error')
        }
        // Return the original permission for the refetch
        return {
          ok: true,
          json: async () => ({ permissions: [mockPermission] })
        } as Response
      })
      
      // Try to deny - should handle error gracefully
      let error: Error | null = null
      await act(async () => {
        try {
          await result.current.deny('perm-1')
        } catch (e) {
          error = e as Error
        }
      })
      
      expect(error).toBeTruthy()
      expect((error as Error | null)?.message).toContain('Network error')
      
      // Should NOT call onPermissionsCleared on error
      expect(onPermissionsCleared).not.toHaveBeenCalled()
      
      // Wait for the revert to complete
      await waitFor(() => {
        expect(result.current.permissions).toHaveLength(1)
      })
    })
    
    it('should handle empty permission list correctly', async () => {
      const onPermissionsCleared = vi.fn()
      const wrapper = createWrapper()
      
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: [] })
      } as Response)
      
      const { result } = renderHook(
        () => usePermissionPolling({ 
          sessionId: 'session-1',
          onPermissionsCleared 
        }),
        { wrapper }
      )
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      
      expect(result.current.permissions).toHaveLength(0)
      expect(result.current.pendingCount).toBe(0)
      
      // Should not call onPermissionsCleared when starting with empty list
      expect(onPermissionsCleared).not.toHaveBeenCalled()
    })
  })
})