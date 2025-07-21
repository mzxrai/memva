# Migration Plan: SSE to React Query + Zustand

## Overview
Replace Server-Sent Events (SSE) with React Query polling and add Zustand for efficient event state management to handle 500-1000 events without performance warnings.

## Process After Each Phase
After completing each phase:
1. Run `npm run lint` and fix any linting issues
2. Run `npm run typecheck` and fix any type errors  
3. Run `npm test` and update any failing tests
4. Create a git commit with appropriate message (e.g., `feat: add Zustand event store for session events`)
5. Only proceed to next phase when all checks are green

## Phase 1: Create Zustand Event Store

### 1.1 Setup Event Store Structure
- [x] Create `/app/stores/event-store.ts`
- [x] Define event store interface with:
  - Events map (keyed by UUID for O(1) lookups)
  - Tool results map (keyed by tool_use_id)
  - Session metadata (status, timestamps)
- [x] Implement store actions:
  - `setInitialEvents(events)`
  - `addEvents(newEvents)` 
  - `updateToolResult(toolId, result)`
  - `updateSessionStatus(status)`
  - `clearEvents()`

### 1.2 Add Computed Selectors
- [x] Create selector for sorted events
- [x] Create selector for display events (filtered)
- [x] Create selector for events by type
- [x] Ensure selectors are memoized properly

### 1.3 Optimize for Performance
- [x] Store events in Map instead of array
- [x] Pre-process events as they arrive (deduplication, sorting)
- [x] Separate tool results extraction logic

## Phase 2: Update API for Incremental Polling

### 2.1 Modify Events API Endpoint
- [ ] Add query parameter support to existing endpoint:
  - `?since_timestamp=` for incremental updates
  - `?since_event_id=` as alternative
  - `?include_all=true` for initial load
- [ ] Return events in correct order (oldest first)
- [ ] Include session status in response

### 2.2 Create Response Structure
- [ ] Define TypeScript types for API response
- [ ] Include metadata (hasMore, latestEventId, sessionStatus)
- [ ] Ensure backward compatibility

## Phase 3: Create React Query Hook

### 3.1 Implement useSessionEvents Hook
- [ ] Create `/app/hooks/useSessionEvents.ts`
- [ ] Setup React Query with:
  - Initial fetch of all events
  - Incremental polling for new events only
  - 1 second refetch interval
  - Stale time configuration
- [ ] Track last event ID/timestamp for incremental fetches
- [ ] Handle error states gracefully

### 3.2 Connect to Zustand Store
- [ ] Update store on successful fetch
- [ ] Only add truly new events
- [ ] Update session status from response
- [ ] Handle connection/disconnection states

## Phase 4: Refactor SessionDetail Component

### 4.1 Remove SSE Dependencies
- [ ] Remove `useSSEEvents` hook usage
- [ ] Remove `newEvents` state management
- [ ] Remove expensive `useMemo` computation
- [ ] Clean up event combining logic

### 4.2 Integrate Zustand Store
- [ ] Use store selectors for events
- [ ] Subscribe to specific event updates
- [ ] Use computed display events
- [ ] Ensure EventRenderer is properly memoized

### 4.3 Add React Query Integration
- [ ] Initialize events on mount
- [ ] Start polling for updates
- [ ] Handle loading/error states
- [ ] Implement proper cleanup

## Phase 5: Remove SSE Infrastructure

### 5.1 Remove SSE Code
- [ ] Delete `/app/hooks/useSSEEvents.ts`
- [ ] Remove SSE endpoint `/app/routes/api.claude-code.$sessionId.tsx`
- [ ] Clean up any SSE-related utilities
- [ ] Update any remaining SSE references

### 5.2 Update Related Components
- [ ] Check for any other components using SSE
- [ ] Update event submission flow if needed
- [ ] Ensure no broken imports

## Phase 6: Testing and Optimization

### 6.1 Performance Testing
- [ ] Verify no "message handler" warnings
- [ ] Test with 500+ events
- [ ] Confirm surgical updates work
- [ ] Check memory usage

### 6.2 Feature Testing
- [ ] Initial event load works
- [ ] New events appear correctly
- [ ] Tool results update properly
- [ ] Session status updates work
- [ ] Optimistic updates still function

### 6.3 Edge Cases
- [ ] Handle rapid event creation
- [ ] Test reconnection scenarios
- [ ] Verify deduplication works
- [ ] Test with multiple tabs open

## Phase 7: Cleanup and Documentation

### 7.1 Code Cleanup
- [ ] Remove debug logging
- [ ] Clean up unused imports
- [ ] Run linter and fix issues
- [ ] Run type checker

### 7.2 Update Tests
- [ ] Update/remove SSE-related tests
- [ ] Add tests for new polling behavior
- [ ] Add tests for Zustand store
- [ ] Ensure all tests pass

### 7.3 Final Verification
- [ ] Manual testing of full flow
- [ ] Performance profiling
- [ ] Check for console errors/warnings
- [ ] Verify CTRL-F search still works

## Success Criteria
- No performance warnings with 500-1000 events
- Events update within 1-2 seconds
- Only changed components re-render
- All existing functionality preserved
- Clean, maintainable code

## Notes
- Keep both implementations side-by-side initially for easy rollback
- Test in development with React StrictMode enabled
- Consider feature flag for gradual rollout if needed