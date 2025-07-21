import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { loader } from '../routes/home'
import { updateSettings } from '../db/settings.service'

describe('Home Route Default Directory', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should return empty sessions array from loader', async () => {
    // Call the loader
    const result = await loader()
    
    // Verify the loader returns empty sessions array
    expect(result.sessions).toEqual([])
  })

  it('should always return empty sessions array regardless of settings', async () => {
    // Set some settings first
    await updateSettings({ defaultDirectory: '~/Documents' })
    
    // Call the loader
    const result = await loader()
    
    // Verify the response is still just empty sessions
    expect(result.sessions).toEqual([])
    expect(Object.keys(result)).toEqual(['sessions'])
  })

  it('should not include any directory information in loader response', async () => {
    // Call the loader
    const result = await loader()
    
    // Verify it only includes sessions array
    expect(result).toEqual({ sessions: [] })
    expect('defaultDirectory' in result).toBe(false)
    expect('currentDirectory' in result).toBe(false)
  })
})