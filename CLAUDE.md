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

## Important processes

- IMPORTANT: we have an MCP server called "docs" that you must *always* use when starting new feature development. Use the `mcp__docs__resolve-library-id` and `mcp__docs__get-library-docs` tools to pull the latest library documentation down so that the code you write will have the highest chance of working on the first try.
- Use the Playwright MCP server to verify functionality works as expected in the Chrome browser. If it does not work as expected, continue to iterate until it does.
- Do not start webservers or other long-running processes yourself as that will hang the chat. Instead, inform me what command to run, and I will run it in a separate tab for you. Logs for the main webserver will be sent to `dev.log` for you to review.

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
- **setupInMemoryDb()** utility for consistent database setup
- All test code follows same TypeScript strict mode rules as production

### Test Data Factory Pattern

Use factory functions with optional overrides for type-safe test data:

```typescript
const getMockSession = (
  overrides?: Partial<Session>
): Session => ({
  id: crypto.randomUUID(),
  title: 'Test Session',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  status: 'active',
  project_path: '/test/project',
  metadata: null,
  ...overrides,
});

// Usage in tests
const session = getMockSession({ title: 'Custom Title' })
```

**Key principles:**
- **Type-safe defaults**: Complete objects with sensible defaults
- **Flexible overrides**: Accept optional `Partial<T>` overrides  
- **Composable**: Factories can reference other factories
- **Realistic data**: Use realistic values, not test123

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
    const session = getMockSession({ project_path: '' });

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

### Directory Structure

Tests are organized based on what they test and how they test it:

```
app/
├── __tests__/              # Behavior tests for components and API routes
│   ├── *.test.tsx          # React component behavior tests
│   ├── *.test.ts           # API route and integration tests
│   └── (examples)
│       ├── session-creation.test.tsx    # Tests user interactions
│       ├── api.claude-code.test.ts      # Tests API endpoints
│       └── event-storage.test.ts        # Tests system behavior
├── db/
│   └── *.test.ts           # Database integration tests using in-memory SQLite
│       └── schema.test.ts               # Tests database schema
└── services/               # NO test files here (implementation details)
```

### Testing Rules

1. **NO unit tests for implementation details**
   - Don't test internal service methods
   - Don't mock internal dependencies
   - Don't create `*.service.test.ts` files that test implementation

2. **Test through public APIs only**
   - API routes: Test HTTP request/response behavior
   - Components: Test user interactions and visible behavior
   - Database: Test actual database operations with in-memory SQLite

3. **Mock external dependencies only**
   - Use **Vitest mocks** for external modules (like Claude Code SDK)
   - Use **MSW** for external HTTP API calls (if any)
   - Never mock internal services or database
   - Mock at the boundary, not internally

### Good vs Bad Examples

```typescript
// ❌ BAD - Testing implementation details
describe('ClaudeCodeService', () => {
  it('should call query with correct parameters', () => {
    // This tests HOW it works, not WHAT it does
  })
})

// ✅ GOOD - Testing behavior through API
describe('Claude Code API', () => {
  it('should stream events when valid request is made', async () => {
    // Tests the actual HTTP behavior users experience
  })
})

// ❌ BAD - Mocking internal services
vi.mock('../services/events.service', () => ({
  storeEvent: vi.fn()
}))

// ✅ GOOD - Using DRY utility for database tests
const session = testDb.createSession({ title: 'Test', project_path: '/test' })
const events = testDb.getEventsForSession(session.id)
expect(events).toHaveLength(0)

// ❌ BAD - Testing service internals
expect(streamClaudeCodeResponse).toHaveBeenCalledWith(...)

// ✅ GOOD - Testing observable behavior
const response = await fetch('/api/claude-code/session-id', { 
  method: 'POST',
  body: formData 
})
expect(response.headers.get('Content-Type')).toBe('text/event-stream')
```

### Database Testing Pattern - DRY Utility Approach

**ALWAYS use the `setupInMemoryDb()` utility** for database tests. This ensures consistency and eliminates SQL duplication:

