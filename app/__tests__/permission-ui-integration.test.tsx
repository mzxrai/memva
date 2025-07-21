import { vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { expectSemanticMarkup, expectContent } from '../test-utils/component-testing'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Permission UI Integration', () => {
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

  describe('usePermissionPolling Hook Integration', () => {
    it('should integrate with UI components to show permissions', async () => {
      const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
      const { createPermissionRequest } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create permission request
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'npm install' }
      })
      
      const { result } = renderHook(() => usePermissionPolling())
      
      // Wait for initial fetch
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
      
      expect(result.current.permissions).toHaveLength(1)
      expect(result.current.pendingCount).toBe(1)
      expect(result.current.isLoading).toBe(false)
    })

    it('should update UI when permissions are approved', async () => {
      const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
      const { createPermissionRequest } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: null,
        input: { file_path: '/test.txt', content: 'Hello' }
      })
      
      const { result } = renderHook(() => usePermissionPolling())
      
      // Wait for initial fetch
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
      
      expect(result.current.permissions).toHaveLength(1)
      
      // Approve the permission
      await act(async () => {
        await result.current.approve(request.id)
        await vi.runOnlyPendingTimersAsync()
      })
      
      // Permission should be removed from pending list
      expect(result.current.permissions).toHaveLength(0)
      expect(result.current.pendingCount).toBe(0)
    })
  })

  describe('Permission Component Integration', () => {
    it('should render permission notification with all details', async () => {
      const PermissionRequestNotification = (await import('../components/permissions/PermissionRequestNotification')).default
      const { createPermissionRequest } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'git status' }
      })
      
      const mockOnApprove = vi.fn()
      const mockOnDeny = vi.fn()
      
      render(
        <PermissionRequestNotification
          request={request}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
        />
      )
      
      // Check content
      expectContent.text('Bash')
      expectContent.text('git status')
      expectSemanticMarkup.button('Approve')
      expectSemanticMarkup.button('Deny')
    })

    it('should render permission queue with multiple requests', async () => {
      const PermissionQueue = (await import('../components/permissions/PermissionQueue')).default
      const { createPermissionRequest } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create multiple permissions
      const permissions = await Promise.all([
        createPermissionRequest({
          session_id: session.id,
          tool_name: 'Bash',
          tool_use_id: null,
          input: { command: 'ls' }
        }),
        createPermissionRequest({
          session_id: session.id,
          tool_name: 'Read',
          tool_use_id: null,
          input: { file_path: '/README.md' }
        }),
        createPermissionRequest({
          session_id: session.id,
          tool_name: 'Write',
          tool_use_id: null,
          input: { file_path: '/output.txt', content: 'test' }
        })
      ])
      
      const mockOnApprove = vi.fn()
      const mockOnDeny = vi.fn()
      
      render(
        <PermissionQueue
          requests={permissions}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
        />
      )
      
      // All requests should be visible
      expectContent.text('Bash')
      expectContent.text('Read')
      expectContent.text('Write')
      
      // Each should have approve/deny buttons
      const approveButtons = screen.getAllByText('Approve')
      const denyButtons = screen.getAllByText('Deny')
      
      expect(approveButtons).toHaveLength(3)
      expect(denyButtons).toHaveLength(3)
    })

    it('should show permission badge with count', async () => {
      const PermissionBadge = (await import('../components/permissions/PermissionBadge')).default
      
      // Test various counts
      const { rerender } = render(<PermissionBadge count={5} />)
      expectContent.text('5')
      
      rerender(<PermissionBadge count={10} />)
      expectContent.text('9+')
      
      rerender(<PermissionBadge count={0} />)
      expect(screen.queryByText('0')).toBeNull()
    })
  })

  describe('Real-time Updates', () => {
    it('should update UI when new permissions arrive', async () => {
      const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
      const { createPermissionRequest } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const { result } = renderHook(() => usePermissionPolling({ pollingInterval: 500 }))
      
      // Wait for initial fetch
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
      
      expect(result.current.permissions).toHaveLength(0)
      
      // Add permission while hook is running
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'pwd' }
      })
      
      // Wait for next poll
      await act(async () => {
        vi.advanceTimersByTime(500)
        await vi.runOnlyPendingTimersAsync()
      })
      
      expect(result.current.permissions).toHaveLength(1)
      expect(result.current.permissions[0].tool_name).toBe('Bash')
    })

    it('should handle rapid permission changes', async () => {
      const { default: usePermissionPolling } = await import('../hooks/usePermissionPolling')
      const { createPermissionRequest } = await import('../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      const { result } = renderHook(() => usePermissionPolling({ pollingInterval: 100 }))
      
      // Create multiple permissions rapidly
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: 'tool-1',
        input: { command: 'echo 1' }
      })
      
      await act(async () => {
        vi.advanceTimersByTime(100)
        await vi.runOnlyPendingTimersAsync()
      })
      
      expect(result.current.permissions).toHaveLength(1)
      
      // Add more
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: 'tool-2',
        input: { file_path: '/test.txt', content: 'data' }
      })
      
      await act(async () => {
        vi.advanceTimersByTime(100)
        await vi.runOnlyPendingTimersAsync()
      })
      
      expect(result.current.permissions).toHaveLength(2)
      
      // Approve one
      await act(async () => {
        await result.current.approve(result.current.permissions[0].id)
        await vi.runOnlyPendingTimersAsync()
      })
      
      expect(result.current.permissions).toHaveLength(1)
      expect(result.current.permissions[0].tool_name).toBe('Write')
    })
  })
})