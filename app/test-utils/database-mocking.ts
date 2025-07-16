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
          select: () => ({ 
            from: () => ({ 
              where: () => ({ 
                orderBy: () => ({ 
                  limit: () => ({ 
                    execute: () => Promise.resolve([])
                  })
                }),
                all: () => [] 
              })
            })
          })
        }
      }
      return currentTestDb.db
    },
    // Export the actual schema objects, not from the database instance
    sessions: schema.sessions,
    events: schema.events,
    jobs: schema.jobs,
    closeDatabase: vi.fn()
  }))
  
  // Mock the database connection module that provides getDb()
  vi.mock('../db/database', () => ({
    getDb: vi.fn(() => {
      if (!currentTestDb) {
        // Return a no-op database during cleanup instead of throwing
        return {
          insert: () => ({ values: () => ({ execute: () => Promise.resolve() }) }),
          select: () => ({ 
            from: () => ({ 
              where: () => ({ 
                orderBy: () => ({ 
                  limit: () => ({ 
                    execute: () => Promise.resolve([])
                  })
                }),
                all: () => [] 
              })
            })
          })
        }
      }
      return currentTestDb.db
    }),
    getDatabase: vi.fn(() => {
      if (!currentTestDb) {
        // Return a no-op database during cleanup instead of throwing
        return {
          insert: () => ({ values: () => ({ execute: () => Promise.resolve() }) }),
          select: () => ({ 
            from: () => ({ 
              where: () => ({ 
                orderBy: () => ({ 
                  limit: () => ({ 
                    execute: () => Promise.resolve([])
                  })
                }),
                all: () => [] 
              })
            })
          })
        }
      }
      return currentTestDb.db
    }),
    closeDatabase: vi.fn(),
    resetDatabase: vi.fn()
  }))

  // Mock database service modules to use the test database
  vi.mock('../db/event-session.service', async () => {
    const actual = await vi.importActual('../db/event-session.service') as Record<string, unknown>
    return {
      ...actual,
      getEventsForSession: vi.fn(async (sessionId: string) => {
        if (!currentTestDb) return []
        return currentTestDb.getEventsForSession(sessionId)
      }),
      associateEventsWithSession: vi.fn(async (eventIds: string[], sessionId: string) => {
        if (!currentTestDb) return 0
        // Use the actual implementation but with test database
        const { associateEventsWithSession } = actual
        return associateEventsWithSession(eventIds, sessionId)
      }),
      getClaudeSessionsForMemvaSession: vi.fn(async (sessionId: string) => {
        if (!currentTestDb) return []
        // Use the actual implementation but with test database
        const { getClaudeSessionsForMemvaSession } = actual
        return getClaudeSessionsForMemvaSession(sessionId)
      })
    }
  })

  // Mock sessions service to use test database
  vi.mock('../db/sessions.service', async () => {
    const actual = await vi.importActual('../db/sessions.service') as Record<string, unknown>
    return {
      ...actual,
      getSession: vi.fn(async (sessionId: string) => {
        if (!currentTestDb) return null
        return currentTestDb.getSession(sessionId)
      }),
      createSession: vi.fn(async (sessionData: Record<string, unknown>) => {
        if (!currentTestDb) return sessionData
        return currentTestDb.createSession(sessionData as Parameters<typeof currentTestDb.createSession>[0])
      }),
      updateSession: vi.fn(async (sessionId: string, updates: Record<string, unknown>) => {
        if (!currentTestDb) return sessionId
        // Use the actual implementation but with test database
        const { updateSession } = actual
        return updateSession(sessionId, updates)
      })
    }
  })
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