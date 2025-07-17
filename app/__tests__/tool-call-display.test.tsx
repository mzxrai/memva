import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolCallDisplay } from '../components/events/ToolCallDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectContent } from '../test-utils/component-testing'
import type { ToolUseContent } from '../types/events'

describe('ToolCallDisplay component', () => {
  it('should render tool name and display visible content', () => {
    const readTool = MOCK_TOOLS.read('/path/to/file.ts')
    render(<ToolCallDisplay toolCall={readTool} />)

    expectContent.text('Read')
    expectContent.text('/path/to/file.ts')
  })

  it('should display icons for different tool types', () => {
    const tools = [
      { name: 'Read', factory: () => MOCK_TOOLS.read('/test.ts') },
      { name: 'Write', factory: () => MOCK_TOOLS.write('/test.ts', 'content') },
      { name: 'Edit', factory: () => MOCK_TOOLS.edit('/test.ts', 'old', 'new') },
      { name: 'Bash', factory: () => MOCK_TOOLS.bash('ls') },
    ]

    tools.forEach(({ name, factory }) => {
      const { unmount, container } = render(
        <ToolCallDisplay toolCall={factory()} />
      )

      expectContent.text(name)
      // Check that an icon is present (SVG element)
      const svgElement = container.querySelector('svg')
      expect(svgElement).toBeInTheDocument()

      unmount()
    })
  })

  it('should show primary parameter in header', () => {
    const readTool = MOCK_TOOLS.read('/path/to/file.ts')
    render(<ToolCallDisplay toolCall={readTool} />)

    // Should show the file path as primary parameter
    expectContent.text('/path/to/file.ts')
  })


  it('should show primary parameter for Edit tool', () => {
    // Create a longer edit to trigger expand/collapse behavior
    const oldCode = `const x = 1
const y = 2
const z = 3
function test() {
  console.log(x)
  console.log(y)
  console.log(z)
  return x + y + z
}
const result = test()
console.log(result)
// More lines to ensure we have > 10 lines`
    
    const newCode = `const x = 10
const y = 20
const z = 30
function test() {
  console.log(x)
  console.log(y)
  console.log(z)
  return x + y + z
}
const result = test()
console.log(result)
// More lines to ensure we have > 10 lines`
    
    const editTool = MOCK_TOOLS.edit('/path/to/file.ts', oldCode, newCode)

    render(
      <ToolCallDisplay
        toolCall={editTool}
        hasResult={true}
        result={{ content: "The file /path/to/file.ts has been updated. Here's the result of running `cat -n` on a snippet of the edited file:\n   1→const x = 10\n   2→const y = 20", is_error: false }}
      />
    )

    // Should show file path as primary parameter for Edit tool in the header
    const headerPath = screen.getAllByText('/path/to/file.ts')[0]
    expect(headerPath).toBeInTheDocument()
    
    // Edit tools show their diff in a collapsed state by default, need to expand
    const expandButton = screen.getByRole('button', { name: 'Expand' })
    fireEvent.click(expandButton)
    
    // Now the diff should be visible
    expectContent.text('const x = 1')
    expectContent.text('const x = 10')
  })

  it('should show diff for MultiEdit tool with multiple edits', () => {
    const multiEditInput = {
      file_path: '/path/to/file.ts',
      edits: [
        {
          old_string: `const x = 1
const a = 2
const b = 3
const c = 4
const d = 5`,
          new_string: `const x = 2
const a = 2
const b = 3
const c = 4
const d = 5`
        },
        {
          old_string: `const y = 3
const e = 6
const f = 7
const g = 8
const h = 9
const i = 10`,
          new_string: `const y = 4
const e = 6
const f = 7
const g = 8
const h = 9
const i = 10`
        }
      ]
    }

    const multiEditTool: ToolUseContent = {
      type: 'tool_use',
      id: 'toolu_01ABC123',
      name: 'MultiEdit',
      input: multiEditInput
    }

    render(
      <ToolCallDisplay
        toolCall={multiEditTool}
        hasResult={true}
        result={{ content: "The file /path/to/file.ts has been updated. Here's the result of running `cat -n` on a snippet of the edited file:\n   1→const x = 2\n   2→const y = 4", is_error: false }}
      />
    )

    // MultiEdit tools show their diff in a collapsed state by default, need to expand
    const expandButton = screen.getByRole('button', { name: 'Expand' })
    fireEvent.click(expandButton)
    
    // Now the diff should be visible - check for the first changed values
    expectContent.text('const x = 1')
    expectContent.text('const x = 2')
    expectContent.text('const y = 3')
    expectContent.text('const y = 4')

    // Should show edit summary instead of individual counters
    expectContent.text('2 edits applied')
  })

  it('should handle empty input gracefully', () => {
    const emptyTool: ToolUseContent = {
      type: 'tool_use',
      id: 'toolu_01ABC123',
      name: 'Read',
      input: {}
    }

    render(<ToolCallDisplay toolCall={emptyTool} />)

    // Should still show the tool name even with empty input
    expectContent.text('Read')
  })


  it('should apply custom className if provided', () => {
    const readTool = MOCK_TOOLS.read('/path/to/file.ts')
    const { container } = render(
      <ToolCallDisplay toolCall={readTool} className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should indicate when linked to a result', () => {
    const readTool = MOCK_TOOLS.read('/path/to/file.ts')
    render(
      <ToolCallDisplay toolCall={readTool} hasResult={true} />
    )

    // Should show some indication that result is available
    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveAttribute('data-status', 'success')
  })

  describe('with results', () => {
    it('should display result inline when provided', () => {
      const result = { content: 'File content here', is_error: false }

      const readTool = MOCK_TOOLS.read('/path/to/file.ts')
      render(
        <ToolCallDisplay toolCall={readTool} result={result} hasResult={true} />
      )

      // Should show ReadToolDisplay with line count
      expect(screen.getByText(/1 line loaded/)).toBeInTheDocument()
    })

    it('should show success status for successful Bash commands', () => {
      const bashTool = MOCK_TOOLS.bash('ls -la')

      const result = {
        content: 'file1.txt\nfile2.txt',
        is_error: false
      }

      render(
        <ToolCallDisplay toolCall={bashTool} result={result} hasResult={true} />
      )

      // Should show both lines since it's only 2 lines (our new format shows up to 3 lines inline)
      expect(screen.getByText(/file1\.txt[\s\S]*file2\.txt/)).toBeInTheDocument()
    })

    it('should show error status for failed Bash commands', () => {
      const bashTool = MOCK_TOOLS.bash('invalid-command')

      const result = {
        content: 'command not found: invalid-command',
        is_error: true
      }

      render(
        <ToolCallDisplay toolCall={bashTool} result={result} hasResult={true} />
      )

      // Should show the actual error content instead of "✗ Error"
      expect(screen.getByText(/command not found: invalid-command/)).toBeInTheDocument()
    })

    it('should collapse long results by default', () => {
      const longResult = { content: 'Line 1\n'.repeat(50), is_error: false } // 50 lines, long enough to trigger expand button

      const readTool = MOCK_TOOLS.read('/path/to/file.ts')
      render(
        <ToolCallDisplay toolCall={readTool} result={longResult} hasResult={true} />
      )

      // Should show collapsed state with expand button
      const expandButton = screen.getByRole('button', { name: /expand/i })

      // Click to expand
      fireEvent.click(expandButton)

      // The button should now be collapse
      expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument()
    })

    it('should handle Read tool results', () => {
      const readTool = MOCK_TOOLS.read('/path/to/file.ts')

      const result = { content: 'File contents here with multiple lines\nLine 2\nLine 3', is_error: false }

      render(
        <ToolCallDisplay toolCall={readTool} result={result} hasResult={true} />
      )

      // Should show file loaded indicator
      expect(screen.getByText(/3 lines loaded/)).toBeInTheDocument()
    })

    it('should handle Write tool results', () => {
      const writeTool = MOCK_TOOLS.write('/path/to/file.ts', 'new content')

      const result = { content: 'File created successfully', is_error: false }

      render(
        <ToolCallDisplay toolCall={writeTool} result={result} hasResult={true} />
      )

      // Should show WriteToolDisplay instead of old 'Updated' text
      expectContent.text('file.ts')
      expectContent.text('1 line')
      expectContent.text('11 B')

      // Should not show the old 'Updated' text anymore
      expect(screen.queryByText('Updated')).not.toBeInTheDocument()
    })

    it('should handle error results gracefully', () => {
      // For Read tools, errors would come as string results, but let's test with a bash tool instead
      // since Read tools typically return file content as strings, not error objects
      const result = {
        content: 'Permission denied',
        is_error: true
      }

      const bashTool = MOCK_TOOLS.bash('cat /forbidden/file.txt')
      render(
        <ToolCallDisplay toolCall={bashTool} result={result} hasResult={true} />
      )

      // Should show the actual error content instead of "✗ Error"
      expect(screen.getByText(/Permission denied/)).toBeInTheDocument()
    })

    it('should not show result section when result is null', () => {
      const readTool = MOCK_TOOLS.read('/path/to/file.ts')
      render(
        <ToolCallDisplay toolCall={readTool} result={null} />
      )

      // Should not show result section
      expect(screen.queryByText('Result')).not.toBeInTheDocument()
    })
  })
})