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
2. events.$sessionId.test.tsx - ⚠️ NEEDS DATABASE FIX + SPLIT  
3. events.test.tsx - ⚠️ NEEDS DATABASE FIX + SPLIT
4. session-creation.test.tsx - ✅ EXCELLENT (already follows guidelines)
5. homepage-initial-prompt.test.tsx - ✅ EXCELLENT (already follows guidelines)
6. home.test.tsx - ⚠️ NEEDS DATABASE FIX + EXPANSION
7. stop-functionality.test.tsx - ⚠️ NEEDS DATABASE FIX
8. loading-indicator.test.tsx - ⚠️ NEEDS CSS → SEMANTIC FIX
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
**Status**: CRITICAL - NEEDS IMMEDIATE FIX

**Issues:**
- ❌ Mocking internal database module instead of using standard pattern
- ❌ Testing implementation details (database query chains)
- ❌ Mixed component and integration testing in same file
- ❌ Hardcoded mock data instead of factory functions

**Fix Required:**
```typescript
// ✅ SPLIT into two separate files:

// events-loader.test.ts (integration):
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

// events-component.test.tsx (component):
const mockData = createMockSession({ title: 'Test' })
vi.mocked(useLoaderData).mockReturnValue({ eventsBySession: mockData })
render(<Events />)

// ✅ ALWAYS use factories, NEVER hardcode:
const events = createMockEvent({ event_type: 'user', data: { content: 'Hello' } })
```

**Convert to:** 
- Integration Tests (loader with real database)
- Component Tests (UI with mock data)

### 5. events.$sessionId.test.tsx
**Status**: CRITICAL - NEEDS IMMEDIATE FIX

**Issues:**
- ❌ Same as events.test.tsx - mocking internals, testing implementation details
- ❌ Using `any` types instead of proper TypeScript
- ❌ Mixed component and integration testing

**Fix Required:** Same pattern as events.test.tsx above

**Convert to:**
- Integration Tests (loader with real database)  
- Component Tests (UI with mock data)

### 6. session-resumption.test.ts
**Status**: CRITICAL - NEEDS IMMEDIATE FIX

**Issues:**
- ❌ Using broken `setMockDatabase()` pattern
- ❌ Arbitrary timeouts (100ms) instead of condition polling
- ❌ Direct database inserts instead of testDb helpers

**Fix Required:** Same pattern as user-message-storage.test.ts above

**Convert to:** Integration Tests (session resumption workflow)

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
**Status**: CRITICAL - NEEDS IMMEDIATE FIX

**Issues:**
- ❌ Using broken `setMockDatabase()` pattern
- ❌ Multiple arbitrary timeouts (150ms, 100ms, 200ms)
- ❌ Complex mock with global state (`shouldContinueGenerating`)

**Fix Required:** Same pattern as user-message-storage.test.ts above

**Convert to:** Integration Tests (stop functionality workflow)

### 10. loading-indicator.test.tsx
**Status**: GOOD - MINOR FIXES NEEDED

**Issues:**
- ❌ Testing implementation details (hardcoded action verbs list)
- ❌ Non-deterministic test with random behavior
- ❌ Incomplete test coverage

**Fix Required:**
```typescript
// ✅ ALWAYS test user-visible behavior, NEVER hardcoded lists:
expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
expect(screen.getByText(/tokens/)).toBeInTheDocument()

// ❌ NEVER test random behavior:
// Remove non-deterministic "should change action verb periodically" test
```

**Convert to:** Component Tests (UI behavior)

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
**Status**: CRITICAL - NEEDS IMMEDIATE FIX

**Issues:**
- ❌ ALL tests focus on CSS classes instead of behavior
- ❌ No accessibility testing for status indicators
- ❌ Missing semantic testing (aria-label, roles)

**Fix Required:**
```typescript
// ✅ ALWAYS test accessibility, NEVER CSS classes:
expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Command succeeded')
expect(screen.getByText('✓')).toBeInTheDocument()

// ❌ NEVER test background colors:
// expect(indicator).toHaveClass('bg-emerald-400')
// expect(indicator).toHaveClass('bg-red-400')
```

**Convert to:** Component Tests (UI behavior with accessibility focus)

### 13. diff-viewer.test.tsx
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

### 14. code-block.test.tsx
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
- session-resumption.test.ts
- stop-functionality.test.tsx, home.test.tsx
- events.test.tsx, events.$sessionId.test.tsx (split into component + integration)

### **Tests Requiring CSS → Semantic Conversion (8 files):**
- tool-call-error-indicator.test.tsx, message-container.test.tsx, message-header.test.tsx
- loading-indicator.test.tsx, tool-call-display.test.tsx, diff-viewer.test.tsx, code-block.test.tsx, markdown-renderer.test.tsx

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
