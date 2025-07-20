# Plan: Session-Specific Settings Implementation

## Overview
Transform the current global settings system into a two-tier system:
1. **Global defaults** - Set on homepage, used as starting point for new sessions
2. **Session-specific settings** - Can be overridden per session on the session detail page

## Status: ✅ COMPLETE

All planned features have been successfully implemented!

## Completed Work

### 1. Database Schema Updates ✅
- [x] Add `settings` JSON column to sessions table in schema.ts
- [x] Create migration to add settings column to existing sessions table
- [x] Update database initialization in database.ts
- [x] Add settings types to `/app/types/settings.ts`

### 2. Session Service Layer ✅
- [x] Modify `createSession` to copy global settings when creating new sessions
- [x] Add `updateSessionSettings` function to update session-specific settings
- [x] Add `getSessionSettings` function to retrieve session settings (with fallback to global)
- [x] Fix JSON serialization/deserialization for settings storage

### 3. Testing & Quality ✅
- [x] Write comprehensive tests for session settings service functions
- [x] Update existing tests to handle new settings structure
- [x] Test settings inheritance (global → session)
- [x] Test settings override functionality
- [x] Fix all linting errors
- [x] Fix all TypeScript errors
- [x] Write tests for API routes
- [x] Write tests for UI components

### 4. Settings Modal Enhancement ✅
- [x] Add `mode: 'global' | 'session'` prop to SettingsModal
- [x] Add `sessionId?: string` prop for session mode
- [x] Update modal title dynamically based on mode:
  - Global: "Default Settings for New Sessions"
  - Session: "Session Settings"
- [x] Update save logic to call either global or session settings API
- [x] Add helper text in global mode: "These are the defaults for new sessions, but can be overridden within each individual session."
- [x] Add loading skeleton to prevent UI jump when settings load
- [x] Update tests to verify modal works in both modes

### 5. Session Detail Page Integration ✅
- [x] Add settings button to session detail page header
- [x] Use same icon as homepage (RiSettings3Line)
- [x] Add "Session Settings" label to the button
- [x] Pass session ID to SettingsModal when opened
- [x] Settings modal opens in session mode with correct props

### 6. Claude Code API Integration ✅
- [x] Update `/api/claude-code.$sessionId` route to use session settings
- [x] Fix SessionRunner to use `getSessionSettings` instead of global `getSettings`
- [x] Verify Claude Code SDK uses session-specific settings:
  - maxTurns from session settings
  - permissionMode from session settings
- [x] Proper fallback to global settings when session has none

### 7. Session Settings API Routes ✅
- [x] Create GET `/api/session/:sessionId/settings` route
- [x] Create PUT `/api/session/:sessionId/settings` route
- [x] Add validation for settings updates
- [x] Handle partial updates correctly
- [x] Write comprehensive tests for API routes

### 8. Bug Fixes & Polish ✅
- [x] Fix loading state to prevent UI jump from default to actual settings
- [x] Add skeleton loader for smooth loading experience
- [x] Fix SessionRunner to use session-specific settings
- [x] Update modal text for clarity:
  - Title: "Default Settings for New Sessions"
  - Helper: "These are the defaults for new sessions, but can be overridden within each individual session."

## Architecture Decisions

### What Went Well
- **Service layer pattern** - Clean separation between routes and database operations
- **JSON columns** - Flexible storage for settings without schema changes
- **Fallback mechanism** - Graceful handling of sessions without custom settings
- **TDD approach** - Caught issues early and ensured reliability

### Key Implementation Details
- New sessions copy global settings at creation time
- Session settings are optional - null means use global defaults
- Settings modal is reusable with `mode` prop
- All settings changes are validated before saving

## Future Enhancements (Not Implemented)
- Settings templates/presets
- Import/export functionality
- Visual indicators on session cards for custom settings
- "Reset to defaults" button
- Settings change history/audit log