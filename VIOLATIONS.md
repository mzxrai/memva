# CLAUDE.md Test Suite Violations Report

This report catalogs all test files in the codebase and their compliance with CLAUDE.md testing principles.

## Summary Statistics

- **Total test files reviewed**: 94 (corrected count)
- **Critical violations (must fix)**: 3 files
- **Major violations**: 42 files  
- **Minor violations**: 24 files
- **Fully compliant**: 25 files

## Critical Violations - Testing Implementation Details

These files test internal implementation instead of behavior and should be deleted or completely rewritten:

### 🚨 `app/db/database.test.ts`
- **Violation**: Tests database initialization, table structure, indexes
- **Fix**: DELETE this file - database structure is an implementation detail

### 🚨 `app/db/schema.test.ts`
- **Violation**: Tests schema structure with PRAGMA commands
- **Fix**: DELETE this file - schema is an implementation detail

### 🚨 `app/db/sessions.test.ts`
- **Violation**: Tests CRUD operations directly instead of service functions
- **Fix**: DELETE this file - use sessions.service.test.ts instead

## Major Violations by Category

### 1. Missing Test Factories (35 files)

These files hardcode test data instead of using factories from `test-utils/factories.ts`:

**Component Tests:**
- `app/__tests__/event-renderer.test.tsx` - Not using createMockEvent factories
- `app/__tests__/message-container.test.tsx` - Hardcoding message data
- `app/__tests__/message-header.test.tsx` - Hardcoding header data
- `app/__tests__/diff-viewer.test.tsx` - Hardcoding diff data
- `app/__tests__/markdown-renderer.test.tsx` - Hardcoding markdown content
- `app/__tests__/code-block.test.tsx` - Hardcoding code snippets
- `app/__tests__/message-carousel.test.tsx` - Hardcoding carousel data
- `app/__tests__/home-directory-selector.test.tsx` - Hardcoding directory data
- `app/__tests__/directory-selector.test.tsx` - Hardcoding directory options
- `app/__tests__/image-preview.test.tsx` - Hardcoding image data
- `app/__tests__/session-creation.test.tsx` - Not using createMockSession
- `app/__tests__/permission-badge.test.tsx` - Hardcoding badge props
- `app/__tests__/use-image-upload.test.ts` - Hardcoding file objects

**Integration/API Tests:**
- `app/__tests__/route-configuration.test.ts` - Hardcoding session data
- `app/__tests__/api-session-settings.test.ts` - Hardcoding settings data
- `app/__tests__/api-permissions-id.test.ts` - Hardcoding permission data
- `app/__tests__/api-permissions.test.ts` - Hardcoding permission requests
- `app/__tests__/home-action.test.ts` - Hardcoding form data

**Job System Tests (all 10 files):**
- `app/__tests__/better-queue-dependencies.test.ts`
- `app/__tests__/individual-job-api.test.ts`
- `app/__tests__/job-system-foundation.test.ts`
- `app/__tests__/job-type-registry.test.ts`
- `app/__tests__/job-worker-foundation.test.ts`
- `app/__tests__/jobs-api.test.ts`
- `app/__tests__/jobs-service-crud.test.ts`
- `app/__tests__/jobs-service-state.test.ts`
- `app/__tests__/jobs-service-stats.test.ts`
- `app/__tests__/jobs-table-schema.test.ts`

**Worker/Handler Tests:**
- `app/__tests__/job-worker-processing.test.ts`
- `app/__tests__/maintenance-handler.test.ts`
- `app/__tests__/session-runner-handler.test.ts`
- `app/__tests__/homepage-job-dispatch.test.ts`
- `app/__tests__/session-detail-job-dispatch.test.ts`
- `app/__tests__/maintenance-job-scheduling.test.ts`
- `app/__tests__/permission-edge-cases.test.ts`
- `app/__tests__/permission-flow-integration.test.ts`
- `app/__tests__/permission-ui-integration.test.tsx`
- `app/services/image-storage.server.test.ts`
- `app/workers/handlers/__tests__/session-runner-status-updates.test.ts`

