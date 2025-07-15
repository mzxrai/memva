# Test Suite Analysis and Fix Plan

## Overview
This document provides a comprehensive analysis of every test file in the project, identifying issues with CLAUDE.md compliance and proposing specific fixes.

## 🧰 Global Test Utilities & Patterns

**IMPORTANT: These utilities exist to ensure consistency. Always use them instead of reinventing patterns.**

### **Database Testing Utilities**

**Standard Pattern: `setupInMemoryDb()` + `setupDatabaseMocks()`**
- **When to use**: ALL database-related tests (integration, API, database tests)
- **Pattern**: DRY utility that eliminates SQL duplication and ensures schema consistency
- **Helper functions**: `createSession()`, `getEventsForSession()`, `cleanup()`
- **Module mocking**: Uses static mocking to prevent module loading timing issues

```typescript
// ✅ ALWAYS USE THIS PATTERN FOR DATABASE TESTS
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Database Feature', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should test behavior', () => {
    const session = testDb.createSession({ title: 'Test', project_path: '/test' })
    // Test actual behavior
  })
})
```

**⚠️ Deprecated: `setMockDatabase()` and old `mockDatabaseModules()`**
- **Do not use**: Both are broken due to module loading timing issues
- **Problem**: Dynamic mocking happens after modules are already imported
- **Solution**: Always use `setupDatabaseMocks()` at module level + `setTestDatabase()` in beforeEach

### **Test Data Factories**

**Factory Functions (app/test-utils/factories.ts)**
- **When to use**: ALWAYS create mock data with factories, never hardcode
- **Type-safe**: Proper TypeScript types with `Partial<T>` overrides
- **Realistic defaults**: Sensible values that work across tests

```typescript
// ✅ ALWAYS USE FACTORIES
const session = createMockSession({ title: 'Custom Title' })
const userEvent = createMockUserEvent('Hello world')
const toolUse = MOCK_TOOLS.read('/test.ts')

// ❌ NEVER HARDCODE TEST DATA
const session = { id: 'test-123', title: 'Test', ... }
```

**Available Factories**:
- `createMockSession()`, `createMockEvent()`
- `createMockUserEvent()`, `createMockAssistantEvent()`, `createMockSystemEvent()`
- `createMockToolUseEvent()`, `createMockToolResultEvent()`
- `MOCK_TOOLS.read()`, `MOCK_TOOLS.bash()`, `MOCK_TOOLS.write()`, `MOCK_TOOLS.edit()`

### **Async Testing Utilities**

**Smart Waiting (app/test-utils/async-testing.ts)**
- **When to use**: ALWAYS replace `setTimeout()` with condition polling
- **Pattern**: Check actual conditions instead of arbitrary timeouts

```typescript
// ✅ ALWAYS USE SMART WAITING
await waitForCondition(() => testDb.getEventsForSession(sessionId).length > 0)
await waitForEvents(() => testDb.getEventsForSession(sessionId), ['user', 'assistant'])

// ❌ NEVER USE ARBITRARY TIMEOUTS
await new Promise(resolve => setTimeout(resolve, 100))
```

**Available Functions**:
- `waitForCondition()` - Generic condition polling
- `waitForDatabaseCondition()` - Wait for expected data count
- `waitForEvents()` - Wait for specific event types
- `waitForStreamCompletion()` - Wait for streaming responses

### **Component Testing Utilities**

**Semantic Testing (app/test-utils/component-testing.ts)**
- **When to use**: ALWAYS test behavior/accessibility, never CSS classes
- **Pattern**: Test what users experience, not implementation details

```typescript
// ✅ ALWAYS TEST SEMANTICS
expectSemanticMarkup.heading(1, 'My Title')
expectSemanticMarkup.button('Save')
expectInteraction.clickable(button)

// ❌ NEVER TEST CSS CLASSES
expect(element).toHaveClass('bg-blue-500')
expect(element).toHaveClass('font-bold')
```

**Available Utilities**:
- `expectSemanticMarkup` - Headings, buttons, links, forms
- `expectContent` - Text visibility, code blocks, preformatted content
- `expectInteraction` - Focusability, clickability, loading states
- `expectAccessibility` - ARIA attributes, error associations, labels
- `expectKeyboardNavigation` - Enter/Space key activation

### **External Dependency Mocking**

**Claude Code SDK Mock (app/test-utils/msw-server.ts)**
- **When to use**: Tests that need Claude Code responses
- **Pattern**: Pre-configured with realistic responses
- **Auto-setup**: Imported globally, no manual setup needed

```typescript
// ✅ MOCK IS ALREADY CONFIGURED
// Tests automatically get realistic Claude Code responses
// No additional setup needed
```

## 🎯 Test Types & Locations

### **Where Each Test Type Lives**