```typescript
// ✅ EXCELLENT - DRY Utility Pattern (REQUIRED)
import { setupInMemoryDb, setMockDatabase, type TestDatabase } from '../test-utils/in-memory-db'

describe('Database operations', () => {
  let testDb: TestDatabase

  beforeEach(async () => {
    testDb = setupInMemoryDb()
    // For API tests that need to mock the database module:
    await setMockDatabase(testDb.db)
  })

  afterEach(() => {
    testDb.cleanup()
  })

  it('should create and retrieve session', () => {
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })
    
    const events = testDb.getEventsForSession(session.id)
    expect(events).toHaveLength(0)
  })
})
```

**Benefits of DRY utility:**
- **No SQL duplication**: Single source of truth for schema
- **Consistent setup**: All tests use identical database structure
- **Helper functions**: Built-in `createSession()` and `getEventsForSession()`
- **Proper cleanup**: Automatic database connection management
- **Parallel-safe**: Each test gets isolated in-memory database

### Database Testing Anti-Patterns

```typescript
// ❌ NEVER DO THIS - Manual database setup
beforeEach(() => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  sqlite.exec(`CREATE TABLE...`) // Duplicates schema definition
})

// ❌ NEVER DO THIS - Service imports in API tests
import { createSession } from '../db/sessions.service'
const session = await createSession({ title: 'Test' })

// ❌ NEVER DO THIS - Direct database imports in API tests
import { db, sessions } from '../db'
await db.delete(sessions).execute()
```

**Why in-memory SQLite with DRY utility:**
- **Fast**: No file I/O operations
- **Isolated**: Each test gets fresh database
- **Parallel**: No file locking issues
- **Consistent**: No schema drift between tests
- **Maintainable**: Single place to update database structure
- **Reliable**: No race conditions or cleanup issues

### Async Testing Patterns

**For API tests with streaming responses**, use proper completion polling instead of arbitrary timeouts:

```typescript
// ✅ EXCELLENT - Polling for completion
it('should handle streaming response', async () => {
  const response = await action({ request, params })
  expect(response.status).toBe(200)
  
  // Wait for streaming to complete by checking actual state
  let attempts = 0
  const maxAttempts = 50 // 5 seconds max
  while (attempts < maxAttempts) {
    const storedEvents = testDb.getEventsForSession(session.id)
    if (storedEvents.length > 1) { // Expected: user + system + assistant + result
      break
    }
    await new Promise(resolve => setTimeout(resolve, 100))
    attempts++
  }
})

// ❌ NEVER DO THIS - Arbitrary timeouts
it('should handle streaming response', async () => {
  const response = await action({ request, params })
  expect(response.status).toBe(200)
  
  // This is flaky and unreliable
  await new Promise(resolve => setTimeout(resolve, 500))
})
```

**Key principles for async testing:**
- **Poll for actual completion** - Check database state, don't guess timing
- **Use reasonable timeouts** - 5-10 seconds max with clear loop logic
- **Validate expected behavior** - Ensure the async work actually completed
- **Clean up properly** - Wait for async operations before test cleanup

### External Dependency Mocking

**For external modules**, use Vitest mocks:

```typescript
// Mock the Claude Code SDK module
vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn().mockImplementation(({ prompt }) => ({
    async *[Symbol.asyncIterator]() {
      yield { type: 'system', session_id: 'mock-session-id' }
      yield { type: 'user', message: { content: prompt } }
      yield { type: 'assistant', message: { content: 'Test response' } }
      yield { type: 'result', subtype: 'success' }
    }
  }))
}))
```

**For external HTTP APIs**, use MSW:

```typescript
// app/test-utils/msw-server.ts
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('https://api.external.com/data', () => {
    return HttpResponse.json({ data: 'mock response' })
  })
]

export const server = setupServer(...handlers)
```

### TypeScript Testing Patterns

**Always use proper types in tests** - follow strict mode requirements:

```typescript
// ✅ EXCELLENT - Proper type handling for SQLite results
const tableInfo = testDb.sqlite.prepare("PRAGMA table_info(events)").all()
const columnNames = tableInfo.map((col: unknown) => (col as { name: string }).name)

// ❌ NEVER DO THIS - Using any types
const columnNames = tableInfo.map((col: any) => col.name)

// ✅ EXCELLENT - Proper data type assertions
const data = result.data as {
  type: string;
  message: {
    role: string;
    content: Array<{ type: string; name: string; }>;
  };
}

// ❌ NEVER DO THIS - Casting to any
const data = result.data as any
```

