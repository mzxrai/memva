import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Jobs API Routes', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('POST /api/jobs', () => {
    it('should create a session runner job', async () => {
      // This test will fail until we implement the API route
      const { action } = await import('../routes/api.jobs')
      
      // Create a session for the job
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'session-runner',
          data: {
            sessionId: session.id,
            prompt: 'Hello Claude, please help with this task',
            userId: 'user-123'
          }
        }),
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(201)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        jobId: expect.any(String),
        type: 'session-runner',
        status: 'pending',
        createdAt: expect.any(String)
      })
    })

    it('should create a maintenance job', async () => {
      // This test will fail until we implement maintenance job creation
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'maintenance',
          data: {
            operation: 'cleanup-old-jobs',
            olderThanDays: 30
          }
        }),
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(201)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        jobId: expect.any(String),
        type: 'maintenance',
        status: 'pending',
        createdAt: expect.any(String)
      })
    })

    it('should validate required job data', async () => {
      // This test will fail until we implement validation
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing type and data
          invalidField: 'invalid'
        }),
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(400)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Missing required field: type'
      })
    })

    it('should validate job type is supported', async () => {
      // This test will fail until we implement type validation
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'unknown-job-type',
          data: {}
        }),
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(400)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Unknown job type: unknown-job-type'
      })
    })

    it('should validate session exists for session runner jobs', async () => {
      // This test will fail until we implement session validation
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'session-runner',
          data: {
            sessionId: 'non-existent-session',
            prompt: 'Test prompt'
          }
        }),
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(404)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Session not found: non-existent-session'
      })
    })
  })

  describe('GET /api/jobs', () => {
    it('should list all jobs with default pagination', async () => {
      // This test will fail until we implement job listing
      const { loader } = await import('../routes/api.jobs')
      
      // Create some test jobs (would need job storage implementation)
      // For now, test the API structure
      
      const request = new Request('http://localhost:3000/api/jobs')
      
      const response = await loader({ request, params: {}, context: {} })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        jobs: expect.any(Array),
        pagination: {
          page: 1,
          limit: 50,
          total: expect.any(Number),
          totalPages: expect.any(Number)
        }
      })
    })

    it('should filter jobs by type', async () => {
      // This test will fail until we implement filtering
      const { loader } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs?type=session-runner')
      
      const response = await loader({ request, params: {}, context: {} })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.jobs).toEqual(expect.any(Array))
      // In real implementation, would check that all jobs are session-runner type
    })

    it('should filter jobs by status', async () => {
      // This test will fail until we implement status filtering
      const { loader } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs?status=pending')
      
      const response = await loader({ request, params: {}, context: {} })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.jobs).toEqual(expect.any(Array))
      // In real implementation, would check that all jobs are pending
    })

    it('should return job statistics when action=stats', async () => {
      // This test will fail until we implement statistics
      const { loader } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs?action=stats')
      
      const response = await loader({ request, params: {}, context: {} })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        stats: {
          total: expect.any(Number),
          pending: expect.any(Number),
          running: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number),
          byType: expect.any(Object)
        }
      })
    })

    it('should handle pagination parameters', async () => {
      // This test will fail until we implement pagination
      const { loader } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs?page=2&limit=10')
      
      const response = await loader({ request, params: {}, context: {} })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.pagination.page).toBe(2)
      expect(responseData.pagination.limit).toBe(10)
    })
  })

  describe('DELETE /api/jobs', () => {
    it('should cancel all pending jobs', async () => {
      // This test will fail until we implement job cancellation
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'DELETE'
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        cancelledCount: expect.any(Number),
        message: 'All pending jobs cancelled'
      })
    })

    it('should cancel jobs by type filter', async () => {
      // This test will fail until we implement filtered cancellation
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs?type=maintenance', {
        method: 'DELETE'
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        cancelledCount: expect.any(Number),
        message: 'Jobs cancelled for type: maintenance'
      })
    })

    it('should handle cancellation errors gracefully', async () => {
      // This test will fail until we implement error handling
      const { action } = await import('../routes/api.jobs')
      
      // Test with invalid filter that might cause errors
      const request = new Request('http://localhost:3000/api/jobs?invalidFilter=true', {
        method: 'DELETE'
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      // Should succeed even with invalid filters, just ignore them
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
    })
  })

  describe('Request/Response Validation', () => {
    it('should handle malformed JSON in POST requests', async () => {
      // This test will fail until we implement JSON parsing error handling
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json{',
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(400)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Invalid JSON in request body'
      })
    })

    it('should handle missing Content-Type header', async () => {
      // This test will fail until we implement content type validation
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ type: 'maintenance', data: {} }),
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(400)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Content-Type must be application/json'
      })
    })

    it('should handle unsupported HTTP methods', async () => {
      // This test will fail until we implement method validation
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'PATCH'
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(405)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Method PATCH not allowed'
      })
    })
  })
})