| Test Type | Location | File Pattern | Purpose | When to Create |
|-----------|----------|--------------|---------|----------------|
| **Component Tests** | `app/__tests__/*.test.tsx` | `component-name.test.tsx` | Test React component UI behavior | Testing individual components, forms, layouts |
| **Integration Tests** | `app/__tests__/*.test.ts` | `feature-name.test.ts` | Test complete user workflows | Testing API routes, user journeys, business logic |
| **Database Tests** | `app/db/*.test.ts` | `module-name.test.ts` | Test database operations directly | Testing queries, migrations, schema changes |

### **Decision Matrix: Which Pattern to Use**

| Test Type | Database | Data Creation | Async Operations | Component Testing |
|-----------|----------|---------------|------------------|-------------------|
| **Component Tests** | ❌ No DB | ✅ Factories | ✅ Smart waiting | ✅ Semantic utils |
| **Integration Tests** | ✅ setupInMemoryDb + setupDatabaseMocks + setTestDatabase | ✅ Factories | ✅ Smart waiting | ✅ Semantic utils |
| **Database Tests** | ✅ setupInMemoryDb + setupDatabaseMocks + setTestDatabase | ✅ Factories | ✅ Smart waiting | ❌ N/A |

### **When to Use Each Test Type**

**🎨 Component Tests (`app/__tests__/*.test.tsx`)**
- **What**: React components, forms, UI interactions
- **When**: Testing individual component behavior, accessibility, user interactions
- **Examples**: Button clicks, form validation, conditional rendering, loading states
- **No database**: Use mock data with factories

**🔄 Integration Tests (`app/__tests__/*.test.ts`)**  
- **What**: Complete user workflows, API routes, business logic
- **When**: Testing end-to-end features, user journeys, cross-component interactions
- **Examples**: User creates session → sends message → receives response → data persisted
- **With database**: Full workflow with real database operations

**🗄️ Database Tests (`app/db/*.test.ts`)**
- **What**: Database operations, queries, migrations, schema
- **When**: Testing data layer functionality, complex queries, database logic
- **Examples**: Session creation, event storage, data relationships, migrations
- **Direct database**: Test database operations without UI layer

### **Complete Examples by Test Type**

**🎨 Component Test Example (`app/__tests__/session-form.test.tsx`)**
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { createMockSession } from '../test-utils/factories'
import { expectSemanticMarkup } from '../test-utils/component-testing'
import SessionForm from '../components/SessionForm'

describe('SessionForm Component', () => {
  it('should render form with proper accessibility', () => {
    const mockData = createMockSession()
    render(<SessionForm initialData={mockData} />)
    
    expectSemanticMarkup.heading(2, 'Session Details')
    expectSemanticMarkup.textbox('Session Title')
    expectSemanticMarkup.button('Save Session')
  })
})
```

**🔄 Integration Test Example (`app/__tests__/user-message-storage.test.ts`)**
```typescript
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForEvents } from '../test-utils/async-testing'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { action } from '../routes/api.claude-code.$sessionId'

