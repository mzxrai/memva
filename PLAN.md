# Permission Handling Implementation Plan

## Current Status 🚧
- **Phase 1: Database Layer** ✅ COMPLETE
- **Phase 2: MCP Permission Server** ✅ COMPLETE
- **Phase 3: Update Claude Code Service** ✅ COMPLETE
- **Phase 4: React UI Components** ✅ COMPLETE
- **Phase 5: Polling and State Management** ✅ COMPLETE
- **Phase 6: API Routes** ✅ COMPLETE
- **Phase 7: Maintenance & Cleanup** ⏳ NOT STARTED
- **Phase 8: Integration Testing** ⏳ NOT STARTED
- **Phase 9: Documentation & Polish** ⏳ NOT STARTED

**Overall Progress: ~66%**

## Overview
Implement a permission handling system for Claude Code sessions using MCP (Model Context Protocol) with SQLite polling for maximum resilience. Users will have up to 24 hours to respond to permission requests.

## Architecture Summary
- **MCP Permission Server**: Standalone TypeScript server that implements the permission prompt tool
- **SQLite Database**: Central storage for permission requests (polling-based, no WebSockets)
- **React UI**: Permission notification system with queue management
- **Polling Strategy**: UI polls every 500ms-1s, MCP server uses exponential backoff

## Implementation Checklist

### Phase 1: Database Layer ✅
- [x] Create database schema for `permission_requests` table
  - [x] Add migration file `005_add_permission_requests.sql`
  - [x] Update `app/db/schema.ts` with new table definition
  - [x] Fields: id, session_id, tool_name, tool_use_id, input, status, decision, decided_at, created_at, expires_at
- [x] Create permission service layer (`app/db/permissions.service.ts`)
  - [x] `createPermissionRequest()` - Create new permission request
  - [x] `getPermissionRequests()` - Get all requests with filters
  - [x] `getPendingPermissionRequests()` - Get pending requests for UI
  - [x] `updatePermissionDecision()` - Update request with approval/denial
  - [x] `expireOldRequests()` - Mark 24h+ requests as timeout
- [x] Write database tests for permission service
  - [x] Test CRUD operations
  - [x] Test expiration logic
  - [x] Test concurrent request handling
  - [x] All tests passing ✅

### Phase 2: MCP Permission Server ✅
- [x] Set up new TypeScript project in `mcp-permission-server/`
  - [x] Initialize package.json with dependencies
  - [x] Configure tsconfig.json for Node.js target with ES modules
  - [x] Install @modelcontextprotocol/sdk and better-sqlite3
- [x] Implement MCP server (`mcp-permission-server/src/index.ts`)
  - [x] Create MCP server instance
  - [x] Register `approval_prompt` tool
  - [x] Implement permission request creation in SQLite (via PermissionPoller class)
  - [x] Implement polling logic with exponential backoff (100ms → 5s cap)
  - [x] Handle 24-hour timeout
  - [x] Return proper JSON response format
- [x] Create build script
  - [x] TypeScript compilation to JavaScript
  - [x] Build successful - outputs to build/ directory
- [x] Write unit tests for MCP server
  - [x] Test permission request creation
  - [x] Test polling behavior
  - [x] Test timeout handling
  - [x] Test exponential backoff
  - [x] All tests passing ✅

### Phase 3: Update Claude Code Service ✅ COMPLETE
- [x] Modify `app/services/claude-code.server.ts`
  - [x] Create ~/.memva/tmp directory if not exists
  - [x] Generate MCP config files at `~/.memva/tmp/mcp-config-{sessionId}.json`
  - [x] Add `mcpConfig` option to Claude Code SDK options (camelCase version of --mcp-config)
  - [x] Add `permissionPromptTool` option with mcp__memva-permissions__approval_prompt
  - [x] Include correct MCP server path and environment variables
  - [x] Clean up temp files on session end
- [x] Write tests for MCP config generation
  - [x] Test config file creation
  - [x] Test cleanup on session end
  - [x] Test SDK options with MCP config
  - [x] Test permission tool is added to allowed tools

**Note**: Claude Code TypeScript SDK accepts all CLI arguments but in camelCase format (e.g., `--mcp-config` becomes `mcpConfig`)

