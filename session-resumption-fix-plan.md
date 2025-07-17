# Session Resumption Bug Fix Plan

## Bug Description
When a user submits a message to Claude via the session detail page, it should resume the pre-existing Claude Code session, but instead it creates a new session each time. The session ID from Claude Code changes with each message, and we need to properly extract and use the last session ID for resumption.

## Root Cause Analysis
The `getLatestClaudeSessionId` function in `sessions.service.ts` is retrieving the latest event by timestamp, which might be a user event with an empty `session_id`. User events created by our API initially have an empty session_id when there's no existing Claude session. Only events returned from Claude Code have the actual session_id.

## Implementation Plan

### 1. Fix getLatestClaudeSessionId Function
- [x] Modify the function to filter out events with empty session_id
- [x] Ensure it only returns session IDs from Claude Code responses
- [x] Add proper logging to debug session ID retrieval

### 2. Write Failing Test First (TDD)
- [x] Create a test that verifies the correct Claude session ID is retrieved
- [x] Test should check that user events with empty session_id are ignored
- [x] Test should verify that the latest non-empty session_id is returned

### 3. Implement the Fix
- [x] Update `getLatestClaudeSessionId` to filter events properly
- [x] Ensure the query excludes events where session_id is empty or null
- [x] Order by timestamp descending to get the most recent valid session_id

### 4. Verify Existing Tests Pass
- [x] Run the session-resumption test suite
- [x] Fix the failing test about event threading
- [x] Ensure all tests are green

### 5. Manual Testing Verification
- [ ] Test creating a new session and sending multiple messages
- [ ] Verify that the Claude session ID is properly resumed
- [ ] Check logs to confirm resumption is working

### 6. Code Review and Cleanup
- [x] Remove any debug logging added during investigation
- [x] Ensure code follows project conventions
- [ ] Update any related documentation if needed

### 7. Additional Fixes Found
- [x] Remove duplicate user event creation in API endpoint
- [x] Fix duplicate user event creation in session runner handler
- [x] Pass resumeSessionId to streamClaudeCodeResponse in session runner
- [x] Fix broken references after removing userEvent variable

## Technical Details

### Current Implementation Issue
```typescript
// Current implementation gets ANY latest event
export async function getLatestClaudeSessionId(memvaSessionId: string): Promise<string | null> {
  const result = await db
    .select({ session_id: events.session_id })
    .from(events)
    .where(eq(events.memva_session_id, memvaSessionId))
    .orderBy(desc(events.timestamp))
    .limit(1)
    .execute()
  
  return result[0]?.session_id || null
}
```

### Proposed Fix
Need to filter for non-empty session_ids and possibly specific event types that come from Claude Code (system, assistant, result).

## Success Criteria
1. When sending a second message in a session, the logs should show: `[Claude Code] Attempting to resume session: <actual-session-id>`
2. Claude Code should receive the `resume` option with the correct session ID
3. All tests should pass
4. Manual testing confirms session continuity