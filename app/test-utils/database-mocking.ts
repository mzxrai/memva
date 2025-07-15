import type { TestDatabase } from './in-memory-db'
import * as schema from '../db/schema'

// Global variable to hold the current test database instance
let currentTestDb: TestDatabase | null = null

/**
 * Properly mock the database modules to use the test database everywhere.
 * This replaces the broken setMockDatabase pattern that caused sync issues.
 * 
 * This utility uses static mocking that works with module loading timing.
 * Call setupDatabaseMocks() in your test file at the module level,
 * then call setTestDatabase() in beforeEach() to set the test database instance.
 */

/**
 * Set up static database mocks. Call this at the module level in your test file.
 * This must be called before any imports that use the database.
 */
export function setupDatabaseMocks(vi: { mock: typeof import('vitest').vi.mock; fn: typeof import('vitest').vi.fn }) {
  // Mock the main database module - need to handle the singleton pattern
  vi.mock('../db/index', () => ({
    get db() {
      if (!currentTestDb) {
        // Return a no-op database during cleanup instead of throwing
        return {
          insert: () => ({ values: () => ({ execute: () => Promise.resolve() }) }),
          select: () => ({ from: () => ({ where: () => ({ all: () => [] }) }) })
        }
      }
      return currentTestDb.db
    },
    // Export the actual schema objects, not from the database instance
    sessions: schema.sessions,
    events: schema.events,
    closeDatabase: vi.fn()
  }))
  
  // Mock the database connection module that provides getDb()
  vi.mock('../db/database', () => ({
    getDb: vi.fn(() => {
      if (!currentTestDb) {
        // Return a no-op database during cleanup instead of throwing
        return {
          insert: () => ({ values: () => ({ execute: () => Promise.resolve() }) }),
          select: () => ({ from: () => ({ where: () => ({ all: () => [] }) }) })
        }
      }
      return currentTestDb.db
    }),
    getDatabase: vi.fn(() => {
      if (!currentTestDb) {
        // Return a no-op database during cleanup instead of throwing
        return {
          insert: () => ({ values: () => ({ execute: () => Promise.resolve() }) }),
          select: () => ({ from: () => ({ where: () => ({ all: () => [] }) }) })
        }
      }
      return currentTestDb.db
    }),
    closeDatabase: vi.fn(),
    resetDatabase: vi.fn()
  }))
}

/**
 * Set the current test database instance. Call this in beforeEach().
 */
export function setTestDatabase(testDb: TestDatabase) {
  currentTestDb = testDb
}

/**
 * Clear the test database instance. Call this in afterEach().
 */
export function clearTestDatabase() {
  currentTestDb = null
}