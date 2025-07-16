import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Jobs Table Schema', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should have a jobs table that exists and is queryable', () => {
    // This test will fail until we add the jobs table to the schema
    expect(() => {
      testDb.sqlite.prepare('SELECT * FROM jobs LIMIT 1').all()
    }).not.toThrow()
  })

  it('should have required fields in jobs table', () => {
    // This test will fail until we add all required fields
    const tableInfo = testDb.sqlite.prepare('PRAGMA table_info(jobs)').all() as Array<{
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: string | null
      pk: number
    }>

    const columnNames = tableInfo.map(col => col.name)
    
    // Required fields for job queue functionality
    expect(columnNames).toContain('id')
    expect(columnNames).toContain('type')
    expect(columnNames).toContain('data')
    expect(columnNames).toContain('status')
    expect(columnNames).toContain('priority')
    expect(columnNames).toContain('attempts')
    expect(columnNames).toContain('max_attempts')
    expect(columnNames).toContain('error')
    expect(columnNames).toContain('result')
    expect(columnNames).toContain('scheduled_at')
    expect(columnNames).toContain('started_at')
    expect(columnNames).toContain('completed_at')
    expect(columnNames).toContain('created_at')
    expect(columnNames).toContain('updated_at')
  })

  it('should have proper field types and constraints', () => {
    // This test will fail until we set proper field types
    const tableInfo = testDb.sqlite.prepare('PRAGMA table_info(jobs)').all() as Array<{
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: string | null
      pk: number
    }>

    const getColumn = (name: string) => tableInfo.find(col => col.name === name)

    // Primary key
    const idCol = getColumn('id')
    expect(idCol?.pk).toBe(1)
    expect(idCol?.type).toBe('TEXT')

    // Required fields should be NOT NULL
    const typeCol = getColumn('type')
    expect(typeCol?.notnull).toBe(1)
    expect(typeCol?.type).toBe('TEXT')

    const dataCol = getColumn('data')
    expect(dataCol?.notnull).toBe(1)
    expect(dataCol?.type).toBe('TEXT')

    const statusCol = getColumn('status')
    expect(statusCol?.notnull).toBe(1)
    expect(statusCol?.type).toBe('TEXT')

    const createdAtCol = getColumn('created_at')
    expect(createdAtCol?.notnull).toBe(1)
    expect(createdAtCol?.type).toBe('TEXT')

    const updatedAtCol = getColumn('updated_at')
    expect(updatedAtCol?.notnull).toBe(1)
    expect(updatedAtCol?.type).toBe('TEXT')
  })

  it('should have proper indexes for performance', () => {
    // This test will fail until we add proper indexes
    const indexes = testDb.sqlite.prepare(`
      SELECT name, sql FROM sqlite_master 
      WHERE type = 'index' AND tbl_name = 'jobs'
      AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string; sql: string }>

    const indexNames = indexes.map(idx => idx.name)

    // Expected indexes for job queue performance
    expect(indexNames).toContain('idx_jobs_status')
    expect(indexNames).toContain('idx_jobs_type')
    expect(indexNames).toContain('idx_jobs_priority_created')
    expect(indexNames).toContain('idx_jobs_scheduled_at')
    expect(indexNames).toContain('idx_jobs_status_priority')
  })
})