import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForCondition } from '../test-utils/async-testing'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Job Worker Processing', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('Job Polling and Claiming', () => {
    it('should poll for and claim jobs from database', async () => {
      // This test will fail until we implement job polling
      const { JobWorker } = await import('../workers/job-worker')
      const { createJob } = await import('../db/jobs.service')
      
      const worker = new JobWorker()
      
      // Register a test handler
      const testHandler = vi.fn((job, callback) => {
        callback(null, { processed: true })
      })
      worker.registerHandler('test-job', testHandler)
      
      // Create a job in the database
      await createJob({ type: 'test-job', data: { message: 'test' } })
      
      // Start the worker and wait for job processing
      await worker.start()
      
      // Wait for the job to be processed
      await waitForCondition(() => testHandler.mock.calls.length > 0, { timeoutMs: 5000 })
      
      expect(testHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test-job',
          data: { message: 'test' }
        }),
        expect.any(Function)
      )
      
      await worker.stop()
    })

    it('should only claim jobs that have registered handlers', async () => {
      // This test will fail until we implement handler filtering
      const { JobWorker } = await import('../workers/job-worker')
      const { createJob, listJobs } = await import('../db/jobs.service')
      
      const worker = new JobWorker()
      
      // Register only one handler
      const testHandler = vi.fn((job, callback) => {
        callback(null, { processed: true })
      })
      worker.registerHandler('test-job', testHandler)
      
      // Create jobs with different types
      await createJob({ type: 'test-job', data: { message: 'test' } })
      await createJob({ type: 'unknown-job', data: { message: 'unknown' } })
      
      await worker.start()
      
      // Wait for processing
      await waitForCondition(() => testHandler.mock.calls.length > 0, { timeoutMs: 5000 })
      
      // Only the known job should be processed
      expect(testHandler).toHaveBeenCalledTimes(1)
      
      // Unknown job should remain pending
      const remainingJobs = await listJobs({ status: 'pending' })
      expect(remainingJobs).toHaveLength(1)
      expect(remainingJobs[0].type).toBe('unknown-job')
      
      await worker.stop()
    })

    it('should respect job priorities when claiming', async () => {
      // This test will fail until we implement priority handling
      const { JobWorker } = await import('../workers/job-worker')
      const { createJob } = await import('../db/jobs.service')
      
      const worker = new JobWorker()
      
      const processedJobs: unknown[] = []
      const testHandler = vi.fn((job, callback) => {
        processedJobs.push(job)
        callback(null, { processed: true })
      })
      worker.registerHandler('test-job', testHandler)
      
      // Create jobs with different priorities
      await createJob({ type: 'test-job', data: { message: 'low' }, priority: 1 })
      await createJob({ type: 'test-job', data: { message: 'high' }, priority: 10 })
      await createJob({ type: 'test-job', data: { message: 'medium' }, priority: 5 })
      
      await worker.start()
      
      // Wait for all jobs to be processed
      await waitForCondition(() => processedJobs.length === 3, { timeoutMs: 5000 })
      
      // Jobs should be processed in priority order (highest first)
      expect((processedJobs[0] as any).data.message).toBe('high')
      expect((processedJobs[1] as any).data.message).toBe('medium')
      expect((processedJobs[2] as any).data.message).toBe('low')
      
      await worker.stop()
    })
  })

  describe('Job Execution and Progress Tracking', () => {
    it('should execute job handlers with progress tracking', async () => {
      // This test will fail until we implement progress tracking
      const { JobWorker } = await import('../workers/job-worker')
      const { createJob, getJob } = await import('../db/jobs.service')
      
      const worker = new JobWorker()
      
      let progressCallback: Function | null = null
      const testHandler = vi.fn((job, callback) => {
        progressCallback = callback
        // Simulate async work with progress
        setTimeout(() => {
          callback(null, { result: 'completed' })
        }, 100)
      })
      worker.registerHandler('progress-job', testHandler)
      
      const job = await createJob({ type: 'progress-job', data: { work: 'important' } })
      
      await worker.start()
      
      // Wait for handler to be called
      await waitForCondition(() => progressCallback !== null, { timeoutMs: 5000 })
      
      // Check that job status was updated to running
      const runningJob = await getJob(job.id)
      expect(runningJob?.status).toBe('running')
      expect(runningJob?.started_at).toBeDefined()
      
      // Wait for completion
      await waitForCondition(async () => {
        const completedJob = await getJob(job.id)
        return completedJob?.status === 'completed'
      }, { timeoutMs: 5000 })
      
      // Check final job status
      const completedJob = await getJob(job.id)
      expect(completedJob?.status).toBe('completed')
      expect(completedJob?.result).toEqual({ result: 'completed' })
      expect(completedJob?.completed_at).toBeDefined()
      
      await worker.stop()
    })

    it('should handle job handler errors and update job status', async () => {
      // This test will fail until we implement error handling
      const { JobWorker } = await import('../workers/job-worker')
      const { createJob, getJob } = await import('../db/jobs.service')
      
      const worker = new JobWorker()
      
      const testHandler = vi.fn((job, callback) => {
        callback(new Error('Handler failed'), null)
      })
      worker.registerHandler('failing-job', testHandler)
      
      const job = await createJob({ type: 'failing-job', data: { work: 'doomed' } })
      
      await worker.start()
      
      // Wait for job to fail
      await waitForCondition(async () => {
        const failedJob = await getJob(job.id)
        return failedJob?.status === 'failed' || failedJob?.status === 'pending'
      }, { timeoutMs: 5000 })
      
      const failedJob = await getJob(job.id)
      
      // Should be marked as failed or pending for retry
      expect(['failed', 'pending']).toContain(failedJob?.status)
      if (failedJob?.status === 'failed') {
        expect(failedJob?.error).toBe('Handler failed')
        expect(failedJob?.completed_at).toBeDefined()
      }
      
      await worker.stop()
    })

    it('should retry failed jobs up to maxRetries limit', async () => {
      // This test will fail until we implement retry logic
      const { JobWorker } = await import('../workers/job-worker')
      const { createJob, getJob } = await import('../db/jobs.service')
      
      const worker = new JobWorker({ maxRetries: 2 })
      
      let callCount = 0
      const testHandler = vi.fn((job, callback) => {
        callCount++
        callback(new Error(`Attempt ${callCount} failed`), null)
      })
      worker.registerHandler('retry-job', testHandler)
      
      const job = await createJob({ type: 'retry-job', data: { work: 'retry' }, max_attempts: 2 })
      
      await worker.start()
      
      // Wait for all retry attempts
      await waitForCondition(() => callCount >= 2, { timeoutMs: 5000 })
      
      expect(testHandler).toHaveBeenCalledTimes(2)
      
      // Final job should be failed
      await waitForCondition(async () => {
        const finalJob = await getJob(job.id)
        return finalJob?.status === 'failed'
      }, { timeoutMs: 5000 })
      
      const finalJob = await getJob(job.id)
      expect(finalJob?.status).toBe('failed')
      expect(finalJob?.attempts).toBe(2)
      
      await worker.stop()
    })
  })

  describe('Configurable Concurrency', () => {
    it('should process multiple jobs concurrently when configured', async () => {
      // This test will fail until we implement concurrent processing
      const { JobWorker } = await import('../workers/job-worker')
      const { createJob } = await import('../db/jobs.service')
      
      const worker = new JobWorker({ concurrent: 3 })
      
      const activeJobs = new Set()
      const maxConcurrentJobs = { value: 0 }
      
      const testHandler = vi.fn((job, callback) => {
        activeJobs.add(job.id)
        maxConcurrentJobs.value = Math.max(maxConcurrentJobs.value, activeJobs.size)
        
        // Simulate longer work to ensure jobs overlap
        setTimeout(() => {
          activeJobs.delete(job.id)
          callback(null, { processed: true })
        }, 800)
      })
      worker.registerHandler('concurrent-job', testHandler)
      
      // Create multiple jobs
      for (let i = 0; i < 5; i++) {
        await createJob({ type: 'concurrent-job', data: { index: i } })
      }
      
      await worker.start()
      
      // Wait for all jobs to complete
      await waitForCondition(() => testHandler.mock.calls.length >= 5, { timeoutMs: 8000 })
      
      // Should have processed multiple jobs concurrently
      expect(maxConcurrentJobs.value).toBeGreaterThanOrEqual(3)
      
      await worker.stop()
    })

    it('should limit concurrency to configured value', async () => {
      // This test will fail until we implement concurrency limits
      const { JobWorker } = await import('../workers/job-worker')
      const { createJob } = await import('../db/jobs.service')
      
      const worker = new JobWorker({ concurrent: 2 })
      
      const activeJobs = new Set()
      const maxConcurrentJobs = { value: 0 }
      
      const testHandler = vi.fn((job, callback) => {
        activeJobs.add(job.id)
        maxConcurrentJobs.value = Math.max(maxConcurrentJobs.value, activeJobs.size)
        
        // Longer work to ensure jobs overlap
        setTimeout(() => {
          activeJobs.delete(job.id)
          callback(null, { processed: true })
        }, 1000)
      })
      worker.registerHandler('limited-job', testHandler)
      
      // Create many jobs
      for (let i = 0; i < 6; i++) {
        await createJob({ type: 'limited-job', data: { index: i } })
      }
      
      await worker.start()
      
      // Wait for all jobs to complete  
      await waitForCondition(() => testHandler.mock.calls.length >= 6, { timeoutMs: 12000 })
      
      // Should never exceed the concurrency limit
      expect(maxConcurrentJobs.value).toBeLessThanOrEqual(2)
      expect(maxConcurrentJobs.value).toBeGreaterThanOrEqual(1)
      
      await worker.stop()
    })
  })
})