import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { 
  createPermissionRequest, 
  getPermissionRequests, 
  getPendingPermissionRequests,
  updatePermissionDecision,
  expireOldRequests 
} from './permissions.service'

describe('Permissions Service', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('createPermissionRequest', () => {
    it('should create a new permission request with pending status', async () => {
      const session = testDb.createSession({ title: 'Test Session', project_path: '/test' })
      const requestData = {
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: 'tool-use-456',
        input: { file_path: '/test.txt' }
      }

      const request = await createPermissionRequest(requestData)

      expect(request).toMatchObject({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: 'tool-use-456',
        input: { file_path: '/test.txt' },
        status: 'pending',
        decision: null,
        decided_at: null
      })
      expect(request.id).toBeDefined()
      expect(request.created_at).toBeDefined()
      expect(request.expires_at).toBeDefined()

      // Verify expires_at is 24 hours from created_at
      const createdAt = new Date(request.created_at)
      const expiresAt = new Date(request.expires_at)
      const diffInHours = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      expect(diffInHours).toBeCloseTo(24, 0)
    })
  })

  describe('getPermissionRequests', () => {
    it('should return all permission requests', async () => {
      const session1 = testDb.createSession({ title: 'Session 1', project_path: '/test1' })
      const session2 = testDb.createSession({ title: 'Session 2', project_path: '/test2' })

      await createPermissionRequest({
        session_id: session1.id,
        tool_name: 'Read',
        tool_use_id: 'tool-1',
        input: { file_path: '/file1.txt' }
      })

      await createPermissionRequest({
        session_id: session2.id,
        tool_name: 'Write',
        tool_use_id: 'tool-2',
        input: { file_path: '/file2.txt' }
      })

      const requests = await getPermissionRequests()
      expect(requests).toHaveLength(2)
      expect(requests[0].tool_name).toBe('Read')
      expect(requests[1].tool_name).toBe('Write')
    })

    it('should filter permission requests by session_id', async () => {
      const session1 = testDb.createSession({ title: 'Session 1', project_path: '/test1' })
      const session2 = testDb.createSession({ title: 'Session 2', project_path: '/test2' })

      await createPermissionRequest({
        session_id: session1.id,
        tool_name: 'Read',
        tool_use_id: 'tool-1',
        input: { file_path: '/file1.txt' }
      })

      await createPermissionRequest({
        session_id: session2.id,
        tool_name: 'Write',
        tool_use_id: 'tool-2',
        input: { file_path: '/file2.txt' }
      })

      const requests = await getPermissionRequests({ session_id: session1.id })
      expect(requests).toHaveLength(1)
      expect(requests[0].session_id).toBe(session1.id)
      expect(requests[0].tool_name).toBe('Read')
    })

    it('should filter permission requests by status', async () => {
      const session = testDb.createSession({ title: 'Session', project_path: '/test' })

      const pending = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: 'tool-1',
        input: { file_path: '/file1.txt' }
      })

      const approved = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: 'tool-2',
        input: { file_path: '/file2.txt' }
      })

      await updatePermissionDecision(approved.id, { decision: 'allow' })

      const pendingRequests = await getPermissionRequests({ status: 'pending' })
      expect(pendingRequests).toHaveLength(1)
      expect(pendingRequests[0].id).toBe(pending.id)

      const approvedRequests = await getPermissionRequests({ status: 'approved' })
      expect(approvedRequests).toHaveLength(1)
      expect(approvedRequests[0].id).toBe(approved.id)
    })
  })

  describe('getPendingPermissionRequests', () => {
    it('should return only pending requests that have not expired', async () => {
      const session = testDb.createSession({ title: 'Session', project_path: '/test' })

      // Create a pending request
      const pending = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: 'tool-1',
        input: { file_path: '/file1.txt' }
      })

      // Create an approved request
      const approved = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: 'tool-2',
        input: { file_path: '/file2.txt' }
      })
      await updatePermissionDecision(approved.id, { decision: 'allow' })

      const pendingRequests = await getPendingPermissionRequests()
      expect(pendingRequests).toHaveLength(1)
      expect(pendingRequests[0].id).toBe(pending.id)
      expect(pendingRequests[0].status).toBe('pending')
    })
  })

  describe('updatePermissionDecision', () => {
    it('should update permission request with allow decision', async () => {
      const session = testDb.createSession({ title: 'Session', project_path: '/test' })
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: 'tool-1',
        input: { file_path: '/file.txt' }
      })

      const updated = await updatePermissionDecision(request.id, { decision: 'allow' })

      expect(updated).toMatchObject({
        id: request.id,
        status: 'approved',
        decision: 'allow',
      })
      expect(updated.decided_at).toBeDefined()
    })

    it('should update permission request with deny decision', async () => {
      const session = testDb.createSession({ title: 'Session', project_path: '/test' })
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: 'tool-1',
        input: { file_path: '/file.txt' }
      })

      const updated = await updatePermissionDecision(request.id, { decision: 'deny' })

      expect(updated).toMatchObject({
        id: request.id,
        status: 'denied',
        decision: 'deny',
      })
      expect(updated.decided_at).toBeDefined()
    })

    it('should throw error if permission request not found', async () => {
      await expect(
        updatePermissionDecision('non-existent-id', { decision: 'allow' })
      ).rejects.toThrow('Permission request not found')
    })

    it('should throw error if permission request already decided', async () => {
      const session = testDb.createSession({ title: 'Session', project_path: '/test' })
      const request = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: 'tool-1',
        input: { file_path: '/file.txt' }
      })

      await updatePermissionDecision(request.id, { decision: 'allow' })

      await expect(
        updatePermissionDecision(request.id, { decision: 'deny' })
      ).rejects.toThrow('Permission request already decided')
    })
  })

  describe('expireOldRequests', () => {
    it('should mark requests older than 24 hours as timeout', async () => {
      const session = testDb.createSession({ title: 'Session', project_path: '/test' })

      // Create a request with expires_at in the past
      const expiredRequest = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: 'tool-1',
        input: { file_path: '/file.txt' }
      })

      // Manually update expires_at to be in the past
      testDb.sqlite.prepare(
        'UPDATE permission_requests SET expires_at = ? WHERE id = ?'
      ).run(new Date(Date.now() - 1000).toISOString(), expiredRequest.id)

      // Create a non-expired request
      const validRequest = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Write',
        tool_use_id: 'tool-2',
        input: { file_path: '/file2.txt' }
      })

      const expiredCount = await expireOldRequests()
      expect(expiredCount).toBe(1)

      const requests = await getPermissionRequests()
      const expired = requests.find(r => r.id === expiredRequest.id)
      const valid = requests.find(r => r.id === validRequest.id)

      expect(expired?.status).toBe('timeout')
      expect(valid?.status).toBe('pending')
    })

    it('should not expire already decided requests', async () => {
      const session = testDb.createSession({ title: 'Session', project_path: '/test' })

      const approvedRequest = await createPermissionRequest({
        session_id: session.id,
        tool_name: 'Read',
        tool_use_id: 'tool-1',
        input: { file_path: '/file.txt' }
      })

      await updatePermissionDecision(approvedRequest.id, { decision: 'allow' })

      // Manually update expires_at to be in the past
      testDb.sqlite.prepare(
        'UPDATE permission_requests SET expires_at = ? WHERE id = ?'
      ).run(new Date(Date.now() - 1000).toISOString(), approvedRequest.id)

      const expiredCount = await expireOldRequests()
      expect(expiredCount).toBe(0)

      const requests = await getPermissionRequests()
      const approved = requests.find(r => r.id === approvedRequest.id)
      expect(approved?.status).toBe('approved')
    })
  })
})