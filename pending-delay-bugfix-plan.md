# Pending Message Delay Bug Fix Plan

## Bug Description
The pending message takes up to 2 seconds to disappear after Claude's response arrives because the UI relies on polling the session status every 2 seconds to check if `claude_status` has changed from 'processing' to 'completed'.

## Root Cause
The pending message visibility is controlled by `session.claude_status === 'processing'`, which is updated via:
1. Polling `/api/session/${sessionId}` every 2 seconds
2. This creates a delay of 0-2 seconds between when Claude finishes and when the UI updates

## Solution Options

### Option 1: Detect Result Event (Recommended)
Hide the pending message immediately when we receive the result event through SSE (which signals the end of Claude's response), rather than waiting for the session status to update.

### Option 2: Increase Polling Frequency
Reduce polling interval from 2000ms to 500ms (not ideal - increases server load).

### Option 3: Send Status Update via SSE
Emit a special SSE event when claude_status changes (requires backend changes).

## Implementation Plan (Option 1)

### Tasks
- [x] Add check for result events in the pending message logic
- [x] Hide pending message when result event arrives via SSE
- [x] Ensure pending message still hides on error/completion via polling
- [x] Test the improved responsiveness
- [x] Commit the fix

### Implementation Details

```typescript
// Check if we have a result event which signals completion
const hasResultEvent = displayEvents.some(e => e.event_type === 'result');

// Update pending message condition
{(isProcessing || isSubmitting) && !hasResultEvent && submissionStartTime.current && (
  <PendingMessage />
)}
```

This will hide the pending message immediately when the result event arrives through SSE, making the UI feel much more responsive by avoiding the up to 2-second polling delay.