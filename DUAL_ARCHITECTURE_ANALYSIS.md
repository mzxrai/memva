# Dual Architecture Analysis: Jobs vs SSE in Memva

## Executive Summary

Memva implements a **dual architecture** that combines both job-based processing and Server-Sent Events (SSE) streaming for handling Claude Code interactions. After analyzing the codebase, I've identified that this appears to be an **architectural evolution** where:

1. **Job system** was likely the initial design for background processing
2. **SSE streaming** was added later for real-time Claude Code interactions
3. **Event polling** serves as a fallback and synchronization mechanism

## 1. Job-Based Architecture

### Purpose & Design
The job system is a traditional background processing architecture designed for:
- **Asynchronous task processing** with retry logic
- **Priority-based job queuing** 
- **Concurrent job execution** with configurable limits
- **Persistent job state** with failure handling

### Core Components

#### Job Worker (`app/workers/job-worker.ts`)
- **Polling-based**: Continuously polls database for pending jobs (200ms intervals)
- **Concurrent processing**: Configurable concurrency (default: 1)
- **Retry logic**: Handles failed jobs with retry attempts
- **Handler registry**: Type-safe job handlers for different job types

#### Job Service (`app/db/jobs.service.ts`)
- **CRUD operations**: Create, claim, complete, fail jobs
- **Priority queuing**: Jobs processed by priority (descending) then creation time
- **State management**: pending → running → completed/failed/cancelled
- **Cleanup utilities**: Remove old completed jobs

#### Job Types (`app/workers/job-types.ts`)
Currently defined job types:
- `SESSION_RUNNER` - High priority (8) for user interactions
- `MAINTENANCE` - Medium priority (3) for housekeeping
- `DATABASE_VACUUM` - Low priority (1) for optimization
- `DATABASE_BACKUP` - Low priority (2) for data safety

### Database Schema
```sql
jobs {
  id: string (primary key)
  type: string (job type identifier)
  data: json (job payload)
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: integer (higher = processed first)
  attempts: integer (retry counter)
  max_attempts: integer (retry limit)
  error: string (failure reason)
  result: json (success output)
  scheduled_at: string (delayed execution)
  started_at: string (processing start)
  completed_at: string (processing end)
  created_at: string
  updated_at: string
}
```

## 2. SSE (Server-Sent Events) Architecture

### Purpose & Design
The SSE system provides **real-time streaming** for Claude Code interactions:
- **Live message streaming** from Claude Code to client
- **Event-based communication** with structured message types
- **Real-time progress updates** during Claude processing
- **Immediate user feedback** without polling delays

### Core Components

#### SSE Route (`app/routes/api.claude-code.$sessionId.tsx`)
**GET (loader)**: Basic SSE endpoint (currently minimal)
- Sets proper SSE headers (`text/event-stream`)
- Sends connection heartbeat
- **TODO**: Implement actual event streaming from database

**POST (action)**: Main Claude Code interaction endpoint
- Accepts user prompts via form data
- Creates SSE stream for real-time response
- Integrates with Claude Code SDK
- Handles request cancellation/abort

#### Claude Code Service (`app/services/claude-code.server.ts`)
- **Stream processing**: Handles Claude Code SDK message streams
- **Event storage**: Converts SDK messages to database events
- **Real-time forwarding**: Streams events to client via `onStoredEvent` callback
- **Cancellation handling**: Respects abort signals
- **Session resumption**: Maintains Claude session continuity

#### SSE Hook (`app/hooks/useSSEEvents.ts`)
- **EventSource connection**: Manages browser SSE connection
- **Message parsing**: Handles incoming event data
- **Deduplication**: Prevents duplicate events using UUIDs
- **Connection state**: Tracks connecting/connected/error states
- **Auto-cleanup**: Closes connections on unmount

### SSE Message Flow
```
User Input → POST /api/claude-code/{sessionId} 
         → Store user event in database
         → Stream to Claude Code SDK
         → For each Claude message:
           → Store as event in database  
           → Stream to client via SSE
         → Close stream on completion
```

## 3. Event Storage & Synchronization

### Event Database Schema
```sql
events {
  uuid: string (primary key, globally unique)
  session_id: string (Claude Code session ID)
  event_type: string (message type from Claude)
  timestamp: string (message received time)
  is_sidechain: boolean (related event flag)
  parent_uuid: string (message threading)
  cwd: string (working directory)
  project_name: string (derived from path)
  data: json (full message from Claude Code SDK)
  memva_session_id: string (links to Memva session)
}
```

### Event Service (`app/db/events.service.ts`)
- **Event creation**: Converts Claude Code SDK messages to database events
- **Event storage**: Persists events with UUIDs and relationships
- **Event querying**: Retrieves events by session or time
- **Event grouping**: Groups events by Claude session ID

### Polling as Fallback

#### Event Polling Hook (`app/hooks/useEventPolling.ts`)
- **Backup mechanism**: Polls `/api/session/{sessionId}` every 2 seconds
- **Full event sync**: Fetches complete event list from database
- **Reliability**: Ensures no events are missed if SSE fails
- **Client-side state**: Maintains local event list

#### Session Status Polling (`app/hooks/useSessionStatus.ts`)
- **Session monitoring**: Polls session metadata every 2 seconds
- **Status tracking**: Monitors session state changes
- **Error handling**: Graceful degradation on API failures