**Use factory functions consistently** - see Test Data Factory Pattern section above for details.

### Test Execution

- Database tests run in parallel using in-memory SQLite
- Component tests use `happy-dom` environment
- All tests must pass before committing
- Coverage based on behavior, not lines of code
- TypeScript strict mode enforced in all test files

## Testing Troubleshooting Guide

### Common Issues and Solutions

**"Database connection is not open" errors:**
- **Cause**: Test cleanup happens before async operations complete
- **Solution**: Use proper completion polling, not arbitrary timeouts
- **Example**: Check for stored events before cleanup

**"Cannot read properties of undefined" in component tests:**
- **Cause**: Component state updates not wrapped in `act()`
- **Solution**: Wrap state-changing operations in React's `act()` helper
- **Example**: `act(() => { fireEvent.click(button) })`

**Race conditions in parallel tests:**
- **Cause**: Shared database or global state
- **Solution**: Always use `setupInMemoryDb()` for isolated test databases
- **Example**: Each test gets its own in-memory SQLite instance

**TypeScript errors with SQLite results:**
- **Cause**: SQLite returns `unknown[]` types, not specific interfaces
- **Solution**: Use proper type assertions, not `any`
- **Example**: `(result as { name: string }).name`

**Flaky tests that sometimes pass/fail:**
- **Cause**: Timing dependencies or insufficient waiting
- **Solution**: Poll for actual completion conditions
- **Example**: Check database state instead of using `setTimeout`

### Performance Issues

**Slow database tests:**
- **Cause**: Using file-based SQLite instead of in-memory
- **Solution**: Ensure all tests use `:memory:` database
- **Expected**: Database tests should run in <50ms each

**Tests timing out:**
- **Cause**: Async operations not properly awaited
- **Solution**: Use completion polling with reasonable timeouts
- **Expected**: API tests should complete within 5 seconds

### Test Organization Issues

**Duplicate test setup code:**
- **Cause**: Manual database setup instead of DRY utility
- **Solution**: Always use `setupInMemoryDb()` utility
- **Benefit**: Single source of truth for schema

**Tests failing after schema changes:**
- **Cause**: Hardcoded SQL in individual test files
- **Solution**: Schema changes only need updating in `setupInMemoryDb()`
- **Benefit**: All tests automatically get updated schema

## TypeScript Testing Best Practices Summary

### The Golden Rules

1. **Test behavior, not implementation** - Test what the code does, not how it does it
2. **Use real dependencies internally** - Never mock internal services or database
3. **Mock only external boundaries** - Mock external APIs and modules at the boundary
4. **Follow TypeScript strict mode** - No `any` types, proper type assertions when needed
5. **Use factories for test data** - Type-safe, composable, realistic test data
6. **Consistent database setup** - Always use `setupInMemoryDb()` utility
7. **Poll for async completion** - Don't use arbitrary timeouts, check actual state

### Test Architecture Patterns

**Database Tests**: Use in-memory SQLite with DRY utility
**API Tests**: Test HTTP endpoints with proper async polling
**Component Tests**: Test user interactions with React Testing Library
**External Mocks**: Vitest mocks for modules, MSW for HTTP APIs

### Quality Indicators

- **Fast**: Database tests <50ms, API tests <5s
- **Reliable**: No race conditions, no flaky tests
- **Maintainable**: Single source of truth for schema and test data
- **Type-safe**: No `any` types, proper assertions when needed
- **Behavior-focused**: Tests document expected business behavior

### Red Flags to Avoid

- ❌ Testing internal service methods
- ❌ Mocking internal dependencies  
- ❌ Using `any` types in tests
- ❌ Hardcoded SQL in individual test files
- ❌ Arbitrary timeouts for async operations
- ❌ Shared mutable state between tests

## Summary

Write clean, testable, functional code through small, safe increments. Every change driven by a test describing desired behavior. Implementation should be simplest thing that makes test pass. When in doubt, favor simplicity and readability over cleverness.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