### Phase 4: React UI Components ✅ COMPLETE
- [x] Create permission components (`app/components/permissions/`)
  - [x] `PermissionRequestNotification.tsx` - Persistent notification bar
  - [ ] `PermissionRequestModal.tsx` - Detailed view with tool info (deferred)
  - [x] `PermissionQueue.tsx` - List all pending requests
  - [ ] `PermissionHistory.tsx` - Audit log of past decisions (deferred)
  - [x] `PermissionBadge.tsx` - Show count of pending permissions
- [x] Integrate with existing design system
  - [x] Use Linear-inspired minimal design
  - [x] Use Inter font for UI text
  - [x] Use JetBrains Mono for code/tool info
  - [x] Thoughtful use of color for approve/deny actions
- [x] Write component tests
  - [x] Test notification appearance
  - [x] Test queue management
  - [x] Test badge behavior
  - [x] Use semantic testing utilities

**Note**: Focused on core components needed for MVP. Modal and history components can be added later.

### Phase 5: Polling and State Management ✅ COMPLETE
- [x] Create `usePermissionPolling` hook (`app/hooks/usePermissionPolling.ts`)
  - [x] Poll database every 500ms for new requests (default)
  - [x] Direct service layer polling (no React Query needed)
  - [x] Return pending permissions list
  - [x] Handle approve/deny actions
  - [x] Support configurable polling interval and enable/disable
- [ ] Add to main layout to ensure polling is always active (deferred to Phase 6)
- [x] Write tests for polling behavior
  - [x] Test new request detection
  - [x] Test polling intervals
  - [x] Test action handling
  - [x] Test error handling

**Note**: Simplified approach using direct service calls instead of React Query, following existing patterns in codebase.

### Phase 6: API Routes ✅ COMPLETE
- [x] Create permission API routes
  - [x] `app/routes/api.permissions.tsx` - GET permission history
  - [x] `app/routes/api.permissions.$id.tsx` - POST decision update
  - [x] Follow existing route patterns with loaders/actions
- [x] Write integration tests for API routes
  - [x] Test permission listing
  - [x] Test decision updates
  - [x] Test error cases
  - [x] All tests passing ✅

### Phase 7: Maintenance & Cleanup
- [ ] Update maintenance handler (`app/workers/handlers/maintenance.handler.ts`)
  - [ ] Add task to expire old permission requests (>24h)
  - [ ] Run alongside existing cleanup tasks
- [ ] Write tests for maintenance tasks
  - [ ] Test expiration logic
  - [ ] Test cleanup scheduling

### Phase 8: Integration Testing
- [ ] Create end-to-end test for full permission flow
  - [ ] Spawn Claude Code with permission tool
  - [ ] Trigger permission request
  - [ ] Verify UI shows notification
  - [ ] Test approve/deny flow
  - [ ] Verify Claude Code receives response
- [ ] Test edge cases
  - [ ] Multiple concurrent permission requests
  - [ ] 24-hour timeout behavior
  - [ ] UI disconnection/reconnection
  - [ ] Server restart scenarios

### Phase 9: Documentation & Polish
- [ ] Update CLAUDE.md with any learnings
- [ ] Add JSDoc comments to service functions
- [ ] Ensure all tests pass
- [ ] Run lint and typecheck
- [ ] Manual testing with real Claude Code sessions

## Success Criteria
- [ ] Permission requests appear in UI within 1 second
- [ ] Users can approve/deny requests up to 24 hours later
- [ ] System handles multiple concurrent sessions gracefully
- [ ] All tests pass with proper TDD approach
- [ ] Clean separation of concerns following service layer pattern
- [ ] Resilient to disconnections and restarts

## Technical Details

### Database Schema
```sql
CREATE TABLE permission_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_use_id TEXT,
  input TEXT NOT NULL, -- JSON
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied, timeout
  decision TEXT, -- allow, deny
  decided_at TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### MCP Server Tool Response Format
```typescript
// Success response
{
  "behavior": "allow",
  "updatedInput": {...} // original or modified input
}

// Denial response
{
  "behavior": "deny",
  "message": "Permission denied by user"
}
```

### Polling Strategy
- **UI Polling**: Every 500ms-1s for responsiveness
- **MCP Server Polling**: Exponential backoff
  - Start: 100ms
  - Double each iteration
  - Cap: 5 seconds
  - Total timeout: 24 hours

## Notes
- All times in UTC for consistency
- Permission requests are session-specific
- Database remains source of truth for all state
- MCP config assumes merge behavior (not override)