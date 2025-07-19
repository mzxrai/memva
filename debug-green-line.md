# Green Line Debug Analysis

## The Problem
The green line indicator for new messages only shows up ~33% of the time (2 out of 6 times).

## Current Flow

1. **HomePage polls every 2 seconds** → gets session data with latest messages
2. **MessageCarousel receives** `latestMessage` prop
3. **MessageCarousel checks if message is new:**
   - Different UUID than `previousMessageId.current`
   - Different UUID than `lastSeenMessageId` (from sessionStorage)
   - Message timestamp < 30 seconds old
   - Has received first message OR previousMessageId exists
4. **If all conditions met:** calls `markAsNew(uuid)`
5. **useNewMessageTracking:**
   - Stores in localStorage: `{sessionId: {messageId, timestamp}}`
   - Sets `hasNewMessage = true`
   - Green line shows

## Potential Issues

### 1. Race Condition with Polling
- Poll 1: Message A arrives, gets marked as new ✓
- Poll 2 (2s later): Same Message A arrives, `lastSeenMessageId` might not be updated yet
- Result: Message gets marked as new again OR conditions fail

### 2. SessionStorage vs Component State Sync
- `lastSeenMessageId` is initialized from sessionStorage on mount
- But it's only updated when marking as new succeeds
- If component re-renders between polls, state can be inconsistent

### 3. The 30-Second Window
- If a message is created but takes >30s to show on homepage (due to processing), it won't be marked as new
- With ESC cancellation, there might be delays

### 4. Multiple Condition Gates
Too many conditions must align:
- `isRecent` (< 30 seconds)
- `isNewMessage` (different from lastSeenMessageId)
- `hasReceivedFirstMessage || previousMessageId.current !== undefined`
- Not recently cleared in localStorage

### 5. Component Re-mounting
With React Query and frequent re-renders, the component might lose track of:
- `hasReceivedFirstMessage` state
- `previousMessageId.current` ref

## Hypothesis
The green line works when:
1. Message arrives fresh (< 30s old)
2. Component hasn't re-mounted recently
3. All state is properly synchronized

It fails when:
1. Polling catches a message that's slightly older
2. Component re-mounted and lost state
3. Race condition between localStorage and state updates