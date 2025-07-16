# How to Extract Tool Components from ToolCallDisplay

This document outlines the proven TDD process for extracting tool-specific components from the ToolCallDisplay component. This process has been successfully used to extract WriteToolDisplay, EditToolDisplay, and BashToolDisplay.

## Prerequisites

1. **Review CLAUDE.md**: Always read the testing guidelines and TDD requirements first
2. **Understand the target logic**: Examine the existing tool logic in ToolCallDisplay to understand what needs extraction
3. **Identify boundaries**: Determine what belongs in the new component vs. what stays in ToolCallDisplay

## Step-by-Step Process

### Phase 1: Research & Planning (Red Setup)

1. **Analyze existing logic** in ToolCallDisplay:
   ```bash
   # Find tool-specific logic
   grep -n "toolName.*==.*'ToolName'" app/components/events/ToolCallDisplay.tsx
   grep -A 20 -B 5 "Handle ToolName" app/components/events/ToolCallDisplay.tsx
   ```

2. **Identify what to extract**:
   - Tool-specific result formatting
   - Specialized rendering logic
   - Tool-specific state management
   - Custom UI components for that tool

3. **Plan the component interface**:
   ```typescript
   interface ToolNameDisplayProps {
     toolCall: ToolUseContent
     hasResult: boolean
     result?: unknown
     // Add tool-specific props as needed
   }
   ```

### Phase 2: Test-Driven Development

#### Step 1: RED - Write Failing Tests

Create `app/__tests__/tool-name-display.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolNameDisplay } from '../components/events/tools/ToolNameDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectContent } from '../test-utils/component-testing'

describe('ToolNameDisplay Component', () => {
  describe('when ToolName tool has successful result', () => {
    it('should display expected behavior', () => {
      const tool = MOCK_TOOLS.toolName('params')
      const result = { /* expected result format */ }
      
      render(
        <ToolNameDisplay 
          toolCall={tool}
          hasResult={true}
          result={result}
        />
      )

      // Test expected behavior
      expectContent.text('expected output')
    })
  })

  describe('when ToolName tool has no result', () => {
    it('should not render anything', () => {
      const tool = MOCK_TOOLS.toolName('params')
      
      render(
        <ToolNameDisplay 
          toolCall={tool}
          hasResult={false}
        />
      )

      expect(screen.queryByText('expected output')).not.toBeInTheDocument()
    })
  })

  describe('when tool is not ToolName', () => {
    it('should not render anything for non-ToolName tools', () => {
      const otherTool = MOCK_TOOLS.read('/test/file.ts')
      
      render(
        <ToolNameDisplay 
          toolCall={otherTool}
          hasResult={true}
          result="Some result"
        />
      )

      expect(screen.queryByText('Some result')).not.toBeInTheDocument()
    })
  })
})
```

**Key testing principles:**
- Test behavior, not implementation
- Cover success, failure, and edge cases
- Test with and without results
- Test with non-target tools
- Use semantic assertions via `expectContent`

Run test to confirm it fails:
```bash
npm test -- --run tool-name-display
```

#### Step 2: GREEN - Minimal Implementation

Create `app/components/events/tools/ToolNameDisplay.tsx`:

```typescript
import { memo } from 'react'
import type { ToolUseContent } from '../../../types/events'

interface ToolNameDisplayProps {
  toolCall: ToolUseContent
  hasResult: boolean
  result?: unknown
}

export const ToolNameDisplay = memo(({ toolCall, hasResult, result }: ToolNameDisplayProps) => {
  // Only show for target tool with results
  if (toolCall.name !== 'ToolName' || !hasResult || !result) {
    return null
  }

  // Extract the core logic from ToolCallDisplay here
  // Implement minimal functionality to make tests pass
  
  return (
    <div>
      {/* Minimal implementation */}
    </div>
  )
})

ToolNameDisplay.displayName = 'ToolNameDisplay'
```

Add export to `app/components/events/tools/index.ts`:
```typescript
export { ToolNameDisplay } from './ToolNameDisplay'
```

Run tests to confirm they pass:
```bash
npm test -- --run tool-name-display
```

#### Step 3: REFACTOR - Extract from ToolCallDisplay

1. **Add import** to ToolCallDisplay:
   ```typescript
   import { ToolNameDisplay } from './tools/ToolNameDisplay'
   ```

2. **Integrate the component**:
   ```typescript
   {/* ToolName tool section */}
   <ToolNameDisplay 
     toolCall={toolCall}
     hasResult={hasResult}
     result={result}
   />
   ```

3. **Remove extracted logic** from ToolCallDisplay:
   - Remove tool-specific formatting functions
   - Remove tool-specific conditionals
   - Update exclusion lists: `toolCall.name !== 'Write' && toolCall.name !== 'ToolName'`

4. **Clean up unused imports** and dead code

### Phase 3: Integration & Validation

1. **Test integration**:
   ```bash
   npm test -- --run tool-call-display
   ```

2. **Update failing integration tests** if needed:
   - Tests expecting old behavior need updates
   - Add `hasResult={true}` if missing
   - Update assertions to match new component behavior

3. **Run full test suite**:
   ```bash
   npm test
   ```

4. **Validate code quality**:
   ```bash
   npm run typecheck
   npm run lint
   ```

### Phase 4: Commit

Only commit when all validations pass:

```bash
git add .
git commit -m "feat: extract ToolNameDisplay component with comprehensive TDD approach

- Create ToolNameDisplay component for ToolName tools following TDD
- Extract specialized tool logic (~X lines) from ToolCallDisplay  
- Add comprehensive test suite covering all tool scenarios
- Support [key features]
- Remove tool-specific logic from ToolCallDisplay
- Update integration tests for new component structure
- Maintain all existing functionality while improving code organization

Benefits:
- Reduced ToolCallDisplay complexity
- Better separation of concerns
- Consistent tool component pattern
- Comprehensive test coverage

All tests pass (X total), clean linting, and TypeScript compilation

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Common Patterns & Best Practices

### Testing Patterns
- **Always use factories**: `MOCK_TOOLS.toolName()` for test data
- **Test edge cases**: empty results, invalid input, wrong tool type
- **Use semantic assertions**: `expectContent.text()` over `expect(element).toHaveTextContent()`
- **Test interactions**: button clicks, expand/collapse, state changes

### Component Patterns
- **Early returns**: Guard clauses for wrong tool type or missing results
- **Memo optimization**: Always wrap in `memo()` for performance
- **Type safety**: Use proper TypeScript interfaces, avoid `any`
- **Consistent naming**: `{ToolName}Display` format

### Integration Patterns
- **Tool-specific sections**: Add component in its own commented section
- **Exclude from generic display**: Update exclusion conditions
- **Import organization**: Group tool imports together
- **Clean up**: Remove unused imports and dead code

## Troubleshooting

### Tests Failing After Integration
- Check if integration tests expect old behavior
- Add missing `hasResult={true}` props
- Update test assertions to match new component output

### Linting Errors
- Remove unused imports from extracted logic
- Fix unused variables in catch blocks: `} catch { }` not `} catch (e) { }`

### TypeScript Errors
- Ensure all imports are correct
- Check component export in tools/index.ts
- Verify interface definitions match usage

## Examples

Successful extractions following this process:
- **WriteToolDisplay**: File preview with diff-style display and expansion
- **EditToolDisplay**: Diff viewer with line number extraction and MultiEdit support
- **BashToolDisplay**: Command result formatting with error states and expansion

Each extraction reduced ToolCallDisplay complexity while maintaining full functionality and test coverage.