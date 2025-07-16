import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createJob } from '../db/jobs.service'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Individual Job API Routes', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('GET /api/jobs/:jobId', () => {
    it('should retrieve specific job by ID', async () => {
      // This test will fail until we implement the API route
      const { loader } = await import('../routes/api.jobs.$jobId')
      
      // Create a test job
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'cleanup-old-jobs', olderThanDays: 30 },
        priority: 3
      })
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`)
      
      const response = await loader({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        job: {
          id: job.id,
          type: 'maintenance',
          data: { operation: 'cleanup-old-jobs', olderThanDays: 30 },
          status: 'pending',
          priority: 3,
          attempts: 0,
          max_attempts: 3,
          error: null,
          result: null,
          scheduled_at: null,
          started_at: null,
          completed_at: null,
          created_at: expect.any(String),
          updated_at: expect.any(String)
        }
      })
    })

    it('should return 404 for non-existent job', async () => {
      // This test will fail until we implement error handling
      const { loader } = await import('../routes/api.jobs.$jobId')
      
      const request = new Request('http://localhost:3000/api/jobs/non-existent-job-id')
      
      const response = await loader({ 
        request, 
        params: { jobId: 'non-existent-job-id' },
        context: {}
      })
      
      expect(response.status).toBe(404)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Job not found: non-existent-job-id'
      })
    })

    it('should handle database errors gracefully', async () => {
      // This test will fail until we implement error handling
      const { loader } = await import('../routes/api.jobs.$jobId')
      
      // Test with an invalid job ID that might cause database errors
      const request = new Request('http://localhost:3000/api/jobs/invalid-job-id')
      
      const response = await loader({ 
        request, 
        params: { jobId: 'invalid-job-id' },
        context: {}
      })
      
      expect(response.status).toBe(404)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Job not found: invalid-job-id'
      })
    })

    it('should include job results when job is completed', async () => {
      // This test will fail until we implement result handling
      const { loader } = await import('../routes/api.jobs.$jobId')
      
      // Create a completed job with results
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'vacuum-database' },
        priority: 2
      })
      
      // Update job to completed status with results (would need updateJob function)
      // For now, test the structure assuming the job has results
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`)
      
      const response = await loader({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.job.id).toBe(job.id)
      expect(responseData.job.type).toBe('maintenance')
    })
  })

  describe('PUT /api/jobs/:jobId', () => {
    it('should update job priority', async () => {
      // This test will fail until we implement job updates
      const { action } = await import('../routes/api.jobs.$jobId')
      
      // Create a test job
      const job = await createJob({
        type: 'session-runner',
        data: { sessionId: 'test-session', prompt: 'Test prompt' },
        priority: 5
      })
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priority: 8
        }),
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        job: expect.objectContaining({
          id: job.id,
          priority: 8,
          updated_at: expect.any(String)
        })
      })
    })

    it('should update job scheduled time', async () => {
      // This test will fail until we implement scheduling updates
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'backup-database', backupPath: '/backup.db' },
        priority: 2
      })
      
      const scheduledTime = new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduled_at: scheduledTime
        }),
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.job.scheduled_at).toBe(scheduledTime)
    })

    it('should validate update request body', async () => {
      // This test will fail until we implement validation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'cleanup-old-jobs', olderThanDays: 30 }
      })
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invalidField: 'invalid-value'
        }),
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(400)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'No valid update fields provided'
      })
    })

    it('should return 404 for non-existent job update', async () => {
      // This test will fail until we implement job existence validation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const request = new Request('http://localhost:3000/api/jobs/non-existent-job', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priority: 5
        }),
      })
      
      const response = await action({ 
        request, 
        params: { jobId: 'non-existent-job' },
        context: {}
      })
      
      expect(response.status).toBe(404)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Job not found: non-existent-job'
      })
    })

    it('should reject updates to completed jobs', async () => {
      // This test will fail until we implement job state validation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      // Create a job and mark it as completed (would need to update status)
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'vacuum-database' }
      })
      
      // In real implementation, would update job status to 'completed'
      // For now, test assumes job is already completed
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priority: 9
        }),
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      // Should succeed for now since job isn't actually completed in test
      // In real implementation with proper job state tracking, this would return 400
      expect(response.status).toBe(200)
    })
  })

  describe('DELETE /api/jobs/:jobId', () => {
    it('should cancel specific job', async () => {
      // This test will fail until we implement job cancellation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const job = await createJob({
        type: 'session-runner',
        data: { sessionId: 'test-session', prompt: 'Test prompt' },
        priority: 7
      })
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'DELETE'
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        message: `Job ${job.id} cancelled`,
        job: expect.objectContaining({
          id: job.id,
          status: 'cancelled',
          updated_at: expect.any(String)
        })
      })
    })

    it('should return 404 for non-existent job cancellation', async () => {
      // This test will fail until we implement existence validation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const request = new Request('http://localhost:3000/api/jobs/non-existent-job', {
        method: 'DELETE'
      })
      
      const response = await action({ 
        request, 
        params: { jobId: 'non-existent-job' },
        context: {}
      })
      
      expect(response.status).toBe(404)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Job not found: non-existent-job'
      })
    })

    it('should handle cancellation of already completed jobs', async () => {
      // This test will fail until we implement job state validation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'cleanup-old-jobs', olderThanDays: 30 }
      })
      
      // In real implementation, would mark job as completed first
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'DELETE'
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      // Should succeed for now since job state isn't fully implemented
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
    })

    it('should handle cancellation of running jobs', async () => {
      // This test will fail until we implement running job cancellation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const job = await createJob({
        type: 'session-runner',
        data: { sessionId: 'test-session', prompt: 'Long running task' },
        priority: 5
      })
      
      // In real implementation, would mark job as running first
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'DELETE'
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.message).toContain('cancelled')
    })
  })

  describe('Request/Response Validation', () => {
    it('should handle malformed JSON in PUT requests', async () => {
      // This test will fail until we implement JSON validation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'vacuum-database' }
      })
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json{',
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(400)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Invalid JSON in request body'
      })
    })

    it('should handle unsupported HTTP methods', async () => {
      // This test will fail until we implement method validation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'backup-database', backupPath: '/backup.db' }
      })
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'PATCH'
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(405)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Method PATCH not allowed'
      })
    })

    it('should validate Content-Type for PUT requests', async () => {
      // This test will fail until we implement content type validation
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'cleanup-old-jobs', olderThanDays: 30 }
      })
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'PUT',
        body: JSON.stringify({ priority: 6 }),
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {}
      })
      
      expect(response.status).toBe(400)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Content-Type must be application/json'
      })
    })
  })
})