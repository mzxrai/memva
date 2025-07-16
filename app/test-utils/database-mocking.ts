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
export function setupDatabaseMocks(vi: typeof import('vitest').vi) {
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
  
  // Mock the database connection module for any remaining references
  vi.mock('../db/database', () => ({
    closeDatabase: vi.fn(),
    resetDatabase: vi.fn()
  }))

  // Mock database service modules to use the test database
  vi.mock('../db/event-session.service', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>
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
        return (associateEventsWithSession as (eventIds: string[], sessionId: string) => Promise<number>)(eventIds, sessionId)
      }),
      getClaudeSessionsForMemvaSession: vi.fn(async (sessionId: string) => {
        if (!currentTestDb) return []
        // Use the actual implementation but with test database
        const { getClaudeSessionsForMemvaSession } = actual
        return (getClaudeSessionsForMemvaSession as (sessionId: string) => Promise<unknown[]>)(sessionId)
      })
    }
  })

  // Mock sessions service to use test database
  vi.mock('../db/sessions.service', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>
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
        return (updateSession as (sessionId: string, updates: Record<string, unknown>) => Promise<string>)(sessionId, updates)
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