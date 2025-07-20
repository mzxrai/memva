import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('usePermissionPolling', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    vi.useFakeTimers()
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    vi.useRealTimers()
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should fetch pending permissions on mount', async () => {
    const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
    const { createPermissionRequest } = await import('../db/permissions.service')
    
    // Create test session
    const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
    
    // Create permission requests directly in database
    const now = new Date()
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    
    await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Bash',
      tool_use_id: null,
      input: { command: 'ls' }
    })
    
    await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Write',
      tool_use_id: null,
      input: { file_path: '/test.txt', content: 'test' }
    })

    const { result } = renderHook(() => usePermissionPolling())

    // Wait for initial fetch to complete
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.permissions).toHaveLength(2)
    expect(result.current.pendingCount).toBe(2)
  })

  it('should poll for new permissions at specified interval', async () => {
    const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
    const { createPermissionRequest } = await import('../db/permissions.service')
    
    const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })

    const { result } = renderHook(() => usePermissionPolling({ pollingInterval: 1000 }))

    // Wait for initial load
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.permissions).toHaveLength(0)

    // Add a permission request
    await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Bash',
      tool_use_id: null,
      input: { command: 'ls' }
    })

    // Advance timer to trigger poll
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.permissions).toHaveLength(1)
  })

  it('should handle approve action', async () => {
    const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
    const { createPermissionRequest } = await import('../db/permissions.service')
    const { db } = await import('../db/index')
    const { permissionRequests } = await import('../db/schema')
    const { eq } = await import('drizzle-orm')
    
    const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
    
    const request = await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Bash',
      tool_use_id: null,
      input: { command: 'ls' }
    })

    const { result } = renderHook(() => usePermissionPolling())

    // Wait for initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.permissions).toHaveLength(1)

    // Approve the request
    await act(async () => {
      await result.current.approve(request.id)
      await vi.runOnlyPendingTimersAsync()
    })

    // Should refetch and show no pending permissions
    expect(result.current.permissions).toHaveLength(0)
    
    // Verify the request was approved in database
    const updatedRequest = db
      .select()
      .from(permissionRequests)
      .where(eq(permissionRequests.id, request.id))
      .get()
    
    expect(updatedRequest?.status).toBe('approved')
    expect(updatedRequest?.decision).toBe('allow')
  })

  it('should handle deny action', async () => {
    const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
    const { createPermissionRequest } = await import('../db/permissions.service')
    const { db } = await import('../db/index')
    const { permissionRequests } = await import('../db/schema')
    const { eq } = await import('drizzle-orm')
    
    const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
    
    const request = await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Write',
      tool_use_id: null,
      input: { file_path: '/test.txt', content: 'test' }
    })

    const { result } = renderHook(() => usePermissionPolling())

    // Wait for initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.permissions).toHaveLength(1)

    // Deny the request
    await act(async () => {
      await result.current.deny(request.id)
      await vi.runOnlyPendingTimersAsync()
    })

    // Should refetch and show no pending permissions
    expect(result.current.permissions).toHaveLength(0)
    
    // Verify the request was denied in database
    const updatedRequest = db
      .select()
      .from(permissionRequests)
      .where(eq(permissionRequests.id, request.id))
      .get()
    
    expect(updatedRequest?.status).toBe('denied')
    expect(updatedRequest?.decision).toBe('deny')
  })

  it('should calculate pending count correctly', async () => {
    const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
    const { createPermissionRequest } = await import('../db/permissions.service')
    
    const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
    
    // Create multiple permission requests
    await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Bash',
      tool_use_id: null,
      input: { command: 'ls' }
    })
    
    await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Write',
      tool_use_id: null,
      input: { file_path: '/test.txt', content: 'test' }
    })
    
    await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Read',
      tool_use_id: null,
      input: { file_path: '/test.txt' }
    })

    const { result } = renderHook(() => usePermissionPolling())

    // Wait for initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.permissions).toHaveLength(3)
    expect(result.current.pendingCount).toBe(3)
  })

  it('should stop polling when disabled', async () => {
    const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
    const { createPermissionRequest } = await import('../db/permissions.service')
    
    const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })

    const { result, rerender } = renderHook(
      ({ enabled }) => usePermissionPolling({ enabled, pollingInterval: 1000 }), 
      { 
        initialProps: { enabled: true }
      }
    )

    // Wait for initial load
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.permissions).toHaveLength(0)

    // Disable polling
    rerender({ enabled: false })

    // Add a permission request
    await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Bash',
      tool_use_id: null,
      input: { command: 'ls' }
    })

    // Advance timer - should not fetch new data
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await vi.runOnlyPendingTimersAsync()
    })

    // Should still have no permissions because polling is disabled
    expect(result.current.permissions).toHaveLength(0)
  })

  it('should show loading state during initial fetch', async () => {
    const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')

    const { result } = renderHook(() => usePermissionPolling())

    // Should start in loading state
    expect(result.current.isLoading).toBe(true)
    expect(result.current.permissions).toEqual([])

    // Wait for initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('should default to 500ms polling interval', async () => {
    const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
    const { createPermissionRequest } = await import('../db/permissions.service')
    
    const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })

    const { result } = renderHook(() => usePermissionPolling())

    // Wait for initial load
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.permissions).toHaveLength(0)

    // Add a permission request
    await createPermissionRequest({
      session_id: session.id,
      tool_name: 'Bash',
      tool_use_id: null,
      input: { command: 'ls' }
    })

    // Advance by 500ms (default interval)
    await act(async () => {
      vi.advanceTimersByTime(500)
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.permissions).toHaveLength(1)
  })
})