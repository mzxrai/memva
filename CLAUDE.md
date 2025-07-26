# Development Guidelines for Claude

## Your Process

- You should always work in a loop: research, plan, implement, test, lint, typecheck. Repeat until user's request is complete, all tests pass, and linting / typechecking is clean. Then commit.
 
## Basic World Information/Grounding

- It is currently July 15, 2025.

## App Description

This app's goal is to help users manage multiple "Claude Code" (the CLI coding agent) sessions in parallel effectively, with minimal fuss and maximum power.

To start with, we will build this in a local-only fashion; in other words, it will be a self-contained app that runs on a user's computer and integrates directly with the user's Claude Code.

### Technologies

- We will be using React 19 and React Router v7 (the next evolution of Remix) in "framework mode".
- We will use Tailwind CSS exclusively.
- We will write proper modern TypeScript.
- The use of popular, well-supported third-party TypeScript libraries is encouraged for non-trivial functionality. Always run a web search to locate the latest stable version of a given library before adding it to `package.json`.
- We use Drizzle ORM to interact with our sqlite database.

### Design aesthetic

- Design aesthetic: Linear-inspired, modern black/white minimal with thoughtful use of: color, elegant iconography (no emojis unless explicitly requested by the user)
- Inter is our primary variable-width sans font
- JetBrains Mono is our primary monospace font

## Helpful info

- IMPORTANT: we have an MCP server called "docs" that you must *always* use when starting new feature development. Use the `mcp__docs__resolve-library-id` and `mcp__docs__get-library-docs` tools to pull the latest library documentation down so that the code you write will have the highest chance of working on the first try.
- Use the Playwright MCP server to verify functionality works as expected in the Chrome browser. If it does not work as expected, continue to iterate until it does.
- Do not start webservers or other long-running processes yourself as that will hang the chat. Instead, inform me what command to run, and I will run it in a separate tab for you. Logs for the main webserver will be sent to `dev.log` for you to review.
- Our main database is `~/.memva/memva.db`. Use the `sqlite3` command to interrogate it when you have data-related questions. 
- When adding new routes to our app, ensure you add them to `app/routes.ts` so the app knows about them.

## Core Philosophy

**TEST-DRIVEN DEVELOPMENT IS NON-NEGOTIABLE.** Every line of production code must be written in response to a failing test. No exceptions.

I follow TDD with behavior-driven testing and functional programming principles. All work is done in small, incremental changes maintaining a working state throughout development.

## Quick Reference

**Key Principles:**
- Write tests first (TDD)
- Test behavior, not implementation
- No `any` types, minimal type assertions
- Immutable data only
- Small, pure functions
- TypeScript strict mode always
- Use real schemas/types in tests

**Preferred Tools:**
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest + React Testing Library
- **State Management**: Immutable patterns
- **Database**: Service layer pattern with Drizzle ORM

## Database Architecture

### Service Layer Pattern

The database follows a **service layer pattern** for clean separation of concerns:

- **Routes**: Use service functions, never direct database access
- **Service Layer** (`*.service.ts`): Business logic and data access functions  
- **Database Layer** (`index.ts`, `database.ts`): Connection management and singleton access
- **Schema Layer** (`schema.ts`): Table definitions and types

### Public APIs for Database Operations

**Service functions are the public API** for database operations:

```typescript
// ✅ CORRECT - Use service functions
import { createSession, getSession } from './db/sessions.service'
const session = await createSession(data)

// ❌ WRONG - Direct database access
import { db } from './db/index'
const session = db.insert(sessions).values(data).run()
```

## Testing Principles

### Behavior-Driven Testing

- **No "unit tests"** - test expected behavior through public APIs only
- No 1:1 mapping between test files and implementation files
- Tests examining internal implementation are wasteful
- **100% coverage expected** but based on business behavior, not implementation details
- Tests must document expected business behavior

### Test Tools & Organization

- **Vitest** for test runner and mocking
- **React Testing Library** for component testing  
- **MSW (Mock Service Worker)** for HTTP API mocking
- **In-memory SQLite** for database testing
- **Global Test Utilities** for consistent patterns
- All test code follows same TypeScript strict mode rules as production

### Global Test Utilities & Patterns

**IMPORTANT: These utilities exist to ensure consistency. Always use them instead of reinventing patterns.**

#### Database Testing Utilities

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

#### Test Data Factories

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

#### Async Testing Utilities

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

#### Component Testing Utilities

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

#### External Dependency Mocking