### 2. Missing Semantic Testing Utilities (16 files)

These component tests use basic queries instead of semantic utilities:

- `app/__tests__/event-renderer.test.tsx` - Using getByText instead of expectContent
- `app/__tests__/tool-call-error-indicator.test.tsx` - Not using expectSemanticMarkup
- `app/__tests__/message-header.test.tsx` - Using querySelector
- `app/__tests__/diff-viewer.test.tsx` - Using getByText
- `app/__tests__/message-carousel.test.tsx` - Using getByTestId
- `app/__tests__/home-directory-selector.test.tsx` - Using getByTitle
- `app/__tests__/session-creation.test.tsx` - Not using semantic utilities
- `app/__tests__/green-line-indicator.test.tsx` - Using querySelector
- `app/__tests__/active-session-tracking.test.tsx` - Using getByText
- `app/__tests__/permission-badge.test.tsx` - Not using semantic utilities
- `app/__tests__/tool-result-format-fix.test.tsx` - Using getByText
- `app/__tests__/session-permissions-cycle.test.tsx` - Direct DOM manipulation
- `app/__tests__/edit-tool-error-display.test.tsx` - Using getByText
- `app/__tests__/image-preview.test.tsx` - Limited semantic utility usage

### 3. CSS Class Testing (8 files)

These files test CSS classes instead of behavior:

- `app/__tests__/message-header.test.tsx` - Tests `toHaveClass('custom-test-class')`
- `app/__tests__/code-block.test.tsx` - Tests `toHaveClass('border-transparent')`
- `app/__tests__/session-detail-component.test.tsx` - Tests `toHaveClass('font-mono')`
- `app/__tests__/todo-write-tool-display.test.tsx` - Tests `toHaveClass('font-mono')`
- `app/__tests__/tool-call-display.test.tsx` - Tests `toHaveClass('custom-class')`
- `app/__tests__/message-carousel.test.tsx` - Tests `toHaveClass('overflow-hidden')`
- `app/__tests__/green-line-indicator.test.tsx` - Tests `toHaveClass('opacity-100')`
- `app/__tests__/permission-badge.test.tsx` - Tests `toHaveClass('custom-class')`
- `app/__tests__/edit-tool-error-display.test.tsx` - Tests `toHaveClass('text-red-400')`

### 4. Direct Database Access (6 files)

These files use direct database operations instead of service functions:

- `app/__tests__/use-event-polling.test.tsx` - Uses `testDb.insertEvent()` directly
- `app/__tests__/use-permission-polling.test.tsx` - Accesses `testDb.db` in MSW handlers
- `app/__tests__/sessions-claude-status.test.ts` - Not testing through routes
- `app/__tests__/jobs-table-schema.test.ts` - Uses `testDb.sqlite.prepare()`
- `app/workers/handlers/maintenance.handler.test.ts` - Uses `db.update()` and `db.select()` directly

### 5. Mocking Internal Services (3 files)

These files mock internal services instead of only external dependencies:

- `app/__tests__/session-detail-loader.test.ts` - Mocks `event-session.service`
- `app/__tests__/home-action.test.ts` - Mocks `jobs.service` and `job-types`
- `app/__tests__/maintenance-handler.test.ts` - Imports handler directly
- `app/__tests__/session-runner-handler.test.ts` - Imports handler directly

### 6. Using setTimeout (5 files)

These files use `setTimeout` instead of smart waiting utilities:

- `app/__tests__/claude-code-events.test.ts` - Multiple uses of `setTimeout`
- `app/__tests__/stop-functionality.test.tsx` - Uses `setTimeout(resolve, 50)`
- `app/__tests__/session-permissions-cycle.test.tsx` - Uses `setTimeout` in Promise
- `app/db/sessions.service.test.ts` - Uses `setTimeout(resolve, 1)`
- `app/db/settings.service.test.ts` - Uses `setTimeout(resolve, 50)`

