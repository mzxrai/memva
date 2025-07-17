# Pending Message Bug Fix Plan

## Bug Description
The pending message is not showing up when creating a new session via the homepage, but it shows up correctly when submitting a message via the form on the session detail page.

## Root Cause
When creating a session from the homepage:
1. The session is created without setting `claude_status` 
2. The claude_status is never updated to 'processing' before redirecting to the session detail page
3. The session detail page shows pending message only when `claude_status === 'processing'`

In contrast, when submitting from the session detail page:
1. The claude_status is explicitly updated to 'processing' before creating the job
2. This triggers the pending message to appear immediately

## Solution
Update the homepage action to set claude_status to 'processing' after creating the session but before redirecting.

### Tasks
- [x] Update home.tsx action to set claude_status to 'processing'
- [x] Test that pending message appears after homepage submission
- [x] Verify no regression for session detail page submission
- [x] Run tests, lint, and typecheck
- [x] Commit the fix

### Implementation Details

#### Update `app/routes/home.tsx` action:
```typescript
// After creating session
const session = await createSession({
  title: title.trim(),
  project_path: '/Users/mbm-premva/dev/memva',
  status: 'active',
  metadata: {
    should_auto_start: true
  }
});

// Add this: Update claude_status to processing
const { updateSessionClaudeStatus } = await import('../db/sessions.service');
await updateSessionClaudeStatus(session.id, 'processing');

// Then create job and redirect as before
```

This ensures the session detail page will show the pending message immediately upon navigation.