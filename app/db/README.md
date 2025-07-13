# Database Module

This module provides SQLite storage for Claude Code session events using Drizzle ORM.

## Schema

Events are stored with both indexed fields for fast queries and complete JSON data:

```typescript
{
  uuid: string                 // Primary key
  session_id: string          // Session UUID
  event_type: string          // 'user' | 'assistant' | 'summary'
  timestamp: string           // ISO timestamp
  is_sidechain: boolean       // Parallel task execution
  parent_uuid: string | null  // Threading
  cwd: string                 // Full project path
  project_name: string        // Project name for display
  data: JSON                  // Complete event data
  file_path: string           // Source JSONL file
  line_number: number         // Line in JSONL
  synced_at: string          // When we imported it
}
```

## Usage

```typescript
import { getDatabase } from './app/db/database'
import { events } from './app/db/schema'
import { eq } from 'drizzle-orm'

// Get database instance
const db = getDatabase()

// Insert event
db.insert(events).values({
  uuid: 'event-123',
  session_id: 'session-123',
  // ... other fields
}).run()

// Query events
const sessionEvents = db.select()
  .from(events)
  .where(eq(events.session_id, 'session-123'))
  .orderBy(asc(events.timestamp))
  .all()
```

## Testing

```bash
npm test app/db/
```

Tests use in-memory SQLite databases for isolation.