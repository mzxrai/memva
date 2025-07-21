import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { getSettings, updateSettings } from '../db/settings.service'

describe('Default Directory Settings', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should store and retrieve default directory from settings', async () => {
    const testDirectory = '/Users/test/projects'
    
    // Update settings with default directory
    await updateSettings({ defaultDirectory: testDirectory })
    
    // Retrieve settings and verify default directory is stored
    const settings = await getSettings()
    expect(settings.defaultDirectory).toBe(testDirectory)
  })

  it('should return undefined for defaultDirectory when not set', async () => {
    // Get settings without setting defaultDirectory
    const settings = await getSettings()
    expect(settings.defaultDirectory).toBeUndefined()
  })

  it('should update defaultDirectory without affecting other settings', async () => {
    // Set initial settings
    await updateSettings({ maxTurns: 100, permissionMode: 'plan' })
    
    // Update only defaultDirectory
    await updateSettings({ defaultDirectory: '~/Documents/code' })
    
    // Verify all settings are preserved
    const settings = await getSettings()
    expect(settings.maxTurns).toBe(100)
    expect(settings.permissionMode).toBe('plan')
    expect(settings.defaultDirectory).toBe('~/Documents/code')
  })
})