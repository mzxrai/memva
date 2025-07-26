import { vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import type { ReactNode } from 'react'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import usePermissionPolling from '../hooks/usePermissionPolling'

describe('Permission Polling Optimization', () => {
  let testDb: TestDatabase
  let queryClient: QueryClient

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    })
    
    // Mock fetch API
    global.fetch = vi.fn()
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
    vi.restoreAllMocks()
  })

  it('should poll for permissions when enabled is true', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ permissions: [] })
    })

    const { result } = renderHook(() => 
      usePermissionPolling({ 
        enabled: true, 
        sessionId: 'test-session-123',
        pollingInterval: 100 
      }),
      { wrapper }
    )

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Wait for at least one polling interval
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    }, { timeout: 200 })

    expect(result.current.permissions).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('should NOT poll for permissions when enabled is false', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ permissions: [] })
    })

    const { result } = renderHook(() => 
      usePermissionPolling({ 
        enabled: false, 
        sessionId: 'test-session-123',
        pollingInterval: 100 
      }),
      { wrapper }
    )

    // Wait a bit to ensure no polling happens
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.permissions).toEqual([])
    expect(result.current.isLoading).toBe(true) // Still loading because never fetched
  })

  it('should stop polling when enabled changes from true to false', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ permissions: [] })
    })

    const { rerender } = renderHook(
      ({ enabled }) => usePermissionPolling({ 
        enabled, 
        sessionId: 'test-session-123',
        pollingInterval: 100 
      }),
      { initialProps: { enabled: true }, wrapper }
    )

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Disable polling
    rerender({ enabled: false })
    
    // Clear previous calls
    const callCountBeforeDisable = mockFetch.mock.calls.length
    
    // Wait to ensure no more polling happens
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Should not have made any more calls
    expect(mockFetch).toHaveBeenCalledTimes(callCountBeforeDisable)
  })

  it('should resume polling when enabled changes from false to true', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ permissions: [] })
    })

    const { rerender } = renderHook(
      ({ enabled }) => usePermissionPolling({ 
        enabled, 
        sessionId: 'test-session-123',
        pollingInterval: 100 
      }),
      { initialProps: { enabled: false }, wrapper }
    )

    // Verify no calls when disabled
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(mockFetch).not.toHaveBeenCalled()

    // Enable polling
    rerender({ enabled: true })

    // Should start polling
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Should continue polling
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    }, { timeout: 200 })
  })
})