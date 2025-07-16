import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Job Type Registry', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('Job Type Constants', () => {
    it('should provide predefined job type constants', async () => {
      // This test will fail until we implement job type constants
      const { JOB_TYPES } = await import('../workers/job-types')
      
      expect(JOB_TYPES).toBeDefined()
      expect(JOB_TYPES.SESSION_SYNC).toBe('session-sync')
      expect(JOB_TYPES.MAINTENANCE).toBe('maintenance')
      expect(JOB_TYPES.DATABASE_VACUUM).toBe('database-vacuum')
      expect(JOB_TYPES.DATABASE_BACKUP).toBe('database-backup')
    })

    it('should export all job types as an array', async () => {
      // This test will fail until we implement job type collection
      const { JOB_TYPES, ALL_JOB_TYPES } = await import('../workers/job-types')
      
      expect(ALL_JOB_TYPES).toBeDefined()
      expect(Array.isArray(ALL_JOB_TYPES)).toBe(true)
      expect(ALL_JOB_TYPES).toContain(JOB_TYPES.SESSION_SYNC)
      expect(ALL_JOB_TYPES).toContain(JOB_TYPES.MAINTENANCE)
      expect(ALL_JOB_TYPES).toContain(JOB_TYPES.DATABASE_VACUUM)
      expect(ALL_JOB_TYPES).toContain(JOB_TYPES.DATABASE_BACKUP)
    })

    it('should validate job type constants are unique', async () => {
      // This test will fail until we implement validation
      const { ALL_JOB_TYPES } = await import('../workers/job-types')
      
      const uniqueTypes = new Set(ALL_JOB_TYPES)
      expect(uniqueTypes.size).toBe(ALL_JOB_TYPES.length)
    })
  })

  describe('Type-Safe Job Creation Helpers', () => {
    it('should provide type-safe helper for session sync jobs', async () => {
      // This test will fail until we implement job creation helpers
      const { createSessionSyncJob } = await import('../workers/job-types')
      
      const job = createSessionSyncJob({
        sessionId: 'test-session-123',
        lastSyncTime: '2025-01-01T00:00:00Z'
      })
      
      expect(job.type).toBe('session-sync')
      expect(job.data).toEqual({
        sessionId: 'test-session-123',
        lastSyncTime: '2025-01-01T00:00:00Z'
      })
      expect(job.priority).toBe(5) // Medium priority for session sync
    })

    it('should provide type-safe helper for maintenance jobs', async () => {
      // This test will fail until we implement maintenance job helper
      const { createMaintenanceJob } = await import('../workers/job-types')
      
      const job = createMaintenanceJob({
        operation: 'cleanup-old-jobs',
        olderThanDays: 30
      })
      
      expect(job.type).toBe('maintenance')
      expect(job.data).toEqual({
        operation: 'cleanup-old-jobs',
        olderThanDays: 30
      })
      expect(job.priority).toBe(3) // Lower priority for maintenance
    })

    it('should provide type-safe helper for database vacuum jobs', async () => {
      // This test will fail until we implement vacuum job helper
      const { createDatabaseVacuumJob } = await import('../workers/job-types')
      
      const job = createDatabaseVacuumJob()
      
      expect(job.type).toBe('database-vacuum')
      expect(job.data).toEqual({})
      expect(job.priority).toBe(1) // Low priority for vacuum
    })

    it('should provide type-safe helper for database backup jobs', async () => {
      // This test will fail until we implement backup job helper
      const { createDatabaseBackupJob } = await import('../workers/job-types')
      
      const job = createDatabaseBackupJob({
        backupPath: '/backups/memva-backup.db'
      })
      
      expect(job.type).toBe('database-backup')
      expect(job.data).toEqual({
        backupPath: '/backups/memva-backup.db'
      })
      expect(job.priority).toBe(2) // Low priority for backup
    })
  })

  describe('Job Handler Registry', () => {
    it('should register and retrieve job handlers', async () => {
      // This test will fail until we implement job handler registry
      const { JobHandlerRegistry } = await import('../workers/job-types')
      
      const registry = new JobHandlerRegistry()
      
      const testHandler = vi.fn((job, callback) => {
        callback(null, { success: true })
      })
      
      registry.register('test-job', testHandler)
      
      const retrievedHandler = registry.get('test-job')
      expect(retrievedHandler).toBe(testHandler)
    })

    it('should throw error when registering duplicate handler', async () => {
      // This test will fail until we implement duplicate protection
      const { JobHandlerRegistry } = await import('../workers/job-types')
      
      const registry = new JobHandlerRegistry()
      
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      registry.register('test-job', handler1)
      
      expect(() => {
        registry.register('test-job', handler2)
      }).toThrow('Handler for job type "test-job" already registered')
    })

    it('should return undefined for non-existent handler', async () => {
      // This test will fail until we implement handler retrieval
      const { JobHandlerRegistry } = await import('../workers/job-types')
      
      const registry = new JobHandlerRegistry()
      
      const handler = registry.get('non-existent-job')
      expect(handler).toBeUndefined()
    })

    it('should list all registered job types', async () => {
      // This test will fail until we implement handler listing
      const { JobHandlerRegistry } = await import('../workers/job-types')
      
      const registry = new JobHandlerRegistry()
      
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      registry.register('job-type-1', handler1)
      registry.register('job-type-2', handler2)
      
      const registeredTypes = registry.getRegisteredTypes()
      expect(registeredTypes).toEqual(['job-type-1', 'job-type-2'])
    })

    it('should validate handler registration against known job types', async () => {
      // This test will fail until we implement type validation
      const { JobHandlerRegistry } = await import('../workers/job-types')
      
      const registry = new JobHandlerRegistry()
      
      const validHandler = vi.fn()
      const invalidHandler = vi.fn()
      
      // Should succeed for valid job type
      expect(() => {
        registry.register('session-sync', validHandler)
      }).not.toThrow()
      
      // Should warn or throw for unknown job type
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      registry.register('unknown-job-type', invalidHandler)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Warning: Registering handler for unknown job type "unknown-job-type"'
      )
      
      consoleSpy.mockRestore()
    })
  })
})