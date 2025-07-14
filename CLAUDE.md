# Development Guidelines for Claude
 
## Basic World Information/Grounding

- It is currently July of 2025.

## App Description

This app's goal is to help users manage multiple "Claude Code" (the CLI coding agent) sessions in parallel effectively, with minimal fuss and maximum power.

To start with, we will build this in a local-only fashion; in other words, it will be a self-contained app that runs on a user's computer and integrates directly with the user's Claude Code.

### Technologies

- We will be using React 19 and React Router v7 (the next evolution of Remix) in "framework mode".
- We will use Tailwind CSS exclusively.
- We will write proper modern TypeScript.
- The use of popular, well-supported third-party TypeScript libraries is encouraged for non-trivial functionality. Always run a web search to locate the latest stable version of a given library before adding it to `package.json`.

### Design aesthetic

- Design aesthetic: Linear-inspired, modern black/white minimal with thoughtful use of: color, elegant iconography (no emojis unless explicitly requested by the user)
- Inter is our primary variable-width sans font
- JetBrains Mono is our primary monospace font

## Important processes

- IMPORTANT: we have an MCP server called "docs" that you must *always* use when starting new feature development. Use "docs" to pull the latest library documentation down so that the code you write will have the highest chance of working on the first try.
- Use the Playwright MCP server to verify functionality works as expected in the Chrome browser. If it does not work as expected, continue to iterate until it does.
- Do not start webservers or other long-running processes yourself as that will hang the chat. Instead, inform me what command to run, and I will run it in a separate tab for you. Logs for the main webserver will be sent to `dev.log` for you to review.

## Core Philosophy

**TEST-DRIVEN DEVELOPMENT IS NON-NEGOTIABLE.** Every line of production code must be written in response to a failing test. No exceptions.

I follow TDD with behavior-driven testing and functional programming principles. All work is done in small, incremental changes maintaining a working state throughout development.

## Quick Reference

**Key Principles:**
- Write tests first (TDD)
- Test behavior, not implementation
- No `any` types or type assertions
- Immutable data only
- Small, pure functions
- TypeScript strict mode always
- Use real schemas/types in tests

**Preferred Tools:**
- **Language**: TypeScript (strict mode)
- **Testing**: Jest/Vitest + React Testing Library
- **State Management**: Immutable patterns

## Testing Principles

### Behavior-Driven Testing

- **No "unit tests"** - test expected behavior through public APIs only
- No 1:1 mapping between test files and implementation files
- Tests examining internal implementation are wasteful
- **100% coverage expected** but based on business behavior, not implementation details
- Tests must document expected business behavior

### Test Tools & Organization

- **Jest/Vitest** for testing, **React Testing Library** for components, **MSW** for API mocking
- All test code follows same TypeScript strict mode rules as production

### Test Data Pattern

Use factory functions with optional overrides:

```typescript
const getMockPaymentRequest = (
  overrides?: Partial<PaymentRequest>
): PaymentRequest => ({
  amount: 100,
  currency: "GBP",
  cardId: "card_123",
  customerId: "cust_456",
  ...overrides,
});
```

**Key principles:**
- Complete objects with sensible defaults
- Accept optional `Partial<T>` overrides
- Compose factories for complex objects

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

- **No `any`** - use `unknown` if type is truly unknown
- **No type assertions** (`as SomeType`) unless absolutely necessary
- **No `@ts-ignore`** without explicit explanation
- Rules apply to test code too

### Schema-First Development

Always define schemas first, derive types from them:

```typescript
import { z } from "zod";

const PaymentRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  cardId: z.string().min(1),
});

type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

export const parsePaymentRequest = (data: unknown): PaymentRequest => {
  return PaymentRequestSchema.parse(data);
};
```

**CRITICAL**: Tests must use real schemas from shared modules, never redefine them:

```typescript
// ❌ WRONG - Defining schemas in test files
const ProjectSchema = z.object({ id: z.string() });

// ✅ CORRECT - Import from shared location
import { ProjectSchema, type Project } from "@your-org/schemas";
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

- **Functions**: `camelCase`, verb-based (`calculateTotal`)
- **Types**: `PascalCase` (`PaymentRequest`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants
- **Files**: `kebab-case.ts`
- **Tests**: `*.test.ts`

### No Comments in Code

Code should be self-documenting. Comments indicate unclear code.

```typescript
// Avoid: Comments explaining code
if (customer.tier === "premium") {
  // Apply 20% discount
  return price * 0.8;
}

