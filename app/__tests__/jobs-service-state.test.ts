import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Jobs Service State Management', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('claimNextJob', () => {
    it('should claim next available job atomically', async () => {
      // This test will fail until we implement claimNextJob
      const { createJob, claimNextJob } = await import('../db/jobs.service')
      
      // Create multiple jobs with different priorities
      await createJob({ type: 'low-priority', data: {}, priority: 1 })
      await createJob({ type: 'high-priority', data: {}, priority: 10 })
      await createJob({ type: 'medium-priority', data: {}, priority: 5 })

      const claimedJob = await claimNextJob()

      expect(claimedJob).toBeDefined()
      expect(claimedJob?.type).toBe('high-priority') // Should claim highest priority first
      expect(claimedJob?.status).toBe('running')
      expect(claimedJob?.started_at).toBeDefined()
      expect(claimedJob?.attempts).toBe(1) // Should increment attempts
    })

    it('should return null when no jobs are available', async () => {
      // This test will fail until we implement claimNextJob
      const { claimNextJob } = await import('../db/jobs.service')
      
      const result = await claimNextJob()
      
      expect(result).toBeNull()
    })

    it('should not claim jobs that are already running', async () => {
      // This test will fail until we implement proper job claiming
      const { createJob, updateJob, claimNextJob } = await import('../db/jobs.service')
      
      const job1 = await createJob({ type: 'test-job-1', data: {} })
      await createJob({ type: 'test-job-2', data: {} })
      
      // Mark first job as running
      await updateJob(job1.id, { status: 'running' })

      const claimedJob = await claimNextJob()

      expect(claimedJob).toBeDefined()
      expect(claimedJob?.type).toBe('test-job-2') // Should skip running job
    })

    it('should not claim scheduled jobs before their scheduled time', async () => {
      // This test will fail until we implement scheduling logic
      const { createJob, claimNextJob } = await import('../db/jobs.service')
      
      const futureTime = new Date(Date.now() + 60000).toISOString() // 1 minute from now
      await createJob({ 
        type: 'future-job', 
        data: {}, 
        scheduled_at: futureTime 
      })
      await createJob({ type: 'immediate-job', data: {} })

      const claimedJob = await claimNextJob()

      expect(claimedJob).toBeDefined()
      expect(claimedJob?.type).toBe('immediate-job') // Should skip future job
    })

    it('should claim scheduled jobs when their time has arrived', async () => {
      // This test will fail until we implement scheduling logic
      const { createJob, claimNextJob } = await import('../db/jobs.service')
      
      const pastTime = new Date(Date.now() - 60000).toISOString() // 1 minute ago
      await createJob({ 
        type: 'ready-job', 
        data: {}, 
        scheduled_at: pastTime 
      })

      const claimedJob = await claimNextJob()

      expect(claimedJob).toBeDefined()
      expect(claimedJob?.type).toBe('ready-job')
    })
  })

  describe('completeJob', () => {
    it('should mark job as completed with results', async () => {
      // This test will fail until we implement completeJob
      const { createJob, claimNextJob, completeJob } = await import('../db/jobs.service')
      
      await createJob({ type: 'test-job', data: {} })
      const claimedJob = await claimNextJob()
      
      const result = { success: true, processed: 42 }
      const completedJob = await completeJob(claimedJob?.id || '', result)

      expect(completedJob).toBeDefined()
      expect(completedJob?.status).toBe('completed')
      expect(completedJob?.result).toEqual(result)
      expect(completedJob?.completed_at).toBeDefined()
    })

    it('should return null for non-existent job', async () => {
      // This test will fail until we implement completeJob
      const { completeJob } = await import('../db/jobs.service')
      
      const result = await completeJob('non-existent-id', { success: true })
      
      expect(result).toBeNull()
    })
  })

  describe('failJob', () => {
    it('should mark job as failed when max attempts reached', async () => {
      // This test will fail until we implement failJob with retry logic
      const { createJob, claimNextJob, failJob } = await import('../db/jobs.service')
      
      await createJob({ type: 'test-job', data: {}, max_attempts: 2 })
      const claimedJob = await claimNextJob()
      
      // Simulate two failed attempts
      await failJob(claimedJob?.id || '', 'First error', true)
      const secondClaim = await claimNextJob()
      const finalResult = await failJob(secondClaim?.id || '', 'Final error', true)

      expect(finalResult).toBeDefined()
      expect(finalResult?.status).toBe('failed')
      expect(finalResult?.error).toBe('Final error')
      expect(finalResult?.completed_at).toBeDefined()
      expect(finalResult?.attempts).toBe(2)
    })

    it('should reset job to pending for retry when under max attempts', async () => {
      // This test will fail until we implement retry logic
      const { createJob, claimNextJob, failJob } = await import('../db/jobs.service')
      
      await createJob({ type: 'test-job', data: {}, max_attempts: 3 })
      const claimedJob = await claimNextJob()
      
      const result = await failJob(claimedJob?.id || '', 'Retry error', true)

      expect(result).toBeDefined()
      expect(result?.status).toBe('pending') // Should be pending for retry
      expect(result?.error).toBe('Retry error')
      expect(result?.completed_at).toBeNull() // Should not be completed yet
      expect(result?.attempts).toBe(1)
    })

    it('should mark job as failed immediately when shouldRetry is false', async () => {
      // This test will fail until we implement immediate failure
      const { createJob, claimNextJob, failJob } = await import('../db/jobs.service')
      
      await createJob({ type: 'test-job', data: {}, max_attempts: 3 })
      const claimedJob = await claimNextJob()
      
      const result = await failJob(claimedJob?.id || '', 'Critical error', false)

      expect(result).toBeDefined()
      expect(result?.status).toBe('failed')
      expect(result?.error).toBe('Critical error')
      expect(result?.completed_at).toBeDefined()
    })
  })

  describe('cancelJob', () => {
    it('should mark job as cancelled', async () => {
      // This test will fail until we implement cancelJob
      const { createJob, cancelJob } = await import('../db/jobs.service')
      
      const job = await createJob({ type: 'test-job', data: {} })
      const result = await cancelJob(job.id)

      expect(result).toBeDefined()
      expect(result?.status).toBe('cancelled')
      expect(result?.completed_at).toBeDefined()
    })

    it('should return null for non-existent job', async () => {
      // This test will fail until we implement cancelJob
      const { cancelJob } = await import('../db/jobs.service')
      
      const result = await cancelJob('non-existent-id')
      
      expect(result).toBeNull()
    })
  })
})