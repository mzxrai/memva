# Database Module

This module provides SQLite storage for Claude Code session events and background job processing using Drizzle ORM.

## Architecture

The database layer follows a **service layer pattern** to maintain clean separation of concerns:

- **Schema Layer** (`schema.ts`): Defines database tables and types
- **Database Layer** (`database.ts`, `index.ts`): Manages connections and provides singleton access
- **Service Layer** (`*.service.ts`): Business logic and data access functions
- **Route Layer**: Uses service functions, never direct database access

## Schema

### Events
Events are stored with both indexed fields for fast queries and complete JSON data:

```typescript
{
  uuid: string                 // Primary key
  session_id: string          // Session UUID
  event_type: string          // 'user' | 'assistant' | 'system' | 'result'
  timestamp: string           // ISO timestamp
  is_sidechain: boolean       // Parallel task execution
  parent_uuid: string | null  // Threading
  cwd: string                 // Full project path
  project_name: string        // Project name for display
  data: JSON                  // Complete event data
  memva_session_id: string    // Associated Memva session
}
```

### Sessions
Session management for Claude Code interactions:

```typescript
{
  id: string                  // Primary key
  title: string | null        // Optional session title
  created_at: string          // ISO timestamp
  updated_at: string          // ISO timestamp
  status: string              // 'active' | 'completed' | 'error'
  project_path: string        // Full project path
  metadata: JSON | null       // Additional session data
  claude_status: string       // 'not_started' | 'processing' | 'completed' | 'error'
}
```

### Jobs
Background job processing:

```typescript
{
  id: string                  // Primary key
  type: string                // Job type identifier
  data: JSON                  // Job payload
  status: string              // 'pending' | 'processing' | 'completed' | 'failed'
  priority: number            // Priority level (higher = more urgent)
  attempts: number            // Current attempt count
  max_attempts: number        // Maximum retry attempts
  error: string | null        // Error message if failed
  result: string | null       // Job result if completed
  scheduled_at: string        // When job should run
  started_at: string | null   // When job started processing
  completed_at: string | null // When job completed
  created_at: string          // ISO timestamp
  updated_at: string          // ISO timestamp
}
```

## Usage Patterns

### ✅ CORRECT: Use Service Layer

Always use service functions for database operations:

```typescript
// Sessions
import { createSession, getSession, updateSession } from './sessions.service'

const session = await createSession({ title: 'My Session', project_path: '/path' })
const retrieved = await getSession(session.id)
await updateSession(session.id, { status: 'completed' })

// Events
import { getEventsForSession, associateEventsWithSession } from './event-session.service'

const events = await getEventsForSession(sessionId)
await associateEventsWithSession(eventIds, sessionId)

// Jobs
import { createJob, getNextJob, updateJobStatus } from './jobs.service'

const job = await createJob('claude-code-session', { sessionId: 'abc123' })
const nextJob = await getNextJob()
await updateJobStatus(job.id, 'completed')
```

### ❌ PROHIBITED: Direct Database Access

Never import or use the database instance directly in routes or business logic:

```typescript
// ❌ WRONG - Direct database access
import { db } from './db/index'
import { sessions } from './db/schema'
import { eq } from 'drizzle-orm'

const session = db.select().from(sessions).where(eq(sessions.id, id)).get()

// ❌ WRONG - Getting database instance
import { getDatabase } from './db/database'
const db = getDatabase()
```

### Service Layer Guidelines

- **Pure functions**: Service functions should be stateless and predictable
- **Error handling**: Use proper error types and meaningful messages
- **Type safety**: Use schema-inferred types from Drizzle
- **Single responsibility**: Each service handles one domain

```typescript
// Example service function
export async function createSession(data: CreateSessionRequest): Promise<Session> {
  const session = {
    id: crypto.randomUUID(),
    title: data.title || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    project_path: data.project_path,
    metadata: data.metadata || null,
    claude_status: 'not_started'
  }

  db.insert(sessions).values(session).run()
  return session
}
```

## Testing

```bash
npm test app/db/
```

Tests use in-memory SQLite databases for isolation and follow the same service layer pattern:

- **Database tests**: Test service functions directly
- **Integration tests**: Test complete workflows through service layer
- **Component tests**: Use mocked service functions

### Test Database Setup

```typescript
import { setupInMemoryDb } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase } from '../test-utils/database-mocking'

// Static mocks (at module level)
setupDatabaseMocks(vi)

// Test setup
beforeEach(() => {
  const testDb = setupInMemoryDb()
  setTestDatabase(testDb)
})
```