# Sync Service Design for Claude Code Session Manager

## Architecture Overview

Based on my analysis, I recommend implementing a **dedicated sync service using Worker Threads** with the following architecture:

1. **Main Process**: React Router app (UI and API routes)
2. **Worker Thread**: File watching and sync service
3. **SQLite Database**: With WAL mode enabled for concurrent access
4. **Communication**: Worker thread communicates with main process via message passing

## Implementation Plan

### 1. File Watching Strategy

- **Primary**: Use `chokidar` for cross-platform file watching
  - Leverages FSEvents on macOS for optimal performance
  - Handles large directories efficiently
  - Built-in debouncing and stability detection
- **Configuration**:
  ```typescript
  {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    },
    atomic: true // Handle atomic writes
  }
  ```

### 2. Sync Service Architecture (`app/services/sync-worker.ts`)

```typescript
// Worker thread that runs independently
- Watch ~/.claude/projects/*/*.jsonl files
- Track file positions for incremental reading
- Parse JSONL events line by line
- Batch insert into SQLite database
- Handle file rotations and deletions
```

### 3. Incremental Sync Strategy

- **File Position Tracking**: Store last read position per file in a metadata table
- **Line-by-Line Processing**: Use readline module for memory-efficient JSONL parsing
- **Batch Operations**: Accumulate events and insert in batches of 100-1000
- **Checkpointing**: Update file position after successful batch insert

### 4. Database Enhancements

```sql
-- Add sync metadata table
CREATE TABLE sync_metadata (
  file_path TEXT PRIMARY KEY,
  last_position INTEGER NOT NULL DEFAULT 0,
  last_modified TEXT NOT NULL,
  last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add composite index for efficient queries
CREATE INDEX idx_session_timestamp ON events(session_id, timestamp);
```

### 5. Concurrency & Locking Strategy

- **File Access**: Use `proper-lockfile` for coordinating access to JSONL files
- **Database**: SQLite WAL mode handles concurrent readers/writers
- **Worker Thread**: Single sync worker to avoid race conditions
- **Retry Logic**: Exponential backoff for locked files

### 6. Error Handling & Recovery

- **Graceful Degradation**: Continue syncing other files if one fails
- **Checkpoint Recovery**: Resume from last successful position
- **Validation**: Verify event UUIDs to prevent duplicates
- **Health Monitoring**: Track sync status and last successful sync time

### 7. Performance Optimizations

- **Debouncing**: Wait 500ms after file changes before syncing
- **Selective Watching**: Only watch active session directories
- **Memory Management**: Process files in chunks, not loading entire files
- **Index Usage**: Leverage SQLite indexes for fast duplicate checking

### 8. Integration with React App

- **Status API**: Expose sync status via API route
- **Real-time Updates**: Use Server-Sent Events for live UI updates
- **Manual Sync**: Provide UI button to trigger immediate sync
- **Settings**: Allow users to configure sync frequency and paths

## File Structure

```
app/
├── services/
│   ├── sync-worker.ts        # Worker thread implementation
│   ├── sync-service.ts       # Main thread sync service interface
│   └── sync-service.test.ts  # TDD tests
├── db/
│   ├── sync-metadata.ts      # Sync metadata schema
│   └── migrations/           # Database migrations
└── routes/
    └── api.sync-status.ts    # API route for sync status
```

## Testing Strategy

1. **Unit Tests**: Test JSONL parsing, batch processing, error handling
2. **Integration Tests**: Test file watching with temp directories
3. **E2E Tests**: Verify complete sync flow from file changes to UI updates

## Implementation Order

1. Create sync metadata table and schema
2. Implement basic JSONL parser with position tracking
3. Create worker thread infrastructure
4. Add file watching with chokidar
5. Implement batch processing and database operations
6. Add error handling and recovery
7. Create API routes for status monitoring
8. Add UI integration with real-time updates

## Key Design Decisions

### Why Worker Threads?
- Non-blocking file I/O operations
- Isolated from main UI thread
- Better error containment
- Can be terminated/restarted without affecting UI

### Why Incremental Sync?
- JSONL files can grow large (100MB+)
- Append-only nature of JSONL makes incremental reads efficient
- Reduces memory usage and CPU load
- Faster sync cycles for active sessions

### Why Chokidar?
- Battle-tested file watching library
- Native FSEvents support on macOS
- Handles edge cases (atomic writes, file rotations)
- Built-in stability detection

### Why SQLite with WAL Mode?
- Concurrent reads while writing
- Better performance for our read-heavy workload
- Crash resistance
- No separate database server needed

## Performance Targets

- Initial sync: < 5 seconds for 100MB of JSONL data
- Incremental sync: < 100ms for new events
- Memory usage: < 50MB for the sync worker
- CPU usage: < 5% during idle watching

## Future Enhancements

1. **Compression**: Store compressed event data for older sessions
2. **Archival**: Move old sessions to separate archive database
3. **Search Index**: Full-text search using SQLite FTS5
4. **Export**: Generate reports and exports from synced data
5. **Multi-user**: Support for team environments with shared sessions

This design provides a robust foundation for syncing Claude Code sessions while maintaining good performance and user experience.