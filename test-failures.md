# Test Failures Checklist

## Fixed Tests ✓
- [x] MSW Request Handler Errors
- [x] `homepage-initial-prompt.test.tsx` 
- [x] `homepage-job-dispatch.test.ts` (2 tests)
- [x] `session-status-polling.test.tsx` (2 tests)
- [x] Timeout issues in `user-message-storage.test.ts` (partial)

### useEventPolling Hook Tests ✓
- [x] `use-event-polling.test.tsx` - "should poll database for new events every 2 seconds"
- [x] `use-event-polling.test.tsx` - "should update events list when new events arrive"
- [x] `use-event-polling.test.tsx` - "should handle polling errors gracefully"
- [x] `use-event-polling.test.tsx` - "should show events in real-time as they are stored"

### User Message Storage Tests ✓
- [x] `user-message-storage.test.ts` - "should store user prompt as an event when submitted" (NOT NULL constraint failed)
- [x] `user-message-storage.test.ts` - "should store user message before Claude Code messages" (NOT NULL constraint failed)

## Total: All 435 tests passing! 🎉

## Summary of fixes:
1. **useEventPolling Hook**: Updated the hook to use the proper service function `getEventsForSession` instead of fetch API
2. **User Message Storage Tests**: Fixed the event creation to properly use the `createEventFromMessage` function with the correct message structure