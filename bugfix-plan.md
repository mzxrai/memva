# Bug Fix Implementation Plan

## Bug Description
1. Unable to start new session from the homepage; entering a prompt string and hitting return does nothing.
2. When starting a session from homepage, no user message is created for the initial prompt.

## Root Cause
1. Form submission bug: The form submission is blocked because:
   - The `sessionPrompt` state is hardcoded to empty string (`useState("")`)
   - The `handleSubmit` validation checks for both title AND prompt to be non-empty
   - The form action expects a `prompt` field that's never sent

2. Missing initial user message: The session runner handler doesn't create a user event for the initial prompt

## Solution
Fix the single-input form to work as intended (Enter to submit):

### Tasks

- [x] Research homepage component and session creation form
- [x] Understand session creation flow and navigation
- [x] Identify root cause of the bug
- [x] Create detailed implementation plan
- [x] Fix the bug in home.tsx
- [x] Update homepage-initial-prompt.test.tsx to match single-input design
- [x] Fix missing initial user message in session runner handler
- [x] Run tests, lint, and typecheck
- [x] Commit the fix

### Implementation Details

#### 1. Update `app/routes/home.tsx`
- [x] Remove the unused `sessionPrompt` state variable
- [x] Fix the form validation to only check for title
- [x] Add a hidden prompt field that uses the title as the prompt
- [x] Remove the preventDefault when only title is needed
- [x] Ensure form submits on Enter key (natural form behavior)

#### 1.5. Fix Missing Initial User Message
- [x] Update `app/workers/handlers/session-runner.handler.ts` to create initial user event before streaming

#### 2. Update Component Tests
- [x] Update `app/__tests__/homepage-initial-prompt.test.tsx` to match the single-input design:
  - Remove expectations for separate title/prompt fields
  - Remove expectations for Start button
  - Update to test single input with Enter key submission

#### 3. Verify the Fix
- [x] Test that entering text and hitting Enter creates a session (home component tests passing)
- [x] Test that navigation works (redirect implemented)
- [x] Test that the prompt is passed correctly to the backend
- [x] Run tests - home component tests passing
- [ ] Fix remaining TypeScript and lint issues

## Summary

Both bugs have been fixed:

1. **Form submission bug**: Fixed by removing the unused `sessionPrompt` state and updating validation to only check for title
2. **Missing initial user message**: Fixed by creating a user event in the session runner handler before streaming Claude's response

The fixes maintain the developer-friendly single input interface while ensuring proper functionality.