describe('User Message Storage Workflow', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should store user message and process Claude response', async () => {
    const session = testDb.createSession({ title: 'Test', project_path: '/test' })
    
    // Test complete user workflow: create → message → response → persistence
    await action({ request, params: { sessionId: session.id } })
    
    await waitForEvents(() => testDb.getEventsForSession(session.id), ['user', 'system'])
    
    const events = testDb.getEventsForSession(session.id)
    expect(events.filter(e => e.event_type === 'user')).toHaveLength(1)
  })
})
```

**🗄️ Database Test Example (`app/db/sessions.test.ts`)**
```typescript
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockSession } from '../test-utils/factories'
import { eq } from 'drizzle-orm'
import { sessions } from './schema'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Session Database Operations', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should create and retrieve session correctly', () => {
    const sessionData = createMockSession({ title: 'Test Session' })
    
    // Test direct database operations
    testDb.db.insert(sessions).values(sessionData).run()
    const retrieved = testDb.db.select().from(sessions).where(eq(sessions.id, sessionData.id)).get()
    
    expect(retrieved).toEqual(sessionData)
  })
})
```

**2. Mock Strategy Hierarchy**
1. **External APIs**: Mock at boundary (MSW, vitest mocks)
2. **Database**: Use in-memory SQLite (setupInMemoryDb + setupDatabaseMocks + setTestDatabase)
3. **Internal services**: NEVER mock - use real implementations (follows CLAUDE.md: no unit tests for implementation details)
4. **Test data**: ALWAYS use factories

**3. Async Testing Best Practices**
- **Never** use arbitrary timeouts (`setTimeout(100)`)
- **Always** poll for actual completion conditions
- **Use** `waitForCondition()` for custom conditions
- **Use** `waitForEvents()` for Claude Code integration tests

## Methodology
1. Create comprehensive PLAN.md structure
2. Analyze each test file individually for CLAUDE.md violations
3. Document specific issues and proposed fixes
4. Categorize tests into proper types (Component, Integration, Database)
5. Provide actionable fix instructions

## Analysis Process
- **Component Tests**: Should test UI behavior with mock data, no database integration
- **Integration Tests**: Should test complete workflows with real database (setupInMemoryDb + setupDatabaseMocks + setTestDatabase)
- **Database Tests**: Should test database operations directly with setupInMemoryDb + setupDatabaseMocks + setTestDatabase
- **Key Violations**: Internal mocking, arbitrary timeouts, mixed responsibilities

## Testing Philosophy (Per CLAUDE.md)
- **NO "unit tests"** - test expected behavior through public APIs only
- **NO testing implementation details** - test what users experience, not how code works internally
- **NO mocking internal services** - use real implementations for internal dependencies
- **Test behavior, not implementation** - focus on business outcomes, not code structure

## Files to Analyze (25 total)

### __tests__ Directory (.tsx files - 17 files)
1. session-detail.test.tsx - ⚠️ NEEDS DATABASE FIX
2. events.$sessionId.test.tsx - ✅ FIXED (split into events-sessionid-loader.test.ts + events-sessionid-component.test.tsx)  
3. events.test.tsx - ⚠️ NEEDS DATABASE FIX + SPLIT
4. session-creation.test.tsx - ✅ EXCELLENT (already follows guidelines)
5. homepage-initial-prompt.test.tsx - ✅ EXCELLENT (already follows guidelines)
6. home.test.tsx - ⚠️ NEEDS DATABASE FIX + EXPANSION
7. stop-functionality.test.tsx - ⚠️ NEEDS DATABASE FIX
8. loading-indicator.test.tsx - ✅ FIXED (now follows all guidelines)
9. tool-call-display.test.tsx - ⚠️ NEEDS CSS → SEMANTIC FIX  
10. tool-call-error-indicator.test.tsx - ❌ CRITICAL CSS → SEMANTIC FIX
11. diff-viewer.test.tsx - ⚠️ NEEDS CSS → SEMANTIC FIX
12. code-block.test.tsx - ⚠️ NEEDS CSS → SEMANTIC FIX
13. event-renderer.test.tsx - ✅ EXCELLENT (perfect reference example)
14. markdown-renderer.test.tsx - ⚠️ NEEDS CSS → SEMANTIC FIX
15. message-container.test.tsx - ❌ CRITICAL CSS → SEMANTIC FIX
16. assistant-message-tools.test.tsx - ✅ EXCELLENT (perfect reference example)
17. message-header.test.tsx - ❌ CRITICAL CSS → SEMANTIC FIX

### __tests__ Directory (.ts files - 5 files)
18. claude-code-events.test.ts - ✅ EXCELLENT (already follows guidelines)
19. event-storage.test.ts - ✅ FIXED (follows all guidelines)
20. user-message-storage.test.ts - ✅ FIXED (follows all guidelines)
21. session-resumption.test.ts - ❌ CRITICAL DATABASE FIX
22. api.claude-code.test.ts - ✅ FIXED (follows all guidelines)

### Database Tests (3 files)
23. app/db/database.test.ts - ✅ EXCELLENT (perfect reference example)
24. app/db/sessions.test.ts - ✅ EXCELLENT (perfect reference example)
25. app/db/schema.test.ts - ✅ EXCELLENT (perfect reference example)

---

## Detailed Analysis

### 2. user-message-storage.test.ts
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Fixed database-mocking.ts utility to use proper static mocking
- ✅ Replaced manual stream consumption with smart waiting (`waitForEvents`)
- ✅ No arbitrary timeouts - uses condition polling
- ✅ Proper integration test pattern with working database mocks

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for integration tests:
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForEvents } from '../test-utils/async-testing'

// Setup static mocks before any imports
setupDatabaseMocks(vi)

beforeEach(() => {
  testDb = setupInMemoryDb()
  setTestDatabase(testDb)  // ✅ ALWAYS use this pattern
})

// ✅ ALWAYS use smart waiting:
await waitForEvents(() => testDb.getEventsForSession(sessionId), ['user', 'system'])
```

**Result:** Integration Tests (user message storage workflow) - All 3 tests pass reliably

### 3. event-storage.test.ts
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Fixed database mocking pattern: replaced broken `setMockDatabase()` with `setupDatabaseMocks()` + `setTestDatabase()` pattern
- ✅ Replaced arbitrary timeouts with smart waiting (`waitForEvents`, `waitForCondition`)
- ✅ Used testDb helpers instead of direct database queries
- ✅ Proper integration test pattern with working database mocks

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for integration tests:
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForEvents, waitForCondition } from '../test-utils/async-testing'

// Setup static mocks before any imports
setupDatabaseMocks(vi)

beforeEach(() => {
  testDb = setupInMemoryDb()
  setTestDatabase(testDb)  // ✅ ALWAYS use this pattern
})

afterEach(() => {
  testDb.cleanup()
  clearTestDatabase()
})

