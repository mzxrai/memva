import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockJob, createMockNewJob } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Jobs Service CRUD Operations', () => {
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
    it('should create a job with required fields', async () => {
      // This test will fail until we implement createJob
      const { createJob } = await import('../db/jobs.service')
      
      const jobData = createMockNewJob({
        type: 'test-job',
        data: { message: 'hello world' }
      })

      const job = await createJob(jobData)

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
      expect(job.type).toBe('test-job')
      expect(job.data).toEqual({ message: 'hello world' })
      expect(job.status).toBe('pending')
      expect(job.priority).toBe(5) // Factory default is 5, not 0
      expect(job.attempts).toBe(0)
      expect(job.max_attempts).toBe(3)
      expect(job.created_at).toBeDefined()
      expect(job.updated_at).toBeDefined()
    })

    it('should create a job with custom priority and max_attempts', async () => {
      // This test will fail until we implement createJob with options
      const { createJob } = await import('../db/jobs.service')
      
      const jobData = createMockNewJob({
        type: 'priority-job',
        data: { priority: 'high' },
        priority: 10,
        max_attempts: 5
      })

      const job = await createJob(jobData)

      expect(job.priority).toBe(10)
      expect(job.max_attempts).toBe(5)
    })

    it('should create a job with scheduled_at timestamp', async () => {
      // This test will fail until we implement scheduling
      const { createJob } = await import('../db/jobs.service')
      
      const scheduledAt = new Date(Date.now() + 60000).toISOString() // 1 minute from now
      const jobData = createMockNewJob({
        type: 'scheduled-job',
        data: { task: 'future task' },
        scheduled_at: scheduledAt
      })

      const job = await createJob(jobData)

      expect(job.scheduled_at).toBe(scheduledAt)
    })
  })

  describe('getJob', () => {
    it('should retrieve a job by ID', async () => {
      // This test will fail until we implement getJob
      const { createJob, getJob } = await import('../db/jobs.service')
      
      const jobData = createMockNewJob({
        type: 'test-job',
        data: { message: 'test' }
      })

      const createdJob = await createJob(jobData)
      const retrievedJob = await getJob(createdJob.id)

      expect(retrievedJob).toBeDefined()
      expect(retrievedJob?.id).toBe(createdJob.id)
      expect(retrievedJob?.type).toBe('test-job')
      expect(retrievedJob?.data).toEqual({ message: 'test' })
    })

    it('should return null for non-existent job ID', async () => {
      // This test will fail until we implement getJob
      const { getJob } = await import('../db/jobs.service')
      
      const result = await getJob('non-existent-id')
      
      expect(result).toBeNull()
    })
  })

  describe('updateJob', () => {
    it('should update job status and metadata', async () => {
      // This test will fail until we implement updateJob
      const { createJob, updateJob, getJob } = await import('../db/jobs.service')
      
      const jobData = createMockNewJob({
        type: 'test-job',
        data: { message: 'test' }
      })

      const createdJob = await createJob(jobData)
      
      const updateData = {
        status: 'running' as const,
        started_at: new Date().toISOString(),
        attempts: 1
      }

      const updatedJob = await updateJob(createdJob.id, updateData)

      expect(updatedJob).toBeDefined()
      expect(updatedJob?.status).toBe('running')
      expect(updatedJob?.started_at).toBe(updateData.started_at)
      expect(updatedJob?.attempts).toBe(1)

      // Verify the update persisted
      const retrievedJob = await getJob(createdJob.id)
      expect(retrievedJob?.status).toBe('running')
    })

    it('should return null for non-existent job ID', async () => {
      // This test will fail until we implement updateJob
      const { updateJob } = await import('../db/jobs.service')
      
      const result = await updateJob('non-existent-id', { status: 'running' as const })
      
      expect(result).toBeNull()
    })
  })

  describe('listJobs', () => {
    it('should list all jobs with no filters', async () => {
      // This test will fail until we implement listJobs
      const { createJob, listJobs } = await import('../db/jobs.service')
      
      await createJob({ type: 'job1', data: { test: 1 } })
      await createJob({ type: 'job2', data: { test: 2 } })
      await createJob({ type: 'job3', data: { test: 3 } })

      const jobs = await listJobs()

      expect(jobs).toHaveLength(3)
      expect(jobs.map(j => j.type)).toContain('job1')
      expect(jobs.map(j => j.type)).toContain('job2')
      expect(jobs.map(j => j.type)).toContain('job3')
    })

    it('should filter jobs by status', async () => {
      // This test will fail until we implement filtering
      const { createJob, updateJob, listJobs } = await import('../db/jobs.service')
      
      const job1 = await createJob({ type: 'job1', data: { test: 1 } })
      const job2 = await createJob({ type: 'job2', data: { test: 2 } })
      await createJob({ type: 'job3', data: { test: 3 } })

      // Update one job to running status
      await updateJob(job1.id, { status: 'running' as const })
      await updateJob(job2.id, { status: 'completed' as const })

      const pendingJobs = await listJobs({ status: 'pending' })
      const runningJobs = await listJobs({ status: 'running' })

      expect(pendingJobs).toHaveLength(1)
      expect(pendingJobs[0].type).toBe('job3')
      
      expect(runningJobs).toHaveLength(1)
      expect(runningJobs[0].type).toBe('job1')
    })

    it('should limit results when limit specified', async () => {
      // This test will fail until we implement limiting
      const { createJob, listJobs } = await import('../db/jobs.service')
      
      await createJob({ type: 'job1', data: { test: 1 } })
      await createJob({ type: 'job2', data: { test: 2 } })
      await createJob({ type: 'job3', data: { test: 3 } })

      const jobs = await listJobs({ limit: 2 })

      expect(jobs).toHaveLength(2)
    })
  })
})