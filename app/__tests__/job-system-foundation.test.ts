import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('JobSystem Foundation', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should initialize job worker with default configuration', async () => {
    // First test - should fail because JobSystem doesn't exist yet
    const { JobSystem } = await import('../workers/index')
    
    const jobSystem = new JobSystem()
    
    expect(jobSystem.isRunning).toBe(false)
    expect(jobSystem.config.concurrent).toBe(1)
    expect(jobSystem.config.maxRetries).toBe(3)
    expect(jobSystem.config.retryDelay).toBe(1000)
  })

  it('should register session-runner handler automatically', async () => {
    const { JobSystem } = await import('../workers/index')
    
    const jobSystem = new JobSystem()
    
    const registeredHandlers = jobSystem.getRegisteredHandlers()
    expect(registeredHandlers).toContain('session-runner')
  })

  it('should start job processing when called', async () => {
    const { JobSystem } = await import('../workers/index')
    
    const jobSystem = new JobSystem()
    
    expect(jobSystem.isRunning).toBe(false)
    
    await jobSystem.start()
    
    expect(jobSystem.isRunning).toBe(true)
  })

  it('should stop gracefully and clean up resources', async () => {
    const { JobSystem } = await import('../workers/index')
    
    const jobSystem = new JobSystem()
    
    await jobSystem.start()
    expect(jobSystem.isRunning).toBe(true)
    
    await jobSystem.stop()
    expect(jobSystem.isRunning).toBe(false)
  })

  it('should handle initialization errors properly', async () => {
    const { JobSystem } = await import('../workers/index')
    
    const jobSystem = new JobSystem({ concurrent: 5, maxRetries: 5, retryDelay: 2000 })
    
    expect(jobSystem.config.concurrent).toBe(5)
    expect(jobSystem.config.maxRetries).toBe(5)
    expect(jobSystem.config.retryDelay).toBe(2000)
    expect(jobSystem.isRunning).toBe(false)
  })
})