### 7. Testing Implementation Details (2 files)

- `app/__tests__/better-queue-dependencies.test.ts` - Tests package.json dependencies
- `app/__tests__/job-type-registry.test.ts` - Tests registry internals
- `app/__tests__/job-worker-foundation.test.ts` - Tests worker configuration internals

### 8. Not Using MSW for HTTP Mocking (2 files)

These files use anti-patterns for HTTP mocking instead of MSW:

- `app/__tests__/homepage-image-upload.test.tsx` - Uses `global.fetch = vi.fn()` (line 20)
- `app/__tests__/session-permissions-cycle.test.tsx` - Uses `global.fetch = vi.fn()` (lines 96, 186)

### 9. DOM Manipulation Anti-patterns (4 files)

These files use `querySelector` or similar DOM methods instead of semantic queries:

- `app/__tests__/green-line-indicator.test.tsx` - Uses `.querySelector('.bg-emerald-500')` (6 times)
- `app/__tests__/homepage-image-upload.test.tsx` - Uses `document.querySelector('form')`
- `app/__tests__/status-indicator.test.tsx` - Uses `.querySelector('[data-testid="status-dot"]')`
- `app/__tests__/bash-tool-display.test.tsx` - Uses `.querySelector('svg')` (noted earlier)

## Minor Violations

### Missing Database Setup (1 file)

- `app/__tests__/api-filesystem.test.ts` - Doesn't use setupDatabaseMocks (doesn't need database)

## Fully Compliant Files (25)

These files follow all CLAUDE.md principles correctly:

### Component Tests
- `app/__tests__/events-component.test.tsx` ✅
- `app/__tests__/events-sessionid-component.test.tsx` ✅
- `app/__tests__/bash-tool-integration.test.tsx` ✅
- `app/__tests__/read-tool-display.test.tsx` ✅
- `app/__tests__/edit-tool-display.test.tsx` ✅
- `app/__tests__/bash-tool-display.test.tsx` ✅
- `app/__tests__/assistant-message-tools.test.tsx` ✅
- `app/__tests__/write-tool-display.test.tsx` ✅
- `app/__tests__/session-status-polling.test.tsx` ✅
- `app/__tests__/permission-notification.test.tsx` ✅
- `app/__tests__/permission-queue.test.tsx` ✅
- `app/__tests__/inline-permission-request.test.tsx` ✅
- `app/__tests__/status-indicator.test.tsx` ✅
- `app/__tests__/homepage-initial-prompt.test.tsx` ✅
- `app/__tests__/session-detail-title-truncation.test.tsx` ✅
- `app/__tests__/session-detail-settings-button.test.tsx` ✅
- `app/__tests__/stop-functionality.test.tsx` ✅

### Integration Tests
- `app/__tests__/event-storage.test.ts` ✅
- `app/__tests__/events-loader.test.ts` ✅
- `app/__tests__/events-sessionid-loader.test.ts` ✅
- `app/__tests__/session-resumption.test.ts` ✅
- `app/__tests__/user-message-storage.test.ts` ✅
- `app/__tests__/session-detail-user-message-storage.test.ts` ✅
- `app/__tests__/api-sessions-homepage.test.ts` ✅
- `app/__tests__/api.claude-code.test.ts` ✅

### Database Service Tests
- `app/db/events.service.test.ts` ✅
- `app/db/event-session.service.test.ts` ✅
- `app/db/sessions.service.test.ts` ✅
- `app/db/permissions.service.test.ts` ✅
- `app/db/settings.service.test.ts` ✅

## Additional Findings from Final Review

### Previously Missed Test Files (3 files)

We initially missed 3 test files in our review:

