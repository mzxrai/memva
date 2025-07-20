import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { PermissionPoller } from '../src/permission-poller'

describe('PermissionPoller', () => {
  let db: Database.Database
  let poller: PermissionPoller

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:')
    
    // Create permission_requests table
    db.exec(`
      CREATE TABLE permission_requests (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_use_id TEXT,
        input TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        decision TEXT,
        decided_at TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `)

    poller = new PermissionPoller(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('createPermissionRequest', () => {
    it('should create a permission request and return the ID', () => {
      const requestData = {
        session_id: 'test-session-123',
        tool_name: 'Read',
        tool_use_id: 'tool-use-456',
        input: { file_path: '/test.txt' }
      }

      const requestId = poller.createPermissionRequest(requestData)

      expect(requestId).toBeDefined()
      expect(typeof requestId).toBe('string')

      // Verify it was saved to database
      const saved = db.prepare('SELECT * FROM permission_requests WHERE id = ?').get(requestId) as any
      expect(saved).toBeDefined()
      expect(saved.session_id).toBe('test-session-123')
      expect(saved.tool_name).toBe('Read')
      expect(saved.status).toBe('pending')
      expect(JSON.parse(saved.input)).toEqual({ file_path: '/test.txt' })
    })
  })

  describe('pollForDecision', () => {
    it('should return decision when request is approved', async () => {
      // Create a permission request
      const requestId = poller.createPermissionRequest({
        session_id: 'test-session',
        tool_name: 'Write',
        tool_use_id: 'tool-123',
        input: { content: 'test' }
      })

      // Simulate approval after 50ms
      setTimeout(() => {
        db.prepare(
          'UPDATE permission_requests SET status = ?, decision = ?, decided_at = ? WHERE id = ?'
        ).run('approved', 'allow', new Date().toISOString(), requestId)
      }, 50)

      const decision = await poller.pollForDecision(requestId, 1000) // 1 second timeout

      expect(decision).toEqual({
        behavior: 'allow',
        updatedInput: { content: 'test' }
      })
    })

    it('should return denial when request is denied', async () => {
      const requestId = poller.createPermissionRequest({
        session_id: 'test-session',
        tool_name: 'Write',
        tool_use_id: 'tool-123',
        input: { content: 'test' }
      })

      // Simulate denial
      setTimeout(() => {
        db.prepare(
          'UPDATE permission_requests SET status = ?, decision = ?, decided_at = ? WHERE id = ?'
        ).run('denied', 'deny', new Date().toISOString(), requestId)
      }, 50)

      const decision = await poller.pollForDecision(requestId, 1000)

      expect(decision).toEqual({
        behavior: 'deny',
        message: 'Permission denied by user'
      })
    })

    it('should timeout after specified duration', async () => {
      const requestId = poller.createPermissionRequest({
        session_id: 'test-session',
        tool_name: 'Write',
        tool_use_id: 'tool-123',
        input: { content: 'test' }
      })

      // Don't update the request, let it timeout
      const decision = await poller.pollForDecision(requestId, 200) // 200ms timeout

      expect(decision).toEqual({
        behavior: 'deny',
        message: 'Permission request timed out after 200ms'
      })
    })

    it('should handle 24-hour expiration', async () => {
      const requestId = poller.createPermissionRequest({
        session_id: 'test-session',
        tool_name: 'Write',
        tool_use_id: 'tool-123',
        input: { content: 'test' }
      })

      // Update expires_at to be in the past
      db.prepare(
        'UPDATE permission_requests SET expires_at = ? WHERE id = ?'
      ).run(new Date(Date.now() - 1000).toISOString(), requestId)

      const decision = await poller.pollForDecision(requestId, 1000)

      expect(decision).toEqual({
        behavior: 'deny',
        message: 'Permission request expired'
      })
    })

    it('should use exponential backoff for polling', async () => {
      const requestId = poller.createPermissionRequest({
        session_id: 'test-session',
        tool_name: 'Read',
        tool_use_id: 'tool-123',
        input: { file: 'test.txt' }
      })

      const checkIntervals: number[] = []
      let lastCheck = Date.now()

      // Mock the checkDecision method to track intervals
      const originalCheck = poller.checkDecision.bind(poller)
      poller.checkDecision = vi.fn().mockImplementation((id: string) => {
        const now = Date.now()
        checkIntervals.push(now - lastCheck)
        lastCheck = now
        return originalCheck(id)
      })

      // Approve after 300ms to allow multiple polling intervals
      setTimeout(() => {
        db.prepare(
          'UPDATE permission_requests SET status = ?, decision = ?, decided_at = ? WHERE id = ?'
        ).run('approved', 'allow', new Date().toISOString(), requestId)
      }, 300)

      await poller.pollForDecision(requestId, 1000)

      // Verify intervals are increasing (exponential backoff)
      expect(checkIntervals.length).toBeGreaterThan(2)
      expect(checkIntervals[0]).toBeLessThan(150) // First interval ~100ms
      expect(checkIntervals[1]).toBeGreaterThan(checkIntervals[0]) // Second > first
      if (checkIntervals[2]) {
        expect(checkIntervals[2]).toBeGreaterThan(checkIntervals[1]) // Third > second
      }
    })
  })
})