## 4. Architecture Interaction & Data Flow

### Current Integration Points

#### Direct SSE Path (Primary)
```
User Input → SSE Stream → Claude Code SDK → Events DB → Client (real-time)
```

#### Polling Path (Fallback)
```
Events DB → Polling API → Client (2-second delay)
```

#### Job System (Unused for Claude Code)
```
Job Creation → Job Queue → Worker Processing → Job Completion
```

### Key Observations

1. **SSE is the primary path** for Claude Code interactions
2. **Jobs are not currently used** for Claude Code processing
3. **Polling provides redundancy** and handles SSE failures
4. **Events are the single source of truth** for conversation state

## 5. Architectural Tensions & Issues

### Current Problems

#### 1. **Dual Complexity**
- Two different patterns for similar async work
- Job system is feature-complete but unused for main use case
- SSE implementation is custom and less robust than job system

#### 2. **Inconsistent Error Handling**
- Jobs have built-in retry logic and error tracking
- SSE streams have basic error handling but no retry
- Polling provides eventual consistency but with delays

#### 3. **Resource Inefficiency**
- Polling creates unnecessary database load
- SSE connections consume server resources
- Job worker polls database even when unused

#### 4. **Limited SSE Implementation**
- GET endpoint is stub (no actual event streaming from DB)
- Only works during active Claude Code interactions
- No historical event streaming capability

### Missing Capabilities

#### 1. **Event Broadcasting**
- SSE only works during active conversations
- No way to stream historical events
- Multiple clients can't sync on same session

#### 2. **Robust Error Recovery**
- SSE failures require full page refresh
- No automatic reconnection logic
- Lost messages during network issues

#### 3. **Background Processing**
- All Claude Code work happens in HTTP request context
- No way to queue/schedule Claude Code interactions
- Long-running operations block HTTP connections

## 6. Recommended Architecture Improvements

### Option A: SSE-First with Job Backup

**Enhance SSE as primary pattern:**
1. **Complete SSE implementation**: Make GET endpoint stream from events table
2. **Add SSE reconnection**: Auto-reconnect with last-event tracking
3. **Use jobs for heavy lifting**: Move Claude Code SDK calls to background jobs
4. **Keep polling for sync**: Reduce frequency, use for consistency checks

**Benefits:**
- Real-time user experience
- Robust background processing
- Graceful degradation
- Maintains current UX

### Option B: Job-First with SSE Notifications

**Move Claude Code to job system:**
1. **User input creates job**: Store prompt as high-priority job
2. **Job worker processes**: Handles Claude Code SDK interaction
3. **SSE streams job progress**: Real-time updates on job status
4. **Events store results**: Final conversation state

**Benefits:**
- Consistent async pattern
- Built-in retry/error handling
- Better resource management
- Scalable architecture

### Option C: Hybrid Event Stream

**Unified event-driven architecture:**
1. **Events as the primary interface**: All interactions create events
2. **Event processors**: Both SSE and jobs consume event streams
3. **Real-time and background**: SSE for immediate feedback, jobs for heavy work
4. **Event sourcing**: Complete audit trail and replay capability

**Benefits:**
- Single source of truth
- Maximum flexibility
- Event sourcing capabilities
- Future-proof design

## 7. Immediate Action Items

### Short Term (Current Sprint)
1. **Document the decision**: Choose between job-first vs SSE-first
2. **Complete SSE GET endpoint**: Enable historical event streaming
3. **Add SSE reconnection logic**: Improve reliability
4. **Reduce polling frequency**: Optimize for performance

### Medium Term (Next 2-3 Sprints)
1. **Implement chosen architecture**: Job-first or enhanced SSE
2. **Add proper error boundaries**: Handle network failures gracefully
3. **Optimize database queries**: Reduce polling overhead
4. **Add connection management**: Handle multiple clients per session

### Long Term (Future Releases)
1. **Event sourcing implementation**: Complete audit trail
2. **Multi-client synchronization**: Real-time collaboration
3. **Background job scheduling**: Delayed/recurring Claude interactions
4. **Performance optimization**: Reduce resource usage

## 8. Technical Debt Assessment

### High Priority
- **Incomplete SSE implementation**: GET endpoint is stub
- **Redundant polling**: Unnecessary when SSE works
- **No error recovery**: SSE failures require manual refresh

### Medium Priority  
- **Unused job infrastructure**: Complex system with no usage
- **Mixed architectural patterns**: Confusing for developers
- **Limited scalability**: SSE connections don't scale well

### Low Priority
- **Code duplication**: Similar logic in polling and SSE
- **Testing complexity**: Two systems to test
- **Documentation gaps**: Architecture decisions unclear

## Conclusion

The current dual architecture represents an **evolution rather than a design**, where SSE was added for real-time capabilities without replacing the job system. While both systems work, they create complexity and inefficiency.

**Recommendation**: Move toward **Option A (SSE-First with Job Backup)** as it:
- Maintains current real-time UX
- Leverages existing job infrastructure for reliability
- Provides clear separation of concerns
- Offers graceful degradation path

The key is to **complete the SSE implementation** while **repurposing jobs** for background tasks that don't require real-time feedback.