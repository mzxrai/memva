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

  it('should return defaultDirectory from settings in loader', async () => {
    const testDirectory = '~/Documents/projects'
    
    // Set default directory in settings
    await updateSettings({ defaultDirectory: testDirectory })
    
    // Call the loader
    const result = await loader()
    
    // Verify the loader returns the default directory
    expect(result.defaultDirectory).toBe(testDirectory)
  })

  it('should return empty sessions array and undefined defaultDirectory when not set', async () => {
    // Call the loader without setting defaultDirectory
    const result = await loader()
    
    // Verify the response
    expect(result.sessions).toEqual([])
    expect(result.defaultDirectory).toBeUndefined()
  })

  it('should return current working directory as fallback when defaultDirectory is not set', async () => {
    // Call the loader without setting defaultDirectory
    const result = await loader()
    
    // Verify it includes the current working directory as fallback
    expect(result.currentDirectory).toBe(process.cwd())
  })
})