// Good: Self-documenting
const PREMIUM_DISCOUNT_MULTIPLIER = 0.8;
const isPremiumCustomer = (customer: Customer) => customer.tier === "premium";

const discountMultiplier = isPremiumCustomer(customer)
  ? PREMIUM_DISCOUNT_MULTIPLIER
  : STANDARD_DISCOUNT_MULTIPLIER;

return price * discountMultiplier;
```

### Prefer Options Objects

Default to options objects for function parameters:

```typescript
// Avoid: Multiple positional parameters
const createPayment = (amount: number, currency: string, cardId: string) => {};

// Good: Options object
type CreatePaymentOptions = {
  amount: number;
  currency: string;
  cardId: string;
  description?: string;
};

const createPayment = (options: CreatePaymentOptions) => {
  const { amount, currency, cardId, description } = options;
  // implementation
};

// Clear at call site
const payment = createPayment({
  amount: 100,
  currency: "GBP", 
  cardId: "card_123",
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
it("should calculate total with shipping", () => {
  const order = { items: [{ price: 30 }], shippingCost: 5.99 };
  expect(processOrder(order).total).toBe(35.99);
});

// Step 2: Green - minimal implementation
const processOrder = (order: Order) => ({
  ...order,
  total: order.items.reduce((sum, item) => sum + item.price, 0) + order.shippingCost,
});

// Step 3: Refactor - extract for clarity if valuable
const FREE_SHIPPING_THRESHOLD = 50;

const calculateItemsTotal = (items: OrderItem[]) => 
  items.reduce((sum, item) => sum + item.price, 0);

const processOrder = (order: Order) => {
  const itemsTotal = calculateItemsTotal(order.items);
  const shippingCost = itemsTotal > FREE_SHIPPING_THRESHOLD ? 0 : order.shippingCost;
  return { ...order, total: itemsTotal + shippingCost };
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
git commit -m "feat: add payment validation"
# Now safe to refactor
```

**2. Abstract Based on Semantic Meaning, Not Structure**

```typescript
// Similar structure, DIFFERENT meaning - DON'T ABSTRACT
const validatePaymentAmount = (amount: number) => amount > 0 && amount <= 10000;
const validateTransferAmount = (amount: number) => amount > 0 && amount <= 10000;
// These represent different business concepts that evolve independently

// Similar structure, SAME meaning - SAFE TO ABSTRACT  
const formatUserDisplayName = (first: string, last: string) => `${first} ${last}`.trim();
const formatCustomerDisplayName = (first: string, last: string) => `${first} ${last}`.trim();
// Same concept: "format person's name for display"

const formatPersonDisplayName = (first: string, last: string) => `${first} ${last}`.trim();
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
feat: add payment validation
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

const processPayment = (payment: Payment): Result<ProcessedPayment, PaymentError> => {
  if (!isValidPayment(payment)) {
    return { success: false, error: new PaymentError("Invalid payment") };
  }
  return { success: true, data: executePayment(payment) };
};

// Early returns with exceptions
const processPayment = (payment: Payment): ProcessedPayment => {
  if (!isValidPayment(payment)) {
    throw new PaymentError("Invalid payment");
  }
  return executePayment(payment);
};
```

### Testing Behavior (Not Implementation)

```typescript
// Good - tests behavior through public API
describe("PaymentProcessor", () => {
  it("should decline payment when insufficient funds", () => {
    const payment = getMockPayment({ amount: 1000 });
    const account = getMockAccount({ balance: 500 });

    const result = processPayment(payment, account);

    expect(result.success).toBe(false);
    expect(result.error.message).toBe("Insufficient funds");
  });
});

// Avoid - testing implementation details
it("should call checkBalance method", () => {
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
const processOrder = (order: Order) => {
  // 100+ lines
};

// Prefer: Composition
const processOrder = (order: Order) => {
  const validated = validateOrder(order);
  const priced = calculatePricing(validated);
  const final = applyDiscounts(priced);
  return submitOrder(final);
};
```

## Resources and References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles)
- [Kent C. Dodds Testing JavaScript](https://testingjavascript.com/)
- [Functional Programming in TypeScript](https://gcanti.github.io/fp-ts/)

## Summary

Write clean, testable, functional code through small, safe increments. Every change driven by a test describing desired behavior. Implementation should be simplest thing that makes test pass. When in doubt, favor simplicity and readability over cleverness.
