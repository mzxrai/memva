# Test Suite Remediation Plan

This plan provides specific actions to fix all CLAUDE.md violations in the test suite.

## Immediate Actions - Delete These Files

These files violate the fundamental principle "test behavior, not implementation":

### Files to Delete (5 total)

1. **`app/db/database.test.ts`**
   - **Violation**: Tests database initialization, table creation, indexes
   - **Why**: These are implementation details, not behavior
   - **Action**: DELETE - functionality is tested through service functions elsewhere

2. **`app/db/schema.test.ts`**
   - **Violation**: Tests schema structure using `PRAGMA table_info`
   - **Why**: Schema is an implementation detail
   - **Action**: DELETE - data integrity is tested through service functions

3. **`app/db/sessions.test.ts`**
   - **Violation**: Tests CRUD operations directly on database
   - **Why**: Direct database access bypasses the service layer (public API)
   - **Action**: DELETE - use `sessions.service.test.ts` instead

4. **`app/__tests__/better-queue-dependencies.test.ts`**
   - **Violation**: Tests that packages exist in package.json
   - **Why**: Build system responsibility, not application behavior
   - **Action**: DELETE - if dependency missing, app won't run

5. **`app/__tests__/jobs-table-schema.test.ts`**
   - **Violation**: Tests schema with direct SQL queries
   - **Why**: Schema structure is implementation, not behavior
   - **Action**: DELETE - job behavior tested through service functions

## High Priority Fixes

### 1. Create Missing Test Factories

**Violation**: 38 files hardcode test data instead of using factories
**CLAUDE.md principle**: "ALWAYS use test factories, never hardcode test data"

**Action**: Add these factories to `app/test-utils/factories.ts`:

```typescript
// Job factory
export function createMockJob(overrides?: Partial<Job>): Job {
  return {
    id: `job-${crypto.randomUUID()}`,
    type: 'session-runner',
    status: 'pending',
    data: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

// Permission request factory  
export function createMockPermissionRequest(overrides?: Partial<PermissionRequest>): PermissionRequest {
  return {
    id: `perm-${crypto.randomUUID()}`,
    session_id: 'session-123',
    tool_name: 'Bash',
    tool_use_id: null,
    input: { command: 'ls' },
    status: 'pending',
    created_at: new Date().toISOString(),
    ...overrides
  }
}

// Settings factory
export function createMockSettings(overrides?: Partial<Settings>): Settings {
  return {
    id: 1,
    max_turns: 200,
    permission_mode: 'auto',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

// Form data factory
export function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}
```

**Files to fix**: All 38 files listed in VIOLATIONS.md under "Missing Test Factories"

### 2. Replace CSS Class Testing

**Violation**: 9 files test CSS classes
**CLAUDE.md principle**: "Test behavior/accessibility, never CSS classes"

**Specific fixes**:

```typescript
// ❌ WRONG - Testing implementation
expect(element).toHaveClass('text-red-500')
expect(element).toHaveClass('font-mono')
expect(element).toHaveClass('opacity-100')

// ✅ CORRECT - Testing behavior
expect(element).toHaveAttribute('aria-invalid', 'true')
expect(element).toHaveAttribute('data-status', 'error')
expectContent.text('Error message')
expectSemanticMarkup.region('Error details')
```

**Files to fix**:
- `message-header.test.tsx` - Remove `.toHaveClass('custom-test-class')`
- `code-block.test.tsx` - Remove `.toHaveClass('border-transparent')`
- `session-detail-component.test.tsx` - Remove all `.toHaveClass()` checks
- `todo-write-tool-display.test.tsx` - Remove `.toHaveClass('font-mono')`
- `tool-call-display.test.tsx` - Remove `.toHaveClass('custom-class')`
- `message-carousel.test.tsx` - Remove `.toHaveClass('overflow-hidden')`
- `green-line-indicator.test.tsx` - Remove `.toHaveClass('opacity-100')`
- `permission-badge.test.tsx` - Remove `.toHaveClass('custom-class')`
- `edit-tool-error-display.test.tsx` - Remove `.toHaveClass('text-red-400')`

### 3. Fix Direct Database Access

**Violation**: 6 files use direct database operations
**CLAUDE.md principle**: "Service layer functions ARE public APIs - test service functions"

**Specific fixes**:

```typescript
// ❌ WRONG - Direct database access
testDb.db.insert(events).values([...])
testDb.db.select().from(permissionRequests)
testDb.sqlite.prepare('UPDATE...').run()

// ✅ CORRECT - Use service functions
import { createEvent, getEvents } from '../db/events.service'
import { createPermissionRequest, updatePermissionDecision } from '../db/permissions.service'

await createEvent(eventData)
const events = await getEvents(sessionId)
await updatePermissionDecision(requestId, 'allow')
```

**Files to fix**:
- `use-event-polling.test.tsx` - Replace `testDb.insertEvent()` with service function
- `use-permission-polling.test.tsx` - Replace `testDb.db` access in MSW handlers
- `sessions-claude-status.test.ts` - Test through routes, not direct DB
- `maintenance.handler.test.ts` - Replace all `db.update()` and `db.select()`

### 4. Replace setTimeout with Smart Waiting

**Violation**: 5 files use `setTimeout`
**CLAUDE.md principle**: "ALWAYS use smart waiting, NEVER use arbitrary timeouts"

**Specific fixes**:

```typescript
// ❌ WRONG - Arbitrary timeout
await new Promise(resolve => setTimeout(resolve, 100))

// ✅ CORRECT - Wait for condition
import { waitForCondition } from '../test-utils/async-testing'

await waitForCondition(() => 
  testDb.getEventsForSession(sessionId).length > 0
)

// ✅ CORRECT - Wait for specific events
import { waitForEvents } from '../test-utils/async-testing'

await waitForEvents(
  () => testDb.getEventsForSession(sessionId),
  ['user', 'assistant']
)
```

**Files to fix**:
- `claude-code-events.test.ts` - Replace 6 setTimeout calls
- `stop-functionality.test.tsx` - Replace setTimeout(50)
- `session-permissions-cycle.test.tsx` - Replace setTimeout in Promise
- `sessions.service.test.ts` - Replace setTimeout(1)
- `settings.service.test.ts` - Replace setTimeout(50)

### 5. Fix HTTP Mocking

**Violation**: 2 files use `global.fetch = vi.fn()`
**CLAUDE.md principle**: "Use MSW for HTTP mocking"

**Specific fixes**:

```typescript
// ❌ WRONG - Direct fetch mocking
global.fetch = vi.fn((url) => {
  if (url === '/api/filesystem?action=current') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ currentDirectory: '/' })
    })
  }
})

// ✅ CORRECT - MSW handlers
import { server } from '../test-utils/msw-server'
import { http, HttpResponse } from 'msw'

beforeEach(() => {
  server.use(
    http.get('/api/filesystem', ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get('action') === 'current') {
        return HttpResponse.json({ currentDirectory: '/' })
      }
    })
  )
})
```

**Files to fix**:
- `homepage-image-upload.test.tsx` - Line 20
- `session-permissions-cycle.test.tsx` - Lines 96, 186

### 6. Fix DOM Manipulation

**Violation**: 4 files use `querySelector`
**CLAUDE.md principle**: "Use semantic queries, not DOM structure"

**Specific fixes**:

```typescript
// ❌ WRONG - DOM structure queries
const greenLine = element.querySelector('.bg-emerald-500')
const form = document.querySelector('form')
const svg = container.querySelector('svg')

// ✅ CORRECT - Semantic queries
const greenLine = screen.getByRole('progressbar')
const form = screen.getByRole('form', { name: 'Session creation' })
const icon = screen.getByRole('img', { name: 'Bash icon' })

// ✅ OR use data-testid for non-semantic elements
const greenLine = screen.getByTestId('green-line-indicator')
```

**Files to fix**:
- `green-line-indicator.test.tsx` - 6 querySelector calls
- `homepage-image-upload.test.tsx` - querySelector('form')
- `status-indicator.test.tsx` - querySelector('[data-testid]')
- `bash-tool-display.test.tsx` - querySelector('svg')

### 7. Stop Mocking Internal Services

**Violation**: 3 files mock internal services
**CLAUDE.md principle**: "Only mock external dependencies"

**Specific fixes**:

```typescript
// ❌ WRONG - Mocking internal services
vi.mock('../db/event-session.service')
vi.mock('../services/jobs.service')
import { handler } from '../workers/handlers/maintenance'

// ✅ CORRECT - Test through public APIs
// For routes: test through loader/action
const response = await loader({ request, params })

// For workers: test through job execution
await processJob(job)
```

**Files to fix**:
- `session-detail-loader.test.ts` - Remove mock of event-session.service
- `home-action.test.ts` - Remove mocks of jobs.service and job-types
- Handler tests - Test through job system, not direct imports

### 8. Use Semantic Testing Utilities

**Violation**: 16 files use basic queries
**CLAUDE.md principle**: "ALWAYS test behavior/accessibility"

**Specific fixes**:

```typescript
// ❌ WRONG - Basic queries
expect(screen.getByText('Submit')).toBeInTheDocument()
expect(screen.getByRole('button')).toBeDisabled()

// ✅ CORRECT - Semantic utilities
import { expectSemanticMarkup, expectContent, expectInteraction } from '../test-utils/component-testing'

expectSemanticMarkup.button('Submit')
expectInteraction.clickable(submitButton)
expectContent.text('Form submitted successfully')
```

**Files to fix**: All 16 files listed under "Missing Semantic Testing Utilities"

## Testing Philosophy Reminders

### What to Test
- User-visible behavior
- Public API contracts (routes, service functions)
- Error states and edge cases
- Accessibility requirements

### What NOT to Test
- Database schema structure
- Internal implementation details
- CSS classes or styling
- Private functions
- Framework behavior

### How to Test
- Use test factories for all test data
- Use semantic queries for DOM testing
- Use MSW for HTTP mocking
- Use service functions as the database API
- Wait for actual conditions, not arbitrary time

## Success Metrics

After implementing this plan:
- 0 critical violations (down from 3)
- 0 files testing implementation details (down from 5)
- 100% of tests using factories where applicable
- 0 tests checking CSS classes
- 0 tests using setTimeout
- 0 tests using global.fetch mocking
- 0 tests using querySelector
- 100% of component tests using semantic utilities

## Execution Order

1. **Day 1**: Delete the 5 files (immediate win)
2. **Day 2**: Create all missing test factories
3. **Day 3**: Fix HTTP mocking and setTimeout usage
4. **Day 4**: Fix CSS class testing and DOM queries
5. **Day 5**: Fix direct database access
6. **Day 6**: Add semantic testing utilities
7. **Day 7**: Remove internal service mocks

This plan will bring the test suite into full compliance with CLAUDE.md principles.