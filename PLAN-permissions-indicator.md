# Plan: Permissions Mode Indicator & Keyboard Shortcut

## Overview
Add a visual indicator for the current permissions mode on the session detail page and implement SHIFT-TAB keyboard shortcut to cycle through modes.

## Design Considerations

### Visual Indicator Placement Options
1. **In the header** - Next to the session status
2. **Near the input field** - Where users are actively working
3. **Floating badge** - Always visible in a corner

### Recommended Design
- Place indicator near the input field (bottom of page) for immediate visibility
- Use a subtle pill/badge design with icon + text
- Color-coded for each mode:
  - PLAN: Blue/purple (thoughtful)
  - ACCEPT EDITS: Green (permissive)
  - BYPASS PERMS: Orange/amber (caution)

### Keyboard Shortcut
- **SHIFT+TAB** to cycle forward through modes
- Order: PLAN → ACCEPT EDITS → BYPASS PERMS → PLAN
- Show brief toast notification when mode changes
- Update database immediately
- Reflect change in UI instantly

## Implementation Steps

### 1. Create Permissions Badge Component
- [ ] Create `PermissionsBadge.tsx` component
- [ ] Props: `mode: PermissionMode`, `isUpdating?: boolean`
- [ ] Show icon + abbreviated text (PLAN, ACCEPT, BYPASS)
- [ ] Add subtle animations for mode changes
- [ ] Write tests for component

### 2. Add Badge to Session Detail Page
- [ ] Import PermissionsBadge component
- [ ] Place near input field (left side of input bar)
- [ ] Get current mode from session settings
- [ ] Handle loading state

### 3. Implement Keyboard Shortcut
- [ ] Add keydown event listener for SHIFT+TAB
- [ ] Prevent default tab behavior
- [ ] Create cycle function: plan → acceptEdits → bypassPermissions → plan
- [ ] Call session settings API to update
- [ ] Optimistic UI update

### 4. Add Real-time Updates
- [ ] Update local state immediately on keypress
- [ ] Show loading indicator on badge during save
- [ ] Handle errors gracefully
- [ ] Optional: Add toast notification for mode change

### 5. Testing
- [ ] Test badge renders correctly for each mode
- [ ] Test keyboard shortcut cycles through modes
- [ ] Test API calls are made correctly
- [ ] Test optimistic updates work
- [ ] Test error handling

## UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│  [PLAN MODE]  >  Ask Claude Code anything...            │
└─────────────────────────────────────────────────────────┘

or

┌─────────────────────────────────────────────────────────┐
│  🔷 PLAN  >  Ask Claude Code anything...                │
└─────────────────────────────────────────────────────────┘
```

## Technical Notes
- Use the existing `updateSessionSettings` function
- Ensure keyboard shortcut doesn't interfere with form submission
- Consider accessibility - announce mode changes to screen readers
- Debounce API calls if user cycles quickly