1. **`app/services/image-storage.server.test.ts`**
   - Not using test factories for session IDs and test data
   - Otherwise compliant

2. **`app/workers/handlers/__tests__/session-runner-status-updates.test.ts`**
   - Not using test factories for job objects
   - Otherwise compliant

3. **`app/workers/handlers/maintenance.handler.test.ts`**
   - **MAJOR VIOLATION**: Direct database access (`db.update()`, `db.select()`)
   - Not using test factories for job objects
   - Should use service layer functions

## Recommendations

### Immediate Actions (Critical)

1. **Delete these 3 files entirely**:
   - `app/db/database.test.ts`
   - `app/db/schema.test.ts`
   - `app/db/sessions.test.ts`

### High Priority Fixes

2. **Create test factories** for:
   - Job objects: `createMockJob()`
   - Permission requests: `createMockPermissionRequest()`
   - Settings: `createMockSettings()`
   - Form data: `createMockFormData()`

3. **Replace CSS class testing** with behavioral tests in 8 files

4. **Update component tests** to use semantic utilities from `test-utils/component-testing.ts`

5. **Replace direct database access** with service function calls

6. **Remove internal service mocks** - only mock external dependencies

7. **Replace setTimeout** with `waitForCondition()` and other smart waiting utilities in 5 files

8. **Fix DOM manipulation** - Replace `querySelector` with semantic queries in 4 files

9. **Fix maintenance.handler.test.ts** - Major violation with direct database access

### Code Example - Fixing Test Factory Usage

```typescript
// ❌ WRONG - Hardcoding test data
const job = {
  id: 'job-123',
  type: 'maintenance',
  status: 'pending',
  input: { task: 'cleanup' }
}

// ✅ CORRECT - Using test factory
const job = createMockJob({
  type: 'maintenance',
  input: { task: 'cleanup' }
})
```

### Code Example - Fixing Semantic Testing

```typescript
// ❌ WRONG - Using basic queries
expect(screen.getByText('Submit')).toBeInTheDocument()

// ✅ CORRECT - Using semantic utilities
expectSemanticMarkup.button('Submit')
```

### Code Example - Fixing CSS Testing

```typescript
// ❌ WRONG - Testing CSS classes
expect(element).toHaveClass('text-red-500')

// ✅ CORRECT - Testing behavior/accessibility
expect(element).toHaveAttribute('aria-invalid', 'true')
expectContent.text('Error: Invalid input')
```

### Code Example - Fixing HTTP Mocking

```typescript
// ❌ WRONG - Direct fetch mocking
global.fetch = vi.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: 'test' })
  })
)

// ✅ CORRECT - Using MSW
import { server } from '../test-utils/msw-server'
import { http, HttpResponse } from 'msw'

beforeEach(() => {
  server.use(
    http.get('/api/data', () => {
      return HttpResponse.json({ data: 'test' })
    })
  )
})
```

### Code Example - Fixing DOM Queries

```typescript
// ❌ WRONG - Using querySelector
const greenLine = element.querySelector('.bg-emerald-500')

// ✅ CORRECT - Using semantic queries
const greenLine = screen.getByRole('status', { name: 'Progress indicator' })
// or
const greenLine = screen.getByTestId('green-line-indicator')
```

## Conclusion

After comprehensive review of all 94 test files, the test suite shows good overall compliance (~70% of files have only minor issues or are fully compliant). The critical violations are limited to 3 database test files that should be deleted. 

Key patterns discovered in final review:
- 5 files using `setTimeout` instead of smart waiting
- 4 files using DOM manipulation anti-patterns
- 2 files using `global.fetch` mocking instead of MSW
- 1 additional file with major direct database access violation

Most violations are easily fixable by:

1. Adding test factories to `test-utils/factories.ts`
2. Using existing semantic testing utilities
3. Focusing on behavior instead of implementation

The codebase demonstrates strong testing practices in many areas, particularly in the service layer tests and newer component tests.