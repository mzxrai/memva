import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { getSettings, updateSettings } from './settings.service'
import { PERMISSION_MODES } from '../types/settings'

describe('Settings Service', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should return default settings when no settings exist', async () => {
    const settings = await getSettings()
    
    expect(settings).toEqual({
      maxTurns: 200,
      permissionMode: 'acceptEdits'
    })
  })

  it('should create default settings on first access', async () => {
    // First access creates defaults
    await getSettings()
    
    // Check database directly
    const result = testDb.db.select().from(testDb.schema.settings).get()
    expect(result).toBeTruthy()
    expect(result?.id).toBe('singleton')
    expect(result?.config).toEqual({
      maxTurns: 200,
      permissionMode: 'acceptEdits'
    })
  })

  it('should update settings correctly', async () => {
    // Create initial settings
    await getSettings()
    
    // Update settings
    await updateSettings({
      maxTurns: 300,
      permissionMode: 'plan'
    })
    
    // Verify update
    const updated = await getSettings()
    expect(updated).toEqual({
      maxTurns: 300,
      permissionMode: 'plan'
    })
  })

  it('should merge partial updates with existing settings', async () => {
    // Create initial settings
    await getSettings()
    
    // Update only maxTurns
    await updateSettings({ maxTurns: 150 })
    
    let settings = await getSettings()
    expect(settings.maxTurns).toBe(150)
    expect(settings.permissionMode).toBe('acceptEdits')
    
    // Update only permissionMode
    await updateSettings({ permissionMode: 'plan' })
    
    settings = await getSettings()
    expect(settings.maxTurns).toBe(150)
    expect(settings.permissionMode).toBe('plan')
  })

  it('should validate maxTurns range', async () => {
    await getSettings()
    
    // Test below minimum
    await expect(updateSettings({ maxTurns: 0 })).rejects.toThrow('maxTurns must be between 1 and 1000')
    
    // Test above maximum
    await expect(updateSettings({ maxTurns: 1001 })).rejects.toThrow('maxTurns must be between 1 and 1000')
    
    // Verify settings unchanged
    const settings = await getSettings()
    expect(settings.maxTurns).toBe(200)
  })

  it('should validate permission mode values', async () => {
    await getSettings()
    
    // Test invalid permission mode
    await expect(updateSettings({ permissionMode: 'invalid' as any })).rejects.toThrow('Invalid permission mode: invalid')
    
    // Verify settings unchanged
    const settings = await getSettings()
    expect(settings.permissionMode).toBe('acceptEdits')
  })

  it('should accept all valid permission modes', async () => {
    await getSettings()
    
    const validModes = PERMISSION_MODES
    
    for (const mode of validModes) {
      await updateSettings({ permissionMode: mode })
      const settings = await getSettings()
      expect(settings.permissionMode).toBe(mode)
    }
  })

  it('should update timestamps when settings change', async () => {
    await getSettings()
    
    // Get initial timestamps
    const initial = testDb.db.select().from(testDb.schema.settings).get()
    const initialUpdatedAt = initial?.updated_at
    expect(initialUpdatedAt).toBeTruthy()
    
    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Update settings
    await updateSettings({ maxTurns: 500 })
    
    // Check updated timestamp
    const updated = testDb.db.select().from(testDb.schema.settings).get()
    expect(updated).toBeTruthy()
    expect(updated?.updated_at).toBeTruthy()
    expect(updated?.updated_at).not.toBe(initialUpdatedAt)
    
    // Verify the timestamp actually changed (string comparison is sufficient)
    if (updated?.updated_at && initialUpdatedAt) {
      expect(updated.updated_at > initialUpdatedAt).toBe(true)
    } else {
      throw new Error('Timestamps should not be null')
    }
  })
})