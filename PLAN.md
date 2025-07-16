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

## Phase 5: Job Types & Handlers (TDD)

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
- [ ] Test: Should cleanup old jobs
- [ ] Test: Should vacuum database
- [ ] Test: Should create database backups
- [ ] Implementation: Create maintenance.handler.ts
- [ ] Commit: Maintenance handler

## Phase 6: API Integration (TDD)

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
**Phase**: Phase 6 - API Integration (Route Configuration Complete) ✅
**Last Commit**: Route Configuration - Job API routes accessible with 73 tests passing
**Next Task**: Phase 7 - System Integration