**Claude Code SDK Mock (app/test-utils/msw-server.ts)**
- **When to use**: Tests that need Claude Code responses
- **Pattern**: Pre-configured with realistic responses
- **Auto-setup**: Imported globally, no manual setup needed

```typescript
// ✅ MOCK IS ALREADY CONFIGURED
// Tests automatically get realistic Claude Code responses
// No additional setup needed
```

### Test Types & Locations

#### Where Each Test Type Lives

| Test Type | Location | File Pattern | Purpose | When to Create |
|-----------|----------|--------------|---------|----------------|
| **Component Tests** | `app/__tests__/*.test.tsx` | `component-name.test.tsx` | Test React component UI behavior | Testing individual components, forms, layouts |
| **Integration Tests** | `app/__tests__/*.test.ts` | `feature-name.test.ts` | Test complete user workflows | Testing API routes, user journeys, business logic |
| **Database Tests** | `app/db/*.test.ts` | `service-name.service.test.ts` | Test service layer functions | Testing service functions, data operations, business logic |

#### Decision Matrix: Which Pattern to Use

| Test Type | Database | Data Creation | Async Operations | Component Testing |
|-----------|----------|---------------|------------------|-------------------|
| **Component Tests** | ❌ No DB | ✅ Factories | ✅ Smart waiting | ✅ Semantic utils |
| **Integration Tests** | ✅ setupInMemoryDb + setupDatabaseMocks + setTestDatabase | ✅ Factories | ✅ Smart waiting | ✅ Semantic utils |
| **Database Tests** | ✅ setupInMemoryDb + setupDatabaseMocks + setTestDatabase | ✅ Factories | ✅ Smart waiting | ❌ N/A |

#### When to Use Each Test Type

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
- **What**: Service layer functions, data operations, business logic
- **When**: Testing service functions that encapsulate database operations and business rules
- **Examples**: Session creation, event storage, data relationships, service function validation
- **Service layer**: Test service functions that provide the public API for database operations

## TypeScript Guidelines

### Strict Mode Requirements

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- **No `any` types** - use `unknown` for truly unknown types
- **Type assertions** (`as SomeType`) - acceptable when TypeScript inference fails, especially for:
  - SQLite results: `(result as { name: string }).name`
  - JSON parsing: `JSON.parse(data) as ExpectedType`
  - External library results with poor typing
- **No `@ts-ignore`** without explicit explanation
- **Strict mode enforced** in both production and test code

### Schema-First Development

We use **Drizzle schemas** for database operations and **Zod schemas** for validation:

```typescript
// Database schema (Drizzle)
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title'),
  status: text('status').notNull(),
  project_path: text('project_path').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type Session = typeof sessions.$inferSelect;

// Validation schema (Zod) - for API input validation
import { z } from "zod";

export const CreateSessionSchema = z.object({
  title: z.string().optional(),
  project_path: z.string().min(1),
});

export type CreateSessionRequest = z.infer<typeof CreateSessionSchema>;
```

**CRITICAL**: Tests must use real schemas from shared modules, never redefine them:

```typescript
// ❌ WRONG - Defining schemas in test files
const SessionSchema = z.object({ id: z.string() });

// ✅ CORRECT - Import from shared location
import { sessions, type Session } from '../db/schema';
import { CreateSessionSchema } from '../schemas/session';
```

## Code Style

### Functional Programming

Follow "functional light" approach:
- **No data mutation** - immutable data structures only
- **Pure functions** wherever possible
- **Composition** over complex logic
- Array methods (`map`, `filter`, `reduce`) over imperative loops
- Heavy FP abstractions only when clear advantage exists

### Code Structure

- **No nested if/else** - use early returns or composition
- **Max 2 levels nesting**
- Small, focused functions
- Flat, readable code over clever abstractions

### Naming & Files

