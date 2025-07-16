# Background Job Queue Implementation Plan

## Overview
Implement a SQLite-based background job queue using Better Queue for concurrent Claude Code session management.

## TDD Principles
- ✅ **RED**: Write failing test first
- ✅ **GREEN**: Write minimal code to pass
- ✅ **REFACTOR**: Clean up if needed
- ✅ **COMMIT**: After each green + lint/typecheck

## Phase 1: Foundation & Dependencies

### Dependencies
- [x] Install Better Queue dependencies with tests
- [x] Verify dependencies work with existing codebase
- [x] Commit dependency changes

## Phase 2: Database Schema (TDD)

### Jobs Table Schema
- [x] Test: Jobs table should exist and be queryable
- [x] Test: Jobs table should have required fields (id, type, data, status, etc.)
- [x] Test: Jobs table should have proper indexes for performance
- [x] Test: Jobs table should support job priorities and scheduling
- [x] Implementation: Add jobs table to schema
- [x] Implementation: Add jobs table creation to database.ts
- [x] Implementation: Add proper indexes
- [x] Commit: Database schema changes

## Phase 3: Job Service (TDD)

### Core CRUD Operations
- [x] Test: Should create a job with required fields
- [x] Test: Should retrieve a job by ID
- [x] Test: Should update job status and metadata
- [x] Test: Should list jobs with filtering options
- [x] Implementation: Create jobs.service.ts with CRUD operations
- [x] Commit: Basic job service

### Job State Management
- [x] Test: Should claim next available job atomically
- [x] Test: Should handle job completion with results
- [x] Test: Should handle job failures with retry logic
- [x] Test: Should support job cancellation
- [x] Implementation: Add advanced job state operations
- [x] Commit: Job state management

### Job Statistics & Cleanup
- [x] Test: Should provide job queue statistics
- [x] Test: Should cleanup old completed/failed jobs
- [x] Implementation: Add stats and cleanup functions
- [x] Commit: Job statistics and cleanup

## Phase 4: Job Worker (TDD)

### Worker Foundation
- [x] Test: Should initialize worker with Better Queue
- [x] Test: Should register job handlers
- [x] Test: Should start and stop worker gracefully
- [x] Implementation: Create basic JobWorker class
- [x] Commit: Worker foundation

### Job Processing
- [x] Test: Should poll for and claim jobs
- [x] Test: Should execute job handlers with progress tracking
- [x] Test: Should handle job handler errors and retries
- [x] Test: Should support configurable concurrency
- [x] Implementation: Add job processing logic
- [x] Commit: Job processing

### Worker Management
- [x] Test: Should provide worker statistics (via Better Queue getStats)
- [x] Test: Should handle worker shutdown gracefully
- [x] Test: Should support job handler registration at runtime
- [x] Implementation: Add worker management features
- [x] Commit: Worker management

## Phase 5: Job Types & Handlers (TDD) ✅

### Job Type Registry
- [x] Test: Should register and retrieve job handlers
- [x] Test: Should validate job type constants
- [x] Test: Should provide type-safe job creation helpers
- [x] Implementation: Create job-types.ts with registry
- [x] Commit: Job type system

### Session Runner Handler
- [x] Test: Should execute Claude Code SDK calls asynchronously
- [x] Test: Should handle session message processing in background
- [x] Test: Should support multiple concurrent session jobs
- [x] Test: Should handle Claude Code SDK errors and retries
- [x] Implementation: Create session-runner.handler.ts
- [x] Commit: Session runner handler

### Maintenance Handler  
- [x] Test: Should cleanup old jobs
- [x] Test: Should vacuum database
- [x] Test: Should create database backups
- [x] Implementation: Create maintenance.handler.ts
- [x] Commit: Maintenance handler

## Phase 6: API Integration (TDD) ✅

### Jobs API Routes
- [x] Test: POST /api/jobs should create jobs
- [x] Test: GET /api/jobs should list jobs with filters
- [x] Test: GET /api/jobs?action=stats should return statistics
- [x] Test: DELETE /api/jobs should cancel jobs
- [x] Implementation: Create api.jobs.tsx route
- [x] Commit: Jobs API endpoints

### Individual Job API
- [x] Test: GET /api/jobs/:id should retrieve specific job
- [x] Test: PUT /api/jobs/:id should update job
- [x] Test: DELETE /api/jobs/:id should cancel specific job
- [x] Implementation: Create api.jobs.$jobId.tsx route
- [x] Commit: Individual job API

### Route Configuration
- [x] Test: Job API routes should be accessible
- [x] Implementation: Add routes to routes.ts
- [x] Commit: Route configuration

## Phase 7: Real-time Async Session Management (TDD)

### Phase 7a: Complete Job System Foundation ✅
- [x] Test: Should initialize job worker with default configuration
- [x] Test: Should register session-runner handler automatically
- [x] Test: Should start job processing when called
- [x] Test: Should stop gracefully and clean up resources
- [x] Test: Should handle initialization errors properly
- [x] Implementation: Create workers/index.ts with JobSystem class
- [x] Implementation: Auto-register handlers and lifecycle management
- [x] Implementation: Add job system startup to app entry point
- [x] Commit: Job system initialization

