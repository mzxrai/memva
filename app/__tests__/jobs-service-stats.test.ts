import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Jobs Service Statistics & Cleanup', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('getJobStats', () => {
    it('should provide job queue statistics', async () => {
      // This test will fail until we implement getJobStats
      const { createJob, updateJob, getJobStats } = await import('../db/jobs.service')
      
      // Create jobs with different statuses
      const job1 = await createJob({ type: 'test-job-1', data: {} })
      const job2 = await createJob({ type: 'test-job-2', data: {} })
      const job3 = await createJob({ type: 'test-job-3', data: {} })
      await createJob({ type: 'test-job-4', data: {} })

      // Update some jobs to different statuses
      await updateJob(job1.id, { status: 'running' })
      await updateJob(job2.id, { status: 'completed' })
      await updateJob(job3.id, { status: 'failed' })
      // job4 remains 'pending'

      const stats = await getJobStats()

      expect(stats).toBeDefined()
      expect(stats.pending).toBe(1)
      expect(stats.running).toBe(1)
      expect(stats.completed).toBe(1)
      expect(stats.failed).toBe(1)
      expect(stats.total).toBe(4)
    })

    it('should return zero stats when no jobs exist', async () => {
      // This test will fail until we implement getJobStats
      const { getJobStats } = await import('../db/jobs.service')
      
      const stats = await getJobStats()

      expect(stats).toBeDefined()
      expect(stats.pending).toBe(0)
      expect(stats.running).toBe(0)
      expect(stats.completed).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should include cancelled jobs in stats', async () => {
      // This test will fail until we implement getJobStats with cancelled support
      const { createJob, cancelJob, getJobStats } = await import('../db/jobs.service')
      
      const job1 = await createJob({ type: 'test-job-1', data: {} })
      await createJob({ type: 'test-job-2', data: {} })

      await cancelJob(job1.id)
      // job2 remains pending

      const stats = await getJobStats()

      expect(stats.pending).toBe(1)
      expect(stats.cancelled).toBe(1)
      expect(stats.total).toBe(2)
    })
  })

  describe('cleanupOldJobs', () => {
    it('should cleanup old completed and failed jobs', async () => {
      // This test will fail until we implement cleanupOldJobs
      const { createJob, updateJob, cleanupOldJobs, listJobs } = await import('../db/jobs.service')
      
      // Create jobs and mark them as completed/failed with old timestamps
      const oldDate = new Date(Date.now() - (35 * 24 * 60 * 60 * 1000)) // 35 days ago
      const oldTimestamp = oldDate.toISOString()

      const job1 = await createJob({ type: 'old-completed', data: {} })
      const job2 = await createJob({ type: 'old-failed', data: {} })
      const job3 = await createJob({ type: 'recent-completed', data: {} })
      await createJob({ type: 'pending', data: {} })

      // Mark jobs as completed/failed with old timestamps
      await updateJob(job1.id, { 
        status: 'completed', 
        completed_at: oldTimestamp 
      })
      await updateJob(job2.id, { 
        status: 'failed', 
        completed_at: oldTimestamp 
      })
      await updateJob(job3.id, { 
        status: 'completed', 
        completed_at: new Date().toISOString() // Recent
      })

      const deletedCount = await cleanupOldJobs(30) // Clean jobs older than 30 days

      expect(deletedCount).toBe(2) // Should delete 2 old jobs

      const remainingJobs = await listJobs()
      expect(remainingJobs).toHaveLength(2) // Should have 2 jobs left
      expect(remainingJobs.map(j => j.type)).toContain('recent-completed')
      expect(remainingJobs.map(j => j.type)).toContain('pending')
    })

    it('should not cleanup jobs that are still running or pending', async () => {
      // This test will fail until we implement cleanupOldJobs with proper filtering
      const { createJob, updateJob, cleanupOldJobs, listJobs } = await import('../db/jobs.service')
      
      const oldDate = new Date(Date.now() - (35 * 24 * 60 * 60 * 1000)) // 35 days ago
      const oldTimestamp = oldDate.toISOString()

      const job1 = await createJob({ type: 'old-running', data: {} })
      await createJob({ type: 'old-pending', data: {} })
      const job3 = await createJob({ type: 'old-completed', data: {} })

      // Set old timestamps but keep some jobs active
      await updateJob(job1.id, { 
        status: 'running', 
        started_at: oldTimestamp 
      })
      // job2 stays pending (created_at is old but it's still pending)
      await updateJob(job3.id, { 
        status: 'completed', 
        completed_at: oldTimestamp 
      })

      const deletedCount = await cleanupOldJobs(30)

      expect(deletedCount).toBe(1) // Should only delete completed job

      const remainingJobs = await listJobs()
      expect(remainingJobs).toHaveLength(2)
      expect(remainingJobs.map(j => j.type)).toContain('old-running')
      expect(remainingJobs.map(j => j.type)).toContain('old-pending')
    })

    it('should return zero when no old jobs to cleanup', async () => {
      // This test will fail until we implement cleanupOldJobs
      const { createJob, cleanupOldJobs } = await import('../db/jobs.service')
      
      // Create recent jobs
      await createJob({ type: 'recent-job', data: {} })

      const deletedCount = await cleanupOldJobs(30)

      expect(deletedCount).toBe(0)
    })

    it('should use default cleanup age when not specified', async () => {
      // This test will fail until we implement cleanupOldJobs with defaults
      const { createJob, updateJob, cleanupOldJobs } = await import('../db/jobs.service')
      
      // Create job that's 35 days old (older than default 30 days)
      const oldDate = new Date(Date.now() - (35 * 24 * 60 * 60 * 1000))
      const job = await createJob({ type: 'old-job', data: {} })
      await updateJob(job.id, { 
        status: 'completed', 
        completed_at: oldDate.toISOString() 
      })

      const deletedCount = await cleanupOldJobs() // No age specified, should use default

      expect(deletedCount).toBe(1)
    })
  })
})