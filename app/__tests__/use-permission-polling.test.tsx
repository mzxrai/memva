import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Import MSW server for HTTP mocking
import { server } from '../test-utils/msw-server'
import { http, HttpResponse } from 'msw'

describe('usePermissionPolling', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    vi.useFakeTimers()
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
    
    // Override MSW handler to return permissions from test database
    server.use(
      http.get('/api/permissions', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        
        // Get permissions from test database
        const { eq } = require('drizzle-orm')
        
        const permissions = status === 'pending' 
          ? testDb.db.select().from(testDb.schema.permissionRequests)
              .where(eq(testDb.schema.permissionRequests.status, 'pending'))
              .all()
          : testDb.db.select().from(testDb.schema.permissionRequests).all()
        return HttpResponse.json({ permissions })
      }),
      
      http.put('/api/permissions/:id', async ({ params, request }) => {
        const body = await request.json() as { decision: string }
        const { eq } = require('drizzle-orm')
        
        // Update permission in test database
        testDb.db.update(testDb.schema.permissionRequests)
          .set({ 
            status: body.decision === 'allow' ? 'approved' : 'denied',
            decision: body.decision,
            decided_at: new Date().toISOString()
          })
          .where(eq(testDb.schema.permissionRequests.id, params.id))
          .run()
          
        return HttpResponse.json({
          id: params.id,
          status: body.decision === 'allow' ? 'approved' : 'denied',
          decision: body.decision,
          decided_at: new Date().toISOString()
        })
      }),
      
      // Also handle POST for permissions (same as PUT)
      http.post('/api/permissions/:id', async ({ params, request }) => {
        const body = await request.json() as { decision: string }
        const { eq } = require('drizzle-orm')
        
        // Update permission in test database
        testDb.db.update(testDb.schema.permissionRequests)
          .set({ 
            status: body.decision === 'allow' ? 'approved' : 'denied',
            decision: body.decision,
            decided_at: new Date().toISOString()
          })
          .where(eq(testDb.schema.permissionRequests.id, params.id))
          .run()
          
        return HttpResponse.json({
          id: params.id,
          status: body.decision === 'allow' ? 'approved' : 'denied',
          decision: body.decision,
          decided_at: new Date().toISOString()
        })
      })
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    testDb.cleanup()
    clearTestDatabase()
  })

  it.skip('should fetch pending permissions on mount - OUTDATED TEST', async () => {
    const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
    const { createPermissionRequest } = await import('../db/permissions.service')
    
    // Create test session
    const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
    
    // Create permission requests directly in database
    
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
    
    const session1 = testDb.createSession({ title: 'Test Session 1', project_path: '/test1' })
    const session2 = testDb.createSession({ title: 'Test Session 2', project_path: '/test2' })
    const session3 = testDb.createSession({ title: 'Test Session 3', project_path: '/test3' })
    
    // Create multiple permission requests for different sessions
    await createPermissionRequest({
      session_id: session1.id,
      tool_name: 'Bash',
      tool_use_id: null,
      input: { command: 'ls' }
    })
    
    await createPermissionRequest({
      session_id: session2.id,
      tool_name: 'Write',
      tool_use_id: null,
      input: { file_path: '/test.txt', content: 'test' }
    })
    
    await createPermissionRequest({
      session_id: session3.id,
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