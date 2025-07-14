import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, afterAll } from 'vitest'
import { db, sessions, events } from '../app/db'
import { closeDatabase } from '../app/db/database'

// Import MSW server setup for API mocking
import '../app/test-utils/msw-server'

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Global cleanup after all tests complete
afterAll(async () => {
  console.log('[Test Cleanup] Clearing test database after all tests...')
  try {
    // Clear all test data (only if database connection is still open)
    await db.delete(events).execute()
    await db.delete(sessions).execute()
    console.log('[Test Cleanup] Test database cleared successfully')
  } catch (error) {
    // Database might already be closed by individual tests, which is fine
    console.log('[Test Cleanup] Database already closed or unavailable (this is normal)')
  } finally {
    // Close database connection
    closeDatabase()
  }
})