- **Functions**: `camelCase`, verb-based (`createSession`, `validateSession`)
- **Types**: `PascalCase` (`Session`, `CreateSessionRequest`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants
- **Files**: `kebab-case.ts`
- **Tests**: `*.test.ts`

### No Comments in Code

Code should be self-documenting. Comments indicate unclear code.

```typescript
// Avoid: Comments explaining code
if (session.status === "active") {
  // Allow message sending
  return true;
}

// Good: Self-documenting
const ACTIVE_SESSION_STATUS = 'active';
const isActiveSession = (session: Session) => session.status === ACTIVE_SESSION_STATUS;

const sessionCanReceiveMessages = isActiveSession(session);
if (!sessionCanReceiveMessages) {
  throw new Error('Cannot send messages to inactive session');
}
```

### Prefer Options Objects

Default to options objects for function parameters:

```typescript
// Avoid: Multiple positional parameters
const createSession = (title: string, projectPath: string, status: string) => {};

// Good: Options object
type CreateSessionOptions = {
  title?: string;
  project_path: string;
  status?: string;
};

const createSession = (options: CreateSessionOptions) => {
  const { title, project_path, status = 'active' } = options;
  // implementation
};

// Clear at call site
const session = createSession({
  title: 'My Session',
  project_path: '/Users/dev/project',
});
```

**Exceptions**: Single-parameter pure functions, well-established patterns like `map(fn)`.

## Development Workflow

### TDD Process - THE FUNDAMENTAL PRACTICE

Follow Red-Green-Refactor strictly:

1. **Red**: Write failing test for desired behavior. NO PRODUCTION CODE until failing test exists.
2. **Green**: Write MINIMUM code to make test pass.
3. **Refactor**: Assess if code can be improved. Only refactor if it adds value.

**Common violations to avoid:**
- Writing production code without failing test
- Writing multiple tests before making first pass
- Writing more code than needed for current test
- Skipping refactor assessment

```typescript
// Step 1: Red
it("should create session with active status", () => {
  const sessionData = { title: 'My Session', project_path: '/test' };
  expect(createSession(sessionData).status).toBe('active');
});

// Step 2: Green - minimal implementation
const createSession = (data: CreateSessionRequest) => ({
  ...data,
  id: crypto.randomUUID(),
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Step 3: Refactor - extract for clarity if valuable
const DEFAULT_SESSION_STATUS = 'active';

const generateSessionId = () => crypto.randomUUID();
const generateTimestamp = () => new Date().toISOString();

const createSession = (data: CreateSessionRequest) => {
  const timestamp = generateTimestamp();
  return {
    ...data,
    id: generateSessionId(),
    status: DEFAULT_SESSION_STATUS,
    created_at: timestamp,
    updated_at: timestamp,
  };
};
```

### Refactoring - The Critical Third Step

After achieving green, MUST assess refactoring opportunities. Only refactor if it genuinely improves the code.

#### When to Refactor
- **Always assess after green** before next test
- When names could be clearer
- When structure could be simpler
- When useful patterns emerge based on semantic meaning

#### Key Guidelines

**1. Commit Before Refactoring**
```bash
git commit -m "feat: add session validation"
# Now safe to refactor
```

**2. Abstract Based on Semantic Meaning, Not Structure**

```typescript
// Similar structure, DIFFERENT meaning - DON'T ABSTRACT
const validateSessionTitle = (title: string) => title.length > 0 && title.length <= 100;
const validateProjectPath = (path: string) => path.length > 0 && path.length <= 1000;
// These represent different business concepts that evolve independently

// Similar structure, SAME meaning - SAFE TO ABSTRACT  
const formatSessionDisplayName = (title: string, id: string) => `${title} (${id})`.trim();
const formatEventDisplayName = (type: string, id: string) => `${type} (${id})`.trim();
// Same concept: "format item name for display"

const formatItemDisplayName = (name: string, id: string) => `${name} (${id})`.trim();
```

**3. DRY is About Knowledge, Not Code**

DRY means don't duplicate knowledge/business rules, not eliminating similar-looking code.

**4. Maintain External APIs**
Refactoring must never break existing consumers.

**5. Verify After Refactoring**
- All tests pass without modification
- Static analysis passes
- Commit separately from features

### Commit Guidelines

```
feat: add session validation
fix: correct date formatting  
refactor: extract validation helpers
test: add edge cases for validation
```

## Working with Claude

### Expectations

1. **ALWAYS FOLLOW TDD** - No production code without failing test
2. Think deeply before edits
3. Understand full context
4. Ask clarifying questions for ambiguous requirements
5. Assess refactoring after every green
6. **Update CLAUDE.md** with learnings at end of every change

### Code Changes

- Start with failing test - always
- After green, assess refactoring (only if adds value)
- Maintain test coverage for all behavior changes
- Keep changes small and incremental
- Meet TypeScript strict mode requirements

## Example Patterns

### Error Handling

```typescript
// Result type pattern
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

type ProcessedSession = Session & {
  processed_at: string;
  is_ready: boolean;
};

class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

const processSession = (session: Session): Result<ProcessedSession, SessionError> => {
  if (!isValidSession(session)) {
    return { success: false, error: new SessionError("Invalid session") };
  }
  return { success: true, data: executeSession(session) };
};

// Early returns with exceptions
const processSession = (session: Session): ProcessedSession => {
  if (!isValidSession(session)) {
    throw new SessionError("Invalid session");
  }
  return executeSession(session);
};
```

### Testing Behavior (Not Implementation)

```typescript
// Good - tests behavior through public API
describe("SessionProcessor", () => {
  it("should reject session when project path is invalid", () => {
    const session = createMockSession({ project_path: '' });

    const result = processSession(session);

    expect(result.success).toBe(false);
    expect(result.error.message).toBe("Invalid project path");
  });
});

// Avoid - testing implementation details
it("should call validateProjectPath method", () => {
  // Tests implementation, not behavior
});
```

## Anti-patterns to Avoid

```typescript
// Avoid: Mutation
const addItem = (items: Item[], newItem: Item) => {
  items.push(newItem); // Mutates
  return items;
};

// Prefer: Immutable
const addItem = (items: Item[], newItem: Item): Item[] => 
  [...items, newItem];

// Avoid: Nested conditionals  
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      // do something
    }
  }
}

// Prefer: Early returns
if (!user || !user.isActive || !user.hasPermission) {
  return;
}
// do something

// Avoid: Large functions
const processSession = (session: Session) => {
  // 100+ lines
};

// Prefer: Composition
const processSession = (session: Session) => {
  const validated = validateSession(session);
  const initialized = initializeSession(validated);
  const configured = configureSession(initialized);
  return startSession(configured);
};
```

## Resources and References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles)
- [Kent C. Dodds Testing JavaScript](https://testingjavascript.com/)
- [Functional Programming Principles](https://mostly-adequate.gitbooks.io/mostly-adequate-guide/)

## Test Organization and Guidelines

### Testing Rules

1. **NO unit tests for implementation details**
   - Don't test internal service methods
   - Don't mock internal dependencies
   - Don't create `*.service.test.ts` files that test implementation

2. **Test through public APIs only**
   - API routes: Test HTTP request/response behavior
   - Components: Test user interactions and visible behavior
   - Database: Test service layer functions (the public API for database operations)

3. **Use service layer for database operations**
   - Routes should use service functions: `createSession()`, `getEventsForSession()`, etc.
   - Tests should use service functions, not direct database access
   - Service functions are the correct "public API" for database operations

4. **Mock external dependencies only**
   - Use **setupDatabaseMocks()** for database module mocking
   - Use **MSW** for external HTTP API calls (pre-configured)
   - Never mock internal services or database directly
   - Mock at the boundary, not internally

### Complete Examples by Test Type

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

**🗄️ Database Test Example (`app/db/sessions.service.test.ts`)**
```typescript
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { createSession, getSession, updateSession } from './sessions.service'

describe('Sessions Service', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should create and retrieve session correctly', async () => {
    const sessionData = { title: 'Test Session', project_path: '/test/project' }
    
    // Test service layer functions (the public API for database operations)
    const created = await createSession(sessionData)
    const retrieved = await getSession(created.id)
    
    expect(retrieved).toEqual(created)
    expect(retrieved?.title).toBe('Test Session')
  })
})
```

### Mock Strategy Hierarchy

1. **External APIs**: Mock at boundary (MSW, vitest mocks)
2. **Database**: Use in-memory SQLite (setupInMemoryDb + setupDatabaseMocks + setTestDatabase)
3. **Internal services**: NEVER mock - use real implementations with test database
4. **Service layer**: Test directly using service functions as the public API for database operations
5. **Test data**: ALWAYS use factories

### Async Testing Best Practices

- **Never** use arbitrary timeouts (`setTimeout(100)`)
- **Always** poll for actual completion conditions
- **Use** `waitForCondition()` for custom conditions
- **Use** `waitForEvents()` for Claude Code integration tests

### Testing Philosophy (Per CLAUDE.md)

- **NO "unit tests"** - test expected behavior through public APIs only
- **NO testing implementation details** - test what users experience, not how code works internally
- **NO mocking internal services** - use real implementations for internal dependencies
- **Service layer functions ARE public APIs** - test service functions directly as the correct interface for database operations
- **Test behavior, not implementation** - focus on business outcomes, not code structure

## Summary

Write clean, testable, functional code through small, safe increments. Every change driven by a test describing desired behavior. Implementation should be simplest thing that makes test pass. When in doubt, favor simplicity and readability over cleverness.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
