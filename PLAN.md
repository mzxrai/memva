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
- [ ] Test: Should initialize worker with Better Queue
- [ ] Test: Should register job handlers
- [ ] Test: Should start and stop worker gracefully
- [ ] Implementation: Create basic JobWorker class
- [ ] Commit: Worker foundation

### Job Processing
- [ ] Test: Should poll for and claim jobs
- [ ] Test: Should execute job handlers with progress tracking
- [ ] Test: Should handle job handler errors and retries
- [ ] Test: Should support configurable concurrency
- [ ] Implementation: Add job processing logic
- [ ] Commit: Job processing

### Worker Management
- [ ] Test: Should provide worker statistics
- [ ] Test: Should handle worker shutdown gracefully
- [ ] Test: Should support job handler registration at runtime
- [ ] Implementation: Add worker management features
- [ ] Commit: Worker management

## Phase 5: Job Types & Handlers (TDD)

### Job Type Registry
- [ ] Test: Should register and retrieve job handlers
- [ ] Test: Should validate job type constants
- [ ] Test: Should provide type-safe job creation helpers
- [ ] Implementation: Create job-types.ts with registry
- [ ] Commit: Job type system

### Session Sync Handler
- [ ] Test: Should sync Claude Code JSONL files
- [ ] Test: Should handle incremental sync with timestamps
- [ ] Test: Should update session metadata after sync
- [ ] Test: Should handle missing or corrupted JSONL files
- [ ] Implementation: Create session-sync.handler.ts
- [ ] Commit: Session sync handler

### Maintenance Handler  
- [ ] Test: Should cleanup old jobs
- [ ] Test: Should vacuum database
- [ ] Test: Should create database backups
- [ ] Implementation: Create maintenance.handler.ts
- [ ] Commit: Maintenance handler

## Phase 6: API Integration (TDD)

### Jobs API Routes
- [ ] Test: POST /api/jobs should create jobs
- [ ] Test: GET /api/jobs should list jobs with filters
- [ ] Test: GET /api/jobs?action=stats should return statistics
- [ ] Test: DELETE /api/jobs should cancel jobs
- [ ] Implementation: Create api.jobs.tsx route
- [ ] Commit: Jobs API endpoints

### Individual Job API
- [ ] Test: GET /api/jobs/:id should retrieve specific job
- [ ] Test: PUT /api/jobs/:id should update job
- [ ] Test: DELETE /api/jobs/:id should cancel specific job
- [ ] Implementation: Create api.jobs.$jobId.tsx route
- [ ] Commit: Individual job API

### Route Configuration
- [ ] Test: Job API routes should be accessible
- [ ] Implementation: Add routes to routes.ts
- [ ] Commit: Route configuration

## Phase 7: System Integration (TDD)

### Job System Initialization
- [ ] Test: Should initialize job system with default handlers
- [ ] Test: Should start job system and begin processing
- [ ] Test: Should stop job system gracefully
- [ ] Implementation: Create workers/index.ts with initialization
- [ ] Commit: System integration

### Error Handling & Retry Logic
- [ ] Test: Should retry failed jobs with exponential backoff
- [ ] Test: Should handle maximum retry limits
- [ ] Test: Should isolate failing job types
- [ ] Implementation: Add comprehensive error handling
- [ ] Commit: Error handling and retries

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

## Current Status
**Phase**: Completed Phase 3 - Job Service ✅
**Last Commit**: Job statistics and cleanup implementation
**Next Task**: Phase 4 - Job Worker Foundation