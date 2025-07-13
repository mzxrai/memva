import { getDb } from './database'

// Export a singleton database instance
export const db = getDb()

// Re-export schema types
export * from './schema'
export { closeDatabase } from './database'