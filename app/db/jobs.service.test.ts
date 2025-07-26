import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { 
  createJob,
  getJob,
  updateJob,
  listJobs,
  claimNextJob,
  completeJob,
  failJob,
  cancelJob,
  getActiveJobForSession,
  getJobStats,
  cleanupOldJobs,
  type CreateJobInput,
  type UpdateJobInput,
  type JobStatus
} from './jobs.service'

describe('Jobs Service', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('createJob', () => {
    it('should create a new job with default values', async () => {
      const jobData: CreateJobInput = {
        type: 'test-job',
        data: { message: 'Hello World' }
      }

      const job = await createJob(jobData)

      expect(job).toMatchObject({
        type: 'test-job',
        data: { message: 'Hello World' },
        status: 'pending',
        priority: 0,
        attempts: 0,
        max_attempts: 3,
        error: null,
        result: null,
        scheduled_at: null,
        started_at: null,
        completed_at: null
      })
      expect(job.id).toBeDefined()
      expect(job.created_at).toBeDefined()
      expect(job.updated_at).toBeDefined()
    })

    it('should create a job with custom priority and max_attempts', async () => {
      const jobData: CreateJobInput = {
        type: 'priority-job',
        data: { task: 'important' },
        priority: 10,
        max_attempts: 5
      }

      const job = await createJob(jobData)

      expect(job.priority).toBe(10)
      expect(job.max_attempts).toBe(5)
    })

    it('should create a scheduled job', async () => {
      const futureDate = new Date(Date.now() + 60000).toISOString()
      const jobData: CreateJobInput = {
        type: 'scheduled-job',
        data: { scheduled: true },
        scheduled_at: futureDate
      }

      const job = await createJob(jobData)

      expect(job.scheduled_at).toBe(futureDate)
    })
  })

  describe('getJob', () => {
    it('should retrieve an existing job', async () => {
      const created = await createJob({
        type: 'test-job',
        data: { test: true }
      })

      const retrieved = await getJob(created.id)

      expect(retrieved).toEqual(created)
    })

    it('should return null for non-existent job', async () => {
      const job = await getJob('non-existent-id')
      expect(job).toBeNull()
    })
  })

  describe('updateJob', () => {
    it('should update job status', async () => {
      const job = await createJob({
        type: 'test-job',
        data: { test: true }
      })

      // Wait a moment to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10))

      const updated = await updateJob(job.id, { status: 'running' })

      expect(updated?.status).toBe('running')
      expect(updated?.updated_at).not.toBe(job.updated_at)
    })

    it('should update multiple job fields', async () => {
      const job = await createJob({
        type: 'test-job',
        data: { test: true }
      })

      const updates: UpdateJobInput = {
        status: 'completed',
        result: { output: 'success' },
        completed_at: new Date().toISOString()
      }

      const updated = await updateJob(job.id, updates)

      expect(updated).toMatchObject({
        status: 'completed',
        result: { output: 'success' },
        completed_at: updates.completed_at
      })
    })

    it('should return null for non-existent job', async () => {
      const updated = await updateJob('non-existent-id', { status: 'running' })
      expect(updated).toBeNull()
    })
  })

  describe('listJobs', () => {
    it('should list all jobs ordered by priority and creation time', async () => {
      // Create jobs with different priorities
      const job1 = await createJob({
        type: 'low-priority',
        data: { index: 1 },
        priority: 0
      })
      
      const job2 = await createJob({
        type: 'high-priority',
        data: { index: 2 },
        priority: 10
      })
      
      const job3 = await createJob({
        type: 'medium-priority',
        data: { index: 3 },
        priority: 5
      })

      const jobs = await listJobs()

      expect(jobs).toHaveLength(3)
      expect(jobs[0].id).toBe(job2.id) // highest priority
      expect(jobs[1].id).toBe(job3.id) // medium priority
      expect(jobs[2].id).toBe(job1.id) // lowest priority
    })

    it('should filter jobs by status', async () => {
      const pending = await createJob({
        type: 'pending-job',
        data: { test: true }
      })

      const running = await createJob({
        type: 'running-job',
        data: { test: true }
      })
      await updateJob(running.id, { status: 'running' })

      const completed = await createJob({
        type: 'completed-job',
        data: { test: true }
      })
      await updateJob(completed.id, { status: 'completed' })

      const pendingJobs = await listJobs({ status: 'pending' })
      expect(pendingJobs).toHaveLength(1)
      expect(pendingJobs[0].id).toBe(pending.id)

      const runningJobs = await listJobs({ status: 'running' })
      expect(runningJobs).toHaveLength(1)
      expect(runningJobs[0].id).toBe(running.id)
    })

    it('should filter jobs by type', async () => {
      await createJob({
        type: 'type-a',
        data: { test: true }
      })

      await createJob({
        type: 'type-b',
        data: { test: true }
      })

      await createJob({
        type: 'type-a',
        data: { test: true }
      })

      const typeAJobs = await listJobs({ type: 'type-a' })
      expect(typeAJobs).toHaveLength(2)
      typeAJobs.forEach(job => expect(job.type).toBe('type-a'))

      const typeBJobs = await listJobs({ type: 'type-b' })
      expect(typeBJobs).toHaveLength(1)
      expect(typeBJobs[0].type).toBe('type-b')
    })

    it('should limit results when limit is specified', async () => {
      // Create 5 jobs
      for (let i = 0; i < 5; i++) {
        await createJob({
          type: 'test-job',
          data: { index: i }
        })
      }

      const limitedJobs = await listJobs({ limit: 3 })
      expect(limitedJobs).toHaveLength(3)
    })
  })

  describe('claimNextJob', () => {
    it('should claim the highest priority pending job', async () => {
      await createJob({
        type: 'low-priority',
        data: { test: true },
        priority: 0
      })

      const highPriority = await createJob({
        type: 'high-priority',
        data: { test: true },
        priority: 10
      })

      const claimed = await claimNextJob()

      expect(claimed?.id).toBe(highPriority.id)
      expect(claimed?.status).toBe('running')
      expect(claimed?.started_at).toBeDefined()
      expect(claimed?.attempts).toBe(1)
    })

    it('should not claim scheduled jobs that are not ready', async () => {
      const futureDate = new Date(Date.now() + 60000).toISOString()
      await createJob({
        type: 'scheduled-job',
        data: { test: true },
        scheduled_at: futureDate
      })

      const claimed = await claimNextJob()
      expect(claimed).toBeNull()
    })

    it('should claim scheduled jobs that are ready', async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString()
      const job = await createJob({
        type: 'scheduled-job',
        data: { test: true },
        scheduled_at: pastDate
      })

      const claimed = await claimNextJob()
      expect(claimed?.id).toBe(job.id)
      expect(claimed?.status).toBe('running')
    })

    it('should return null when no jobs are available', async () => {
      const claimed = await claimNextJob()
      expect(claimed).toBeNull()
    })

    it('should increment attempts when claiming a job', async () => {
      const job = await createJob({
        type: 'test-job',
        data: { test: true }
      })

      const claimed1 = await claimNextJob()
      expect(claimed1?.attempts).toBe(1)

      // Reset to pending to claim again
      await updateJob(job.id, { status: 'pending' })
      
      const claimed2 = await claimNextJob()
      expect(claimed2?.attempts).toBe(2)
    })
  })

  describe('completeJob', () => {
    it('should mark job as completed with result', async () => {
      const job = await createJob({
        type: 'test-job',
        data: { test: true }
      })

      const result = { output: 'success', data: [1, 2, 3] }
      const completed = await completeJob(job.id, result)

      expect(completed).toMatchObject({
        status: 'completed',
        result: result,
        completed_at: expect.any(String)
      })
    })

    it('should mark job as completed without result', async () => {
      const job = await createJob({
        type: 'test-job',
        data: { test: true }
      })

      const completed = await completeJob(job.id)

      expect(completed?.status).toBe('completed')
      expect(completed?.result).toBeNull()
      expect(completed?.completed_at).toBeDefined()
    })
  })

  describe('failJob', () => {
    it('should mark job as failed when max attempts reached', async () => {
      const job = await createJob({
        type: 'test-job',
        data: { test: true },
        max_attempts: 3
      })

      // Simulate max attempts reached
      await updateJob(job.id, { attempts: 3 })

      const failed = await failJob(job.id, 'Test error')

      expect(failed).toMatchObject({
        status: 'failed',
        error: 'Test error',
        completed_at: expect.any(String)
      })
    })

    it('should reset job to pending when retries available', async () => {
      const job = await createJob({
        type: 'test-job',
        data: { test: true },
        max_attempts: 3
      })

      await updateJob(job.id, { attempts: 1 })

      const failed = await failJob(job.id, 'Temporary error')

      expect(failed).toMatchObject({
        status: 'pending',
        error: 'Temporary error',
        completed_at: null
      })
    })

    it('should mark job as failed when shouldRetry is false', async () => {
      const job = await createJob({
        type: 'test-job',
        data: { test: true }
      })

      const failed = await failJob(job.id, 'Permanent error', false)

      expect(failed).toMatchObject({
        status: 'failed',
        error: 'Permanent error',
        completed_at: expect.any(String)
      })
    })

    it('should return null for non-existent job', async () => {
      const failed = await failJob('non-existent-id', 'Error')
      expect(failed).toBeNull()
    })
  })

  describe('cancelJob', () => {
    it('should mark job as cancelled', async () => {
      const job = await createJob({
        type: 'test-job',
        data: { test: true }
      })

      const cancelled = await cancelJob(job.id)

      expect(cancelled).toMatchObject({
        status: 'cancelled',
        completed_at: expect.any(String)
      })
    })
  })

  describe('getActiveJobForSession', () => {
    it('should find active job for session', async () => {
      const sessionId = 'test-session-123'
      
      const activeJob = await createJob({
        type: 'session-runner',
        data: { sessionId }
      })

      const found = await getActiveJobForSession(sessionId)
      expect(found?.id).toBe(activeJob.id)
    })

    it('should find running job for session', async () => {
      const sessionId = 'test-session-123'
      
      const job = await createJob({
        type: 'session-runner',
        data: { sessionId }
      })
      await updateJob(job.id, { status: 'running' })

      const found = await getActiveJobForSession(sessionId)
      expect(found?.id).toBe(job.id)
    })

    it('should not find completed job for session', async () => {
      const sessionId = 'test-session-123'
      
      const job = await createJob({
        type: 'session-runner',
        data: { sessionId }
      })
      await updateJob(job.id, { status: 'completed' })

      const found = await getActiveJobForSession(sessionId)
      expect(found).toBeNull()
    })

    it('should return null when no active job exists', async () => {
      const found = await getActiveJobForSession('non-existent-session')
      expect(found).toBeNull()
    })
  })

  describe('getJobStats', () => {
    it('should return correct job statistics', async () => {
      // Create jobs with different statuses
      const statuses: JobStatus[] = ['pending', 'pending', 'running', 'completed', 'failed', 'cancelled']
      
      for (const status of statuses) {
        const job = await createJob({
          type: 'test-job',
          data: { status }
        })
        if (status !== 'pending') {
          await updateJob(job.id, { status })
        }
      }

      const stats = await getJobStats()

      expect(stats).toEqual({
        pending: 2,
        running: 1,
        completed: 1,
        failed: 1,
        cancelled: 1,
        total: 6
      })
    })

    it('should return zero counts when no jobs exist', async () => {
      const stats = await getJobStats()

      expect(stats).toEqual({
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0
      })
    })
  })

  describe('cleanupOldJobs', () => {
    it('should delete old completed jobs', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 35)
      const oldDateStr = oldDate.toISOString()

      // Create an old completed job
      const oldJob = await createJob({
        type: 'old-job',
        data: { test: true }
      })
      await updateJob(oldJob.id, { 
        status: 'completed',
        completed_at: oldDateStr
      })

      // Create a recent completed job
      const recentJob = await createJob({
        type: 'recent-job',
        data: { test: true }
      })
      await updateJob(recentJob.id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      })

      const deletedCount = await cleanupOldJobs(30)
      expect(deletedCount).toBe(1)

      const remainingJobs = await listJobs()
      expect(remainingJobs).toHaveLength(1)
      expect(remainingJobs[0].id).toBe(recentJob.id)
    })

    it('should delete old failed and cancelled jobs', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 35)
      const oldDateStr = oldDate.toISOString()

      // Create old failed job
      const failedJob = await createJob({
        type: 'failed-job',
        data: { test: true }
      })
      await updateJob(failedJob.id, { 
        status: 'failed',
        completed_at: oldDateStr
      })

      // Create old cancelled job
      const cancelledJob = await createJob({
        type: 'cancelled-job',
        data: { test: true }
      })
      await updateJob(cancelledJob.id, { 
        status: 'cancelled',
        completed_at: oldDateStr
      })

      const deletedCount = await cleanupOldJobs(30)
      expect(deletedCount).toBe(2)

      const remainingJobs = await listJobs()
      expect(remainingJobs).toHaveLength(0)
    })

    it('should not delete pending or running jobs', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 35)

      // Create old pending job
      const pendingJob = await createJob({
        type: 'pending-job',
        data: { test: true }
      })
      
      // Manually update created_at to be old
      testDb.sqlite.prepare(
        'UPDATE jobs SET created_at = ? WHERE id = ?'
      ).run(oldDate.toISOString(), pendingJob.id)

      // Create old running job
      const runningJob = await createJob({
        type: 'running-job',
        data: { test: true }
      })
      await updateJob(runningJob.id, { status: 'running' })
      
      const deletedCount = await cleanupOldJobs(30)
      expect(deletedCount).toBe(0)

      const remainingJobs = await listJobs()
      expect(remainingJobs).toHaveLength(2)
    })

    it('should return 0 when no jobs to delete', async () => {
      const job = await createJob({
        type: 'recent-job',
        data: { test: true }
      })
      await updateJob(job.id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      })

      const deletedCount = await cleanupOldJobs(30)
      expect(deletedCount).toBe(0)
    })

    it('should respect custom days parameter', async () => {
      const fiveDaysAgo = new Date()
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
      const fiveDaysAgoStr = fiveDaysAgo.toISOString()

      const oldJob = await createJob({
        type: 'old-job',
        data: { test: true }
      })
      await updateJob(oldJob.id, { 
        status: 'completed',
        completed_at: fiveDaysAgoStr
      })

      const deletedCount = await cleanupOldJobs(3)
      expect(deletedCount).toBe(1)
    })
  })
})