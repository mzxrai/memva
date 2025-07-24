import { vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import type { ReactNode } from 'react'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { useSessionProcessingState } from '../hooks/useSessionProcessingState'

describe('Session Processing Permission Optimization', () => {
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
        queries: { retry: false },
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

  it('should NOT poll for permissions when no active session run', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    
    // Mock active job endpoint - no active job
    mockFetch.mockImplementation((url) => {
      if (url.includes('/active-job')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ job: null })
        })
      }
      if (url.includes('/api/permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ permissions: [] })
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    const { result } = renderHook(() => 
      useSessionProcessingState({ 
        sessionId: 'test-session-123',
        pollingInterval: 100 
      }),
      { wrapper }
    )

    // Wait for initial active job check
    await waitFor(() => {
      const activeJobCalls = mockFetch.mock.calls.filter(call => 
        call[0].includes('/active-job')
      )
      expect(activeJobCalls.length).toBeGreaterThan(0)
    })

    // Wait a bit to ensure no permission polling happens
    await new Promise(resolve => setTimeout(resolve, 200))

    // Should NOT have called permissions endpoint
    const permissionCalls = mockFetch.mock.calls.filter(call => 
      call[0].includes('/api/permissions')
    )
    expect(permissionCalls.length).toBe(0)
    
    expect(result.current.isProcessing).toBe(false)
    expect(result.current.activeJob).toBe(null)
    expect(result.current.permissions).toEqual([])
  })

  it('should poll for permissions when there is an active job', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    
    // Mock active job endpoint - has active job
    mockFetch.mockImplementation((url) => {
      if (url.includes('/active-job')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ 
            job: {
              id: 'job-123',
              type: 'session-runner',
              status: 'running',
              started_at: new Date().toISOString()
            }
          })
        })
      }
      if (url.includes('/api/permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ permissions: [] })
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    const { result } = renderHook(() => 
      useSessionProcessingState({ 
        sessionId: 'test-session-123',
        pollingInterval: 100 
      }),
      { wrapper }
    )

    // Wait for active job to be detected
    await waitFor(() => {
      expect(result.current.activeJob).not.toBe(null)
      expect(result.current.isProcessing).toBe(true)
    })

    // Should start polling for permissions
    await waitFor(() => {
      const permissionCalls = mockFetch.mock.calls.filter(call => 
        call[0].includes('/api/permissions')
      )
      expect(permissionCalls.length).toBeGreaterThan(0)
    })
  })

  it('should poll for permissions during optimistic processing', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    
    // Mock endpoints
    mockFetch.mockImplementation((url) => {
      if (url.includes('/active-job')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ job: null })
        })
      }
      if (url.includes('/api/permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ permissions: [] })
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    const { result } = renderHook(() => 
      useSessionProcessingState({ 
        sessionId: 'test-session-123',
        pollingInterval: 100 
      }),
      { wrapper }
    )

    // Start processing (simulates form submission)
    result.current.startProcessing()

    // Wait for state to update
    await waitFor(() => {
      expect(result.current.isProcessing).toBe(true)
    })

    // Should start polling for permissions during optimistic processing
    await waitFor(() => {
      const permissionCalls = mockFetch.mock.calls.filter(call => 
        call[0].includes('/api/permissions')
      )
      expect(permissionCalls.length).toBeGreaterThan(0)
    })
  })

  it('should poll for permissions during transition state', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    
    // Mock endpoints
    mockFetch.mockImplementation((url) => {
      if (url.includes('/active-job')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ job: null })
        })
      }
      if (url.includes('/api/permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ permissions: [] })
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    const { result } = renderHook(() => 
      useSessionProcessingState({ 
        sessionId: 'test-session-123',
        pollingInterval: 100 
      }),
      { wrapper }
    )

    // Start transition (simulates exit plan mode)
    result.current.startTransition()

    // Wait for state to update
    await waitFor(() => {
      expect(result.current.isTransitioning).toBe(true)
    })

    // Should poll for permissions during transition
    await waitFor(() => {
      const permissionCalls = mockFetch.mock.calls.filter(call => 
        call[0].includes('/api/permissions')
      )
      expect(permissionCalls.length).toBeGreaterThan(0)
    })
  })

  it('should stop polling permissions when processing completes', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    
    // Mock endpoints - start with active job
    let hasActiveJob = true
    mockFetch.mockImplementation((url) => {
      if (url.includes('/active-job')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ 
            job: hasActiveJob ? {
              id: 'job-123',
              type: 'session-runner',
              status: 'running',
              started_at: new Date().toISOString()
            } : null
          })
        })
      }
      if (url.includes('/api/permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ permissions: [] })
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    const { result } = renderHook(() => 
      useSessionProcessingState({ 
        sessionId: 'test-session-123',
        pollingInterval: 100 
      }),
      { wrapper }
    )

    // Wait for processing to start
    await waitFor(() => {
      expect(result.current.isProcessing).toBe(true)
    })

    // Verify permissions are being polled
    await waitFor(() => {
      const permissionCalls = mockFetch.mock.calls.filter(call => 
        call[0].includes('/api/permissions')
      )
      expect(permissionCalls.length).toBeGreaterThan(0)
    })

    // Clear call history
    mockFetch.mockClear()

    // Simulate job completion
    hasActiveJob = false

    // Wait for processing to stop (after grace period)
    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false)
      expect(result.current.activeJob).toBe(null)
    }, { timeout: 6000 }) // Grace period is 5 seconds

    // Clear call history again
    const callsAfterStop = mockFetch.mock.calls.length
    
    // Wait to ensure no more permission polling
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Should not have made any more permission calls
    const permissionCallsAfterStop = mockFetch.mock.calls.filter(call => 
      call[0].includes('/api/permissions')
    ).length - mockFetch.mock.calls.slice(0, callsAfterStop).filter(call => 
      call[0].includes('/api/permissions')
    ).length
    
    expect(permissionCallsAfterStop).toBe(0)
  })
})