### Phase 7b: Database Schema Enhancement ✅
- [x] Test: Should add claude_status column to sessions table
- [x] Test: Should support status values (not_started, processing, waiting_for_input, error, completed)
- [x] Test: Should default to not_started for new sessions
- [x] Test: Should update status through job lifecycle
- [x] Implementation: Create database migration for claude_status column
- [x] Implementation: Update sessions schema and types
- [x] Implementation: Add helper functions for status management
- [x] Commit: Session status tracking schema

### Phase 7c: Background Job Integration ✅
- [x] Test: Should create session and dispatch job from homepage form
- [x] Test: Should set initial status to not_started
- [x] Test: Should redirect to session detail page immediately
- [x] Test: Should dispatch session-runner job with prompt
- [x] Test: Should handle job creation errors gracefully
- [x] Implementation: Modify home.tsx action to use job system
- [x] Implementation: Replace redirect-only with job dispatch + redirect
- [x] Commit: Homepage job dispatch

- [x] Test: Should dispatch job when user submits new prompt in session detail
- [x] Test: Should update session status to processing
- [x] Test: Should handle job submission errors
- [x] Test: Should maintain existing form UX
- [x] Implementation: Modify session detail page to dispatch jobs
- [x] Implementation: Remove direct streaming from session page
- [x] Commit: Session detail job dispatch

### Phase 7d: Database-Driven Session Updates ✅
- [x] Test: Should poll database for new events every 2 seconds
- [x] Test: Should update events list when new events arrive
- [x] Test: Should handle polling errors gracefully
- [x] Test: Should stop polling when component unmounts
- [x] Test: Should show events in real-time as they're stored
- [x] Implementation: Create useEventPolling() hook for session detail
- [x] Implementation: Replace SSE streaming with database polling
- [x] Implementation: Add automatic refresh of events list
- [x] Commit: Database-driven session updates

- [x] Test: Should disable submit button when status is processing
- [x] Test: Should show error message when status is error
- [x] Test: Should enable submit button for ready states
- [x] Test: Should clear error status when new job is submitted
- [x] Implementation: Add status polling to session detail page
- [x] Implementation: Update submit button logic based on status
- [x] Implementation: Add error state display
- [x] Commit: Session status UI integration

### Phase 7e: Real-time Homepage Dashboard
- [x] Test: Should display grey dot for not_started sessions
- [x] Test: Should display green pulsing dot for processing sessions
- [x] Test: Should display green dot + "Needs Input" badge for ready states
- [x] Test: Should display red dot for error sessions
- [x] Test: Should update status indicators in real-time
- [x] Implementation: Create StatusIndicator component with dot + badge
- [x] Implementation: Add status mapping logic (internal → UI display)
- [x] Implementation: Use Linear-inspired design with color usage
- [x] Commit: Homepage status indicators

- [ ] Test: Should show preview of most recent assistant message
- [ ] Test: Should extract meaningful content (skip system messages)
- [ ] Test: Should display 2-3 lines of assistant message
- [ ] Test: Should update carousel when new messages arrive
- [ ] Test: Should handle sessions with no assistant messages gracefully
- [ ] Implementation: Create MessageCarousel component with vertical scrolling
- [ ] Implementation: Add message preview extraction logic
- [ ] Implementation: Implement smooth vertical animation
- [ ] Commit: Assistant message carousel

- [ ] Test: Should establish SSE connection to session updates endpoint
- [ ] Test: Should update session status when jobs change state
- [ ] Test: Should update message previews when new assistant messages arrive
- [ ] Test: Should handle SSE connection errors and reconnection
- [ ] Test: Should efficiently query only changed sessions
- [ ] Implementation: Create /api/session-updates SSE endpoint
- [ ] Implementation: Add session status change broadcasting
- [ ] Implementation: Create useSessionUpdates() hook for homepage
- [ ] Implementation: Add automatic reconnection on SSE failures
- [ ] Commit: Real-time homepage updates

### Phase 7f: Enhanced Job Handler
- [ ] Test: Should set status to processing when Claude Code starts
- [ ] Test: Should set status to waiting_for_input when Claude completes
- [ ] Test: Should set status to error for unrecoverable errors
- [ ] Test: Should reset status to processing when new job starts
- [ ] Test: Should maintain existing event storage patterns
- [ ] Implementation: Enhance session-runner.handler.ts with status updates
- [ ] Implementation: Add status transition logic throughout lifecycle
- [ ] Implementation: Add proper error handling and status reporting
- [ ] Commit: Status-aware session runner

### Phase 7g: Performance & Polish
- [ ] Test: Should query only changed sessions for homepage updates
- [ ] Test: Should efficiently fetch latest assistant messages
- [ ] Test: Should handle large numbers of sessions without performance issues
- [ ] Test: Should minimize database load during polling
- [ ] Implementation: Add database indexes for efficient queries
- [ ] Implementation: Implement change detection for SSE updates
- [ ] Implementation: Optimize polling intervals and query caching
- [ ] Commit: Performance optimization

- [ ] Test: Should handle job system failures gracefully
- [ ] Test: Should recover from database connection issues
- [ ] Test: Should handle SSE connection failures
- [ ] Test: Should show clear error messages to users
- [ ] Test: Should maintain system stability during errors
- [ ] Implementation: Add comprehensive error boundaries
- [ ] Implementation: Implement retry logic for failed operations
- [ ] Implementation: Add user-friendly error messages
- [ ] Commit: Error handling and recovery

## Phase 8: Testing & Validation

### Integration Testing
- [ ] Test: End-to-end job processing workflow
- [ ] Test: Concurrent job processing
- [ ] Test: Job system under load (10-15 sessions)
- [ ] Test: Database consistency during failures
- [ ] Implementation: Comprehensive integration tests
- [ ] Commit: Integration testing

### Performance Validation
- [ ] Test: Job processing performance meets requirements
- [ ] Test: Database operations don't block main thread
- [ ] Test: Memory usage remains stable under load
- [ ] Implementation: Performance optimizations if needed
- [ ] Commit: Performance validation

## Phase 9: Documentation & Deployment

### Documentation
- [ ] Update CLAUDE.md with job system patterns
- [ ] Add job system usage examples
- [ ] Document job handler creation process
- [ ] Commit: Documentation updates

### Final Integration
- [ ] Test: Full system integration with existing app
- [ ] Test: Job system works with npx distribution
- [ ] Verify: All tests pass, linting clean, typecheck passes
- [ ] Commit: Final integration

## Success Criteria
- ✅ 100% test coverage for all job system components
- ✅ All tests passing (unit + integration)
- ✅ TypeScript strict mode compliance
- ✅ No linting errors
- ✅ Handles 10-15 concurrent sessions @ 5 msg/sec
- ✅ Zero external dependencies beyond Better Queue
- ✅ Graceful error handling and recovery
- ✅ Clean commit history with frequent commits

## Technical Architecture

### Real-time Update Flow
1. **Job Processing**: Background jobs update session status in database
2. **Change Detection**: Database triggers detect status/message changes  
3. **SSE Broadcasting**: Changes broadcast to connected homepage clients
4. **UI Updates**: Homepage receives updates and re-renders affected session cards

### Session Status State Machine
```
not_started → processing → (waiting_for_input | error | completed)
```

### Key Components
- **JobSystem**: Manages worker lifecycle and handler registration
- **StatusIndicator**: Session status with dots and badges (grey/green/red)
- **MessageCarousel**: Vertical scrolling preview of assistant messages
- **SessionUpdates**: SSE endpoint for real-time homepage updates
- **useEventPolling**: Hook for database-driven session detail updates
- **useSessionUpdates**: Hook for real-time homepage updates

### Database Schema Additions
```sql
-- Add session status tracking
ALTER TABLE sessions ADD COLUMN claude_status TEXT DEFAULT 'not_started';

-- Add indexes for efficient real-time queries
CREATE INDEX idx_sessions_claude_status ON sessions(claude_status);
CREATE INDEX idx_events_session_type_timestamp ON events(session_id, event_type, timestamp);
```

## Current Status
**Phase**: Phase 7e - Real-time Homepage Dashboard - Status Indicators Complete ✅
**Last Commit**: StatusIndicator component with claude_status display
**Tests**: 374 tests passing (StatusIndicator tests added)
**Next Task**: Phase 7e - Assistant Message Carousel

## Recent Achievements (Since Last Update)
- ✅ **Phase 7a Complete**: JobSystem foundation with auto-registration and lifecycle management
- ✅ **Phase 7b Complete**: claude_status column added to sessions table with proper indexing
- ✅ **Phase 7c Complete**: Background job integration for both homepage and session detail
- ✅ **Phase 7d Complete**: Database-driven session updates with useEventPolling and useSessionStatus hooks
- ✅ **Homepage Job Dispatch**: Session creation now dispatches background jobs with prompts
- ✅ **Session Detail Job Dispatch**: Prompt submissions now use background job processing
- ✅ **Real-time Session Updates**: Database polling every 2 seconds for events and session status
- ✅ **Database Access Standardization**: All direct database access replaced with service layer functions
- ✅ **Service Layer Consolidation**: Duplicate events service consolidated into proper service layer
- ✅ **Pattern Compliance**: All database access violations documented and fixed
- ✅ **Test Suite Health**: All 363 tests passing with clean test output
- ✅ **Code Quality**: Lint and typecheck passing, strict TypeScript compliance maintained

## Demo Goal
Transform app into real-time async session management system:
- Homepage serves as live monitoring dashboard with status indicators
- Background jobs handle all Claude Code processing
- Real-time updates via SSE for session status and message previews
- Database-driven session detail pages with event polling
- Support for 10-15 concurrent sessions running in parallel