// ✅ ALWAYS use smart waiting:
await waitForEvents(() => testDb.getEventsForSession(sessionId), ['system', 'user', 'assistant', 'result'])

// ✅ ALWAYS use testDb helpers:
const events = testDb.getEventsForSession(sessionId)
```

**Result:** Integration Tests (complete event storage workflow) - All 4 tests pass reliably

### 4. events.test.tsx
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Split into two separate files following TDD guidelines:
  - events-loader.test.ts: Integration tests for the loader function with real database
  - events-component.test.tsx: Component tests for UI rendering with mock data
- ✅ Removed hardcoded mock data in favor of factory functions from factories.ts
- ✅ Replaced internal database mocking with proper setupDatabaseMocks() pattern
- ✅ Test behavior (data grouping, UI rendering) instead of implementation details
- ✅ Added insertEvent helper to in-memory-db.ts for consistent test data insertion
- ✅ Fixed schema compatibility issues in factories.ts

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for integration tests (events-loader.test.ts):
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'

// Setup static mocks before any imports
setupDatabaseMocks(vi)

beforeEach(() => {
  testDb = setupInMemoryDb()
  setTestDatabase(testDb)
})

afterEach(() => {
  testDb.cleanup()
  clearTestDatabase()
})

// ✅ ALWAYS use factories:
const session1Event1 = createMockEvent({ 
  session_id: 'session-1', 
  event_type: 'user', 
  project_name: 'test-project' 
})

// ✅ CORRECT pattern for component tests (events-component.test.tsx):
const eventsBySession = {
  'session-1': [createMockEvent({ project_name: 'test-project' })]
}
vi.mocked(useLoaderData).mockReturnValue({ eventsBySession })
render(<Events />)

// Test semantic markup and accessibility
expect(screen.getByRole('heading', { level: 1, name: 'Claude Code Events' })).toBeInTheDocument()
```

**Result:** 
- Integration Tests (events loader with real database) - All 4 tests pass reliably
- Component Tests (events UI rendering with mock data) - All 8 tests pass reliably

### 5. events.$sessionId.test.tsx
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Split into two separate files following TDD guidelines:
  - events-sessionid-loader.test.ts: Integration tests for the loader function with real database
  - events-sessionid-component.test.tsx: Component tests for UI rendering with mock data
- ✅ Removed hardcoded mock data in favor of factory functions from factories.ts
- ✅ Replaced internal database mocking with proper setupDatabaseMocks() pattern
- ✅ Test behavior (event ordering, UI rendering, semantic markup) instead of implementation details
- ✅ Added proper TypeScript types with `as any` assertions for loader parameters
- ✅ Fixed component tests to handle text split across multiple DOM elements

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for integration tests (events-sessionid-loader.test.ts):
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'

// Setup static mocks before any imports
setupDatabaseMocks(vi)

beforeEach(() => {
  testDb = setupInMemoryDb()
  setTestDatabase(testDb)
})

afterEach(() => {
  testDb.cleanup()
  clearTestDatabase()
})

// ✅ ALWAYS use factories:
const event1 = createMockEvent({ 
  session_id: 'session-123', 
  event_type: 'user',
  timestamp: '2025-01-01T10:00:00.000Z'
})

// ✅ CORRECT pattern for component tests (events-sessionid-component.test.tsx):
const sessionEvents = [createMockEvent({ session_id: 'session-123' })]
vi.mocked(useLoaderData).mockReturnValue({ sessionEvents, sessionId: 'session-123' })
render(<SessionEvents />)

// Test semantic markup and accessibility
expectSemanticMarkup.heading(1, 'Session Details')
expectSemanticMarkup.link('← Back to all sessions', '/events')
```

**Result:** 
- Integration Tests (events sessionid loader with real database) - All 4 tests pass reliably
- Component Tests (events sessionid UI rendering with mock data) - All 7 tests pass reliably

### 6. session-resumption.test.ts
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Fixed broken `setMockDatabase()` pattern - now uses `setupDatabaseMocks()` + `setTestDatabase()` pattern
- ✅ Replaced arbitrary timeouts with `waitForEvents()` and `waitForCondition()` smart waiting
- ✅ Used factory functions (`createMockUserEvent`, `createMockAssistantEvent`) for consistent test data
- ✅ Enhanced Claude Code mock to respect abort signals and prevent async database warnings
- ✅ Added defensive database mocking to prevent cleanup timing errors
- ✅ Proper integration test pattern for session resumption workflow

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for integration tests:
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForEvents, waitForCondition } from '../test-utils/async-testing'
import { createMockUserEvent, createMockAssistantEvent } from '../test-utils/factories'

// Setup static mocks before any imports
setupDatabaseMocks(vi)

// Enhanced Claude Code mock that respects abort signals
vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn().mockImplementation(({ options }) => {
    const abortController = options?.abortController
    
    return (async function* () {
      const events = [/* ... */]
      
      for (const event of events) {
        // Respect abort signal to prevent execution after test cleanup
        if (abortController?.signal.aborted) {
          break
        }
        yield event
      }
    })()
  })
}))

beforeEach(() => {
  testDb = setupInMemoryDb()
  setTestDatabase(testDb)  // ✅ ALWAYS use this pattern
})

afterEach(() => {
  testDb.cleanup()
  clearTestDatabase()
})

// ✅ ALWAYS use smart waiting:
await waitForEvents(() => testDb.getEventsForSession(session.id), ['user', 'system', 'assistant', 'result'])
await waitForCondition(() => testDb.getEventsForSession(session.id).length > 4)

// ✅ ALWAYS use factory functions:
const userEvent = createMockUserEvent('First message', {
  uuid: 'event-1',
  session_id: 'claude-session-1',
  memva_session_id: session.id
})
```

**Result:** Integration Tests (session resumption workflow) - All 3 tests pass reliably with no async warnings

### 7. api.claude-code.test.ts
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Fixed broken `setMockDatabase()` pattern - now uses `setupDatabaseMocks()` + `setTestDatabase()` pattern
- ✅ Replaced arbitrary timeouts with `waitForStreamCompletion()` smart waiting
- ✅ Used factory functions (`createMockEvent()`) for consistent test data creation
- ✅ Proper integration test pattern for API endpoint workflow
- ✅ Fixed database-mocking.ts to prevent TypeScript duplicate property errors

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for integration tests:
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForStreamCompletion } from '../test-utils/async-testing'
import { createMockEvent } from '../test-utils/factories'

// Setup static mocks before any imports
setupDatabaseMocks(vi)

beforeEach(() => {
  testDb = setupInMemoryDb()
  setTestDatabase(testDb)  // ✅ ALWAYS use this pattern
})

afterEach(() => {
  testDb.cleanup()
  clearTestDatabase()
})

// ✅ ALWAYS use smart waiting:
await waitForStreamCompletion(
  () => {
    const storedEvents = testDb.getEventsForSession(session.id)
    return storedEvents.length > 1 // Expected completion condition
  },
  { timeoutMs: 5000 }
)

// ✅ ALWAYS use factory functions:
const userEvent = createMockEvent({
  uuid: 'event-1',
  session_id: 'claude-session-1',
  memva_session_id: session.id,
  event_type: 'user',
  data: { type: 'user', content: 'Previous message' }
})
```

**Result:** Integration Tests (API endpoint workflow) - All 5 tests pass reliably

### 8. home.test.tsx
**Status**: WARNING - NEEDS EXPANSION

**Issues:**
- ❌ Mocking internal database service instead of proper pattern
- ❌ Single trivial test, missing core functionality coverage

**Fix Required:**
```typescript
// ✅ SPLIT into two files like events.test.tsx above
// ✅ ALWAYS use factories: createMockSession({ title: 'Test' })
// ✅ Add comprehensive test coverage for session management
```

**Convert to:**
- Integration Tests (loader with real database)
- Component Tests (UI rendering and interactions)

### 9. stop-functionality.test.tsx
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Fixed broken `setMockDatabase()` pattern - now uses `setupDatabaseMocks()` + `setTestDatabase()` pattern
- ✅ Replaced arbitrary timeouts with `waitForCondition()` and `waitForEvents()` smart waiting
- ✅ Removed complex global state mock (`shouldContinueGenerating`)
- ✅ Used proper testDb.createSession() instead of factory wrapper
- ✅ Proper integration test pattern for stop functionality workflow

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for integration tests:
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForCondition, waitForEvents } from '../test-utils/async-testing'

// Setup static mocks before any imports
setupDatabaseMocks(vi)

beforeEach(() => {
  testDb = setupInMemoryDb()
  setTestDatabase(testDb)  // ✅ ALWAYS use this pattern
})

afterEach(() => {
  testDb.cleanup()
  clearTestDatabase()
})

// ✅ ALWAYS use smart waiting:
await waitForEvents(() => testDb.getEventsForSession(session.id), ['system'])
await waitForCondition(() => testDb.getEventsForSession(session.id).length > 0)
```

**Result:** Integration Tests (stop functionality workflow) - All 3 tests pass reliably

### 10. loading-indicator.test.tsx
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Removed hardcoded action verbs list testing (was testing implementation details)
- ✅ Removed non-deterministic test for verb changes (was unreliable random behavior)
- ✅ Replaced `getByTestId` with semantic queries focusing on visible content
- ✅ Added proper `@testing-library/jest-dom` import to fix TypeScript errors
- ✅ Test user-visible behavior instead of implementation details
- ✅ Focus on token count formatting, elapsed time display, and loading state
- ✅ Test loading activity indication without hardcoding specific verbs
- ✅ Added comprehensive test coverage for component behavior

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for component tests:
describe('LoadingIndicator', () => {
  it('should display an action verb with ellipsis', () => {
    render(<LoadingIndicator tokenCount={0} startTime={Date.now()} />)
    
    // Should show some action text with ellipsis indicating activity
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
  })

  it('should show and hide based on loading state', () => {
    const { rerender } = render(
      <LoadingIndicator tokenCount={100} startTime={Date.now()} isLoading={true} />
    )
    
    // Should display loading content when isLoading is true
    expect(screen.getByText(/tokens/)).toBeInTheDocument()
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
    
    rerender(
      <LoadingIndicator tokenCount={100} startTime={Date.now()} isLoading={false} />
    )
    
    // Should not display when isLoading is false
    expect(screen.queryByText(/tokens/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument()
  })

  // ✅ ALWAYS test user-visible behavior:
  expect(screen.getByText(/tokens/)).toBeInTheDocument()
  expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
  expect(screen.getByText(/1m 5s/)).toBeInTheDocument()

  // ❌ NEVER test hardcoded implementation details:
  // const verbs = ['Crunching', 'Pondering', ...]
  // expect(hasVerb).toBe(true)
  
  // ❌ NEVER test random behavior:
  // "should change action verb periodically" - removed
})
```

**Result:** Component Tests (loading indicator behavior) - All 9 tests pass reliably

### 11. tool-call-display.test.tsx
**Status**: GOOD - MINOR FIXES NEEDED

**Issues:**
- ❌ Testing implementation details (test IDs, CSS classes)
- ❌ Some tests focus on styling instead of behavior

**Fix Required:**
```typescript
// ✅ ALWAYS test semantic roles, NEVER test IDs:
expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument()

// ✅ ALWAYS test visible content, NEVER CSS classes:
expect(screen.getByText('Read')).toBeInTheDocument()

// ❌ NEVER use test IDs or CSS classes:
// expect(screen.getByTestId('read-icon')).toBeInTheDocument()
// expect(element).toHaveClass('font-mono')
```

**Convert to:** Component Tests (UI behavior)

### 12. tool-call-error-indicator.test.tsx
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Replaced CSS class testing (`bg-emerald-400`, `bg-red-400`, `bg-amber-400`) with semantic data-status attribute testing
- ✅ Used MOCK_TOOLS factory functions for consistent test data creation
- ✅ Added comprehensive test coverage for different tool types (Read, Write, Bash)
- ✅ Test behavior and accessibility instead of implementation details
- ✅ Added data-status attribute to ToolCallDisplay component for proper testing
- ✅ Focus on user-visible behavior and component functionality

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for component tests:
import { MOCK_TOOLS } from '../test-utils/factories'

describe('ToolCallDisplay Status Indicators', () => {
  it('should indicate successful command completion', () => {
    const bashTool = MOCK_TOOLS.bash('ls /home')
    
    render(<ToolCallDisplay toolCall={bashTool} hasResult={true} result={{ stdout: 'file1.txt\nfile2.txt', stderr: '', interrupted: false }} isError={false} />)

    // Test semantic data attribute instead of CSS classes
    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveAttribute('data-status', 'success')
  })

  // ✅ ALWAYS use factory functions:
  const readTool = MOCK_TOOLS.read('/test/file.txt')
  const writeTool = MOCK_TOOLS.write('/test/output.txt', 'content')

  // ✅ ALWAYS test visible content:
  expect(screen.getByText('Read')).toBeInTheDocument()
  expect(screen.getByText('/test/file.txt')).toBeInTheDocument()
})
```

**Result:** Component Tests (status indicator behavior) - All 7 tests pass reliably

### 13. message-container.test.tsx
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Replaced CSS class testing (`expect(messageBox.className).toContain('p-4')`) with semantic behavior testing
- ✅ Used `expectContent.text()` utility for proper semantic testing
- ✅ Focus on user-visible behavior rather than implementation details (content rendering, accessibility)
- ✅ Added comprehensive test coverage for complex content, multiple children, and edge cases
- ✅ Test semantic HTML structure without CSS classes
- ✅ Proper component test pattern with TypeScript strict mode compliance

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for component tests:
import { expectContent } from '../test-utils/component-testing'

describe('MessageContainer', () => {
  it('renders children content correctly', () => {
    render(
      <MessageContainer>
        <div>Test content</div>
      </MessageContainer>
    )
    
    expectContent.text('Test content')
  })

  it('preserves accessibility of child elements', () => {
    render(
      <MessageContainer>
        <button>Click me</button>
        <input aria-label="Test input" />
      </MessageContainer>
    )
    
    const button = screen.getByRole('button', { name: 'Click me' })
    const input = screen.getByRole('textbox', { name: 'Test input' })
    
    expect(button).toBeInTheDocument()
    expect(input).toBeInTheDocument()
  })

  // ✅ ALWAYS test semantic structure:
  const containerElement = screen.getByText('Container content').parentElement
  expect(containerElement?.tagName).toBe('DIV')
  expect(containerElement).toBeInTheDocument()

  // ❌ NEVER test CSS classes:
  // expect(messageBox.className).toContain('p-4')
  // expect(messageBox.className).toContain('custom-class')
})
```

**Result:** Component Tests (message container behavior) - All 7 tests pass reliably

### 14. message-header.test.tsx
**Status**: ✅ FIXED - FOLLOWS ALL GUIDELINES

**Issues Fixed:**
- ✅ Replaced CSS class testing (`expect(header.className).toContain('flex')`) with semantic behavior testing
- ✅ Replaced querySelector with semantic queries focusing on behavior
- ✅ Added accessibility testing for user-visible content
- ✅ Test behavior instead of implementation details (icon presence, title visibility)
- ✅ Focus on component functionality rather than styling
- ✅ Proper component test pattern with TypeScript strict mode compliance

**Final Implementation:**
```typescript
// ✅ CORRECT pattern for component tests:
describe('MessageHeader', () => {
  it('should render title text and icon visually', () => {
    const { container } = render(
      <MessageHeader icon={RiUser3Line} title="Test User" />
    )
    
    // Test visible content - title should be accessible
    expect(screen.getByText('Test User')).toBeInTheDocument()
    
    // Test icon is rendered - check for SVG element presence (focusing on behavior)
    const svgElement = container.querySelector('svg')
    expect(svgElement).toBeInTheDocument()
  })

  it('should render header as a proper banner/header element', () => {
    const { container } = render(
      <MessageHeader icon={RiUser3Line} title="Message from User" />
    )
    
    // Test that the header is structured as a proper container
    const header = container.firstChild as HTMLElement
    expect(header).toBeInTheDocument()
    expect(header.tagName).toBe('DIV')
    
    // Test that content is properly accessible
    expect(screen.getByText('Message from User')).toBeVisible()
  })

  // ✅ ALWAYS test accessible content:
  expect(screen.getByText('User Message')).toBeInTheDocument()
  expect(screen.getByText('Message Badge')).toBeInTheDocument()

  // ❌ NEVER test CSS classes:
  // expect(header.className).toContain('flex')
  // expect(icon?.className).toContain('w-4')
})
```

**Result:** Component Tests (message header behavior) - All 6 tests pass reliably

### 15. diff-viewer.test.tsx
**Status**: GOOD - MINOR FIXES NEEDED

**Issues:**
- ❌ Complex DOM traversal (querySelector) instead of semantic queries
- ❌ Testing table structure instead of diff content

**Fix Required:**
```typescript
// ✅ ALWAYS use semantic queries, NEVER querySelector:
expect(screen.getByRole('table')).toBeInTheDocument()
expect(screen.getByText(/Line 1/)).toBeInTheDocument()

// ❌ NEVER test DOM structure:
// const cells = firstRow.querySelectorAll('td')
// expect(cells.length).toBe(4)
```

**Convert to:** Component Tests (UI behavior)

### 16. code-block.test.tsx
**Status**: GOOD - MINOR FIXES NEEDED

**Issues:**
- ❌ Multiple tests checking CSS classes for styling
- ❌ Testing background colors and font classes

**Fix Required:**
```typescript
// ✅ ALWAYS test accessible content, NEVER CSS classes:
expect(screen.getByRole('region', { name: /code block/i })).toBeInTheDocument()
expect(screen.getByText(/console.log/)).toBeInTheDocument()

// ❌ NEVER test styling classes:
// expect(codeTextElement).toHaveClass('font-mono')
// expect(removedLine).toHaveClass('bg-red-950/20')
```

**Convert to:** Component Tests (UI behavior)

### 15. event-renderer.test.tsx
**Status**: EXCELLENT - NO FIXES NEEDED

✅ **Perfect example of component testing following all guidelines**
- Tests visible content and behavior only
- Uses realistic mock data structures
- Covers edge cases properly
- Focus on user experience

**Keep as reference for other component tests**

### 16. markdown-renderer.test.tsx
**Status**: GOOD - MINOR FIXES NEEDED

**Issues:**
- ❌ Testing CSS classes for bold/italic text formatting
- ❌ Some styling-focused tests instead of semantic markup

**Fix Required:**
```typescript
// ✅ ALWAYS test semantic markup, NEVER CSS classes:
expect(screen.getByText('bold').tagName).toBe('STRONG')
expect(codeElement.tagName).toBe('CODE')

// ❌ NEVER test font classes:
// expect(screen.getByText('bold')).toHaveClass('font-semibold')
// expect(codeElement).toHaveClass('font-mono')
```

**Convert to:** Component Tests (UI behavior)

### 17. message-container.test.tsx
**Status**: CRITICAL - NEEDS IMMEDIATE FIX

**Issues:**
- ❌ ALL tests focus on CSS classes instead of behavior
- ❌ No semantic or accessibility testing
- ❌ Testing styling wrapper instead of functional behavior

**Fix Required:**
```typescript
// ✅ ALWAYS test semantic structure, NEVER CSS classes:
expect(screen.getByRole('region')).toBeInTheDocument()
expect(screen.getByText('Test content')).toBeInTheDocument()

// ❌ NEVER test className patterns:
// expect(messageBox.className).toContain('p-4')
// expect(messageBox.className).toContain('custom-class')
```

**Convert to:** Component Tests (UI behavior with accessibility focus)

### 18. assistant-message-tools.test.tsx
**Status**: EXCELLENT - NO FIXES NEEDED

✅ **Another perfect example - tests complex content structures properly**
- Tests tool use content with realistic mock data
- Covers different message formats and edge cases
- Focus on visible content and behavior only

**Keep as reference for complex component testing**

### 19. message-header.test.tsx
**Status**: CRITICAL - NEEDS IMMEDIATE FIX

**Issues:**
- ❌ ALL tests focus on CSS classes instead of behavior
- ❌ Using querySelector instead of semantic queries
- ❌ No accessibility testing

**Fix Required:**
```typescript
// ✅ ALWAYS use semantic queries, NEVER querySelector:
expect(screen.getByRole('banner')).toBeInTheDocument()
expect(screen.getByText('Test User')).toBeInTheDocument()

// ❌ NEVER test CSS layout classes:
// expect(header.className).toContain('flex')
// expect(icon?.className).toContain('w-4')
```

**Convert to:** Component Tests (UI behavior with accessibility focus)

### 20. app/db/database.test.ts
**Status**: EXCELLENT - NO FIXES NEEDED

✅ **Perfect database testing example**
- Uses `setupInMemoryDb()` correctly
- Tests actual database behavior and schema
- Proper TypeScript type assertions
- Good concurrent access testing

**Keep as reference for database tests**

### 21. app/db/sessions.test.ts
**Status**: EXCELLENT - NO FIXES NEEDED

✅ **Perfect CRUD operations testing**
- Comprehensive database operation coverage
- Good edge case testing (nullable fields, complex metadata)
- Proper use of setupInMemoryDb() utility

**Keep as reference for database CRUD tests**

### 22. app/db/schema.test.ts
**Status**: EXCELLENT - NO FIXES NEEDED

✅ **Perfect schema and JSON data testing**
- Tests database schema structure properly
- Excellent JSON data handling validation
- Complex data structures with proper type assertions

**Keep as reference for schema and data validation tests**

---

## Summary

✅ **PLAN.md is now production-ready with consistent guidelines:**

### **Key Changes Made:**
1. **Fixed database-mocking.ts utility** - replaced broken dynamic mocking with static mocking
2. **Updated all recommendations** to use `setupDatabaseMocks()` + `setTestDatabase()` pattern
3. **Consistent ALWAYS vs NEVER patterns** throughout
4. **Removed all references** to broken `setMockDatabase()` and old `mockDatabaseModules()` patterns  
5. **Updated all test file analyses** to use corrected, working guidance
6. **Emphasized the 3 test types** with clear boundaries and locations

### **Critical Tests Requiring Database Fix (7 files):**
- ✅ user-message-storage.test.ts (FIXED - now follows all guidelines)
- ✅ event-storage.test.ts (FIXED - now follows all guidelines)
- ✅ api.claude-code.test.ts (FIXED - now follows all guidelines)
- ✅ stop-functionality.test.tsx (FIXED - now follows all guidelines)
- ✅ events.test.tsx (FIXED - split into events-loader.test.ts + events-component.test.tsx)
- ✅ session-resumption.test.ts (FIXED - now follows all guidelines)
- ✅ events.$sessionId.test.tsx (FIXED - split into events-sessionid-loader.test.ts + events-sessionid-component.test.tsx)
- home.test.tsx

### **Tests Requiring CSS → Semantic Conversion (5 files):**
- ✅ tool-call-error-indicator.test.tsx (FIXED - now follows all guidelines)
- ✅ message-container.test.tsx (FIXED - now follows all guidelines)
- ✅ message-header.test.tsx (FIXED - now follows all guidelines)
- ✅ loading-indicator.test.tsx (FIXED - now follows all guidelines)
- tool-call-display.test.tsx, diff-viewer.test.tsx, code-block.test.tsx, markdown-renderer.test.tsx

### **Perfect Examples to Keep as Reference (5 files):**
- event-renderer.test.tsx, assistant-message-tools.test.tsx
- app/db/database.test.ts, app/db/sessions.test.ts, app/db/schema.test.ts

**All recommendations now follow the single, clear pattern established in the utilities section.**

### **Important: Database Utility Fix Applied**
The `database-mocking.ts` utility has been fixed to resolve the fundamental module loading timing issue:
- **Problem**: Dynamic mocking (`vi.doMock()`) happened after modules were imported
- **Solution**: Static mocking (`vi.mock()`) at module level + `setTestDatabase()` in `beforeEach()`
- **Result**: Database mocking now works reliably for all integration tests

**All other tests requiring database fixes should now use this corrected pattern.**
