import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Maintenance Job Scheduling', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should create a maintenance job for permission cleanup', async () => {
    const { createMaintenanceJob } = await import('../workers/job-types')
    const { createJob } = await import('../db/jobs.service')
    
    const jobInput = createMaintenanceJob({
      operation: 'cleanup-expired-permissions'
    })
    
    expect(jobInput.type).toBe('maintenance')
    expect(jobInput.data.operation).toBe('cleanup-expired-permissions')
    expect(jobInput.priority).toBe(3) // Low priority for maintenance
    
    // Create the job in the database
    const job = await createJob(jobInput)
    
    expect(job.type).toBe('maintenance')
    expect(job.data).toEqual({
      operation: 'cleanup-expired-permissions'
    })
    expect(job.status).toBe('pending')
    expect(job.priority).toBe(3)
  })

  it('should schedule periodic permission cleanup', async () => {
    const { createJob, listJobs } = await import('../db/jobs.service')
    const { createMaintenanceJob } = await import('../workers/job-types')
    
    // Schedule a permission cleanup job
    const jobInput = createMaintenanceJob({
      operation: 'cleanup-expired-permissions'
    })
    
    await createJob({
      ...jobInput,
      scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
    })
    
    // Check that the job was created with scheduling
    const jobs = await listJobs({ status: 'pending' })
    const cleanupJob = jobs.find(j => 
      j.type === 'maintenance' && 
      j.data.operation === 'cleanup-expired-permissions'
    )
    
    expect(cleanupJob).toBeDefined()
    expect(cleanupJob?.scheduled_at).toBeTruthy()
  })

  it('should handle multiple maintenance operations in queue', async () => {
    const { createJob, listJobs } = await import('../db/jobs.service')
    const { createMaintenanceJob } = await import('../workers/job-types')
    
    // Create multiple maintenance jobs
    await createJob(createMaintenanceJob({
      operation: 'cleanup-old-jobs',
      olderThanDays: 7
    }))
    
    await createJob(createMaintenanceJob({
      operation: 'cleanup-expired-permissions'
    }))
    
    await createJob(createMaintenanceJob({
      operation: 'vacuum-database'
    }))
    
    const maintenanceJobs = await listJobs({ type: 'maintenance' })
    
    expect(maintenanceJobs).toHaveLength(3)
    expect(maintenanceJobs.map(j => j.data.operation)).toContain('cleanup-expired-permissions')
  })
})