import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Maintenance Handler - Permission Cleanup', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('cleanup-expired-permissions operation', () => {
    it('should expire permission requests older than 24 hours', async () => {
      const { maintenanceHandler } = await import('./maintenance.handler')
      const { createPermissionRequest } = await import('../../db/permissions.service')
      const { db } = await import('../../db/index')
      const { permissionRequests } = await import('../../db/schema')
      const { eq } = await import('drizzle-orm')
      
      // Create test sessions
      const session1 = testDb.createSession({ title: 'Test Session 1', project_path: '/test1' })
      const session2 = testDb.createSession({ title: 'Test Session 2', project_path: '/test2' })
      
      // Create permission requests with different ages
      const now = new Date()
      const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000) // 25 hours ago
      
      // Create old permission request
      const oldRequest = await createPermissionRequest({
        session_id: session1.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      // Manually update the expires_at to be in the past
      db.update(permissionRequests)
        .set({ expires_at: oldDate.toISOString() })
        .where(eq(permissionRequests.id, oldRequest.id))
        .run()
      
      // Create recent permission request for different session
      await createPermissionRequest({
        session_id: session2.id,
        tool_name: 'Write',
        tool_use_id: null,
        input: { file_path: '/test.txt', content: 'test' }
      })
      
      const job = {
        id: 'test-job-1',
        type: 'maintenance',
        data: {
          operation: 'cleanup-expired-permissions'
        }
      }
      
      let result: any
      const callback = (error: Error | null, data?: any) => {
        if (error) throw error
        result = data
      }
      
      await maintenanceHandler(job, callback)
      
      expect(result.success).toBe(true)
      expect(result.operation).toBe('cleanup-expired-permissions')
      expect(result.expiredCount).toBe(1)
      
      // Verify the old request was marked as timeout
      const oldRequestUpdated = db
        .select()
        .from(permissionRequests)
        .where(eq(permissionRequests.id, oldRequest.id))
        .get()
      
      expect(oldRequestUpdated?.status).toBe('expired')
    })

    it('should handle case with no expired permissions', async () => {
      const { maintenanceHandler } = await import('./maintenance.handler')
      const { createPermissionRequest } = await import('../../db/permissions.service')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create only recent permission requests
      await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      const job = {
        id: 'test-job-2',
        type: 'maintenance',
        data: {
          operation: 'cleanup-expired-permissions'
        }
      }
      
      let result: any
      const callback = (error: Error | null, data?: any) => {
        if (error) throw error
        result = data
      }
      
      await maintenanceHandler(job, callback)
      
      expect(result.success).toBe(true)
      expect(result.expiredCount).toBe(0)
    })

    it('should not affect already decided permissions', async () => {
      const { maintenanceHandler } = await import('./maintenance.handler')
      const { createPermissionRequest, updatePermissionDecision } = await import('../../db/permissions.service')
      const { db } = await import('../../db/index')
      const { permissionRequests } = await import('../../db/schema')
      const { eq } = await import('drizzle-orm')
      
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      
      // Create and approve a permission
      const approvedRequest = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Bash',
        tool_use_id: null,
        input: { command: 'ls' }
      })
      
      await updatePermissionDecision(approvedRequest.id, { decision: 'allow' })
      
      // Manually update the expires_at to be in the past
      const oldDate = new Date(new Date().getTime() - 25 * 60 * 60 * 1000)
      db.update(permissionRequests)
        .set({ expires_at: oldDate.toISOString() })
        .where(eq(permissionRequests.id, approvedRequest.id))
        .run()
      
      const job = {
        id: 'test-job-3',
        type: 'maintenance',
        data: {
          operation: 'cleanup-expired-permissions'
        }
      }
      
      let result: any
      const callback = (error: Error | null, data?: any) => {
        if (error) throw error
        result = data
      }
      
      await maintenanceHandler(job, callback)
      
      expect(result.expiredCount).toBe(0)
      
      // Verify the approved request was not changed
      const approvedRequestUpdated = db
        .select()
        .from(permissionRequests)
        .where(eq(permissionRequests.id, approvedRequest.id))
        .get()
      
      expect(approvedRequestUpdated?.status).toBe('approved')
    })
  })

  describe('operation validation', () => {
    it('should include cleanup-expired-permissions in valid operations', async () => {
      const { maintenanceHandler } = await import('./maintenance.handler')
      
      const job = {
        id: 'test-job-4',
        type: 'maintenance',
        data: {
          operation: 'cleanup-expired-permissions'
        }
      }
      
      let error: Error | null = null
      const callback = (err: Error | null) => {
        error = err
      }
      
      await maintenanceHandler(job, callback)
      
      // Should not error out as unknown operation
      expect(error).toBeNull()
    })
  })
})