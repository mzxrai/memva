import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolCallDisplay } from '../components/events/ToolCallDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectSemanticMarkup, expectContent } from '../test-utils/component-testing'
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
  
  it('should render parameters in collapsed state by default', () => {
    const readTool = MOCK_TOOLS.read('/path/to/file.ts')
    render(<ToolCallDisplay toolCall={readTool} />)
    
    // Parameters should not be visible initially
    expect(screen.queryByText('file_path')).not.toBeInTheDocument()
  })
  
  it('should expand to show parameters when clicked', () => {
    const readTool = MOCK_TOOLS.read('/path/to/file.ts')
    render(<ToolCallDisplay toolCall={readTool} />)
    
    // Click to expand
    const expandButton = screen.getByRole('button', { name: 'Show parameters' })
    fireEvent.click(expandButton)
    
    // Parameters should now be visible in the JSON code block
    const codeBlock = screen.getByLabelText('code block')
    expect(codeBlock).toHaveTextContent('"file_path": "/path/to/file.ts"')
  })
  
  it('should show primary parameter for Edit tool', () => {
    const editTool = MOCK_TOOLS.edit('/path/to/file.ts', 'const x = 1', 'const x = 2')
    
    render(
      <ToolCallDisplay 
        toolCall={editTool}
        hasResult={true}
        result="The file /path/to/file.ts has been updated. Here's the result of running `cat -n` on a snippet of the edited file:\n   1→const x = 2"
      />
    )
    
    // Should show file path as primary parameter for Edit tool in the header
    const headerElement = screen.getByRole('button', { name: 'Hide parameters' })
    expect(headerElement).toHaveTextContent('/path/to/file.ts')
    
    // Should auto-expand to show diff for Edit tools
    expectContent.text('const x = 1')
    expectContent.text('const x = 2')
  })

  it('should show diff for MultiEdit tool with multiple edits', () => {
    const multiEditInput = {
      file_path: '/path/to/file.ts',
      edits: [
        {
          old_string: 'const x = 1',
          new_string: 'const x = 2'
        },
        {
          old_string: 'const y = 3',
          new_string: 'const y = 4'
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
        result="The file /path/to/file.ts has been updated. Here's the result of running `cat -n` on a snippet of the edited file:\n   1→const x = 2\n   2→const y = 4"
      />
    )
    
    // Should auto-expand to show unified diff for MultiEdit tools
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
  
  it('should render complex nested input properly', () => {
    const nestedInput = {
      options: {
        recursive: true,
        pattern: '*.ts'
      },
      paths: ['/src', '/tests']
    }
    
    const complexTool: ToolUseContent = {
      type: 'tool_use',
      id: 'toolu_01ABC123',
      name: 'Grep',
      input: nestedInput
    }
    
    render(<ToolCallDisplay toolCall={complexTool} />)
    
    // Expand to see parameters
    const expandButton = screen.getByRole('button', { name: 'Show parameters' })
    fireEvent.click(expandButton)
    
    // Should render JSON nicely
    expect(screen.getByText(/"recursive":/)).toBeInTheDocument()
    expect(screen.getByText(/true/)).toBeInTheDocument()
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
      const result = {
        stdout: 'File content here',
        stderr: '',
        interrupted: false
      }
      
      const readTool = MOCK_TOOLS.read('/path/to/file.ts')
      render(
        <ToolCallDisplay toolCall={readTool} result={result} />
      )
      
      // Should show result content
      expect(screen.getByText(/stdout.*File content here/)).toBeInTheDocument()
    })
    
    it('should show success status for successful Bash commands', () => {
      const bashTool = MOCK_TOOLS.bash('ls -la')
      
      const result = {
        stdout: 'file1.txt\nfile2.txt',
        stderr: '',
        interrupted: false
      }
      
      render(
        <ToolCallDisplay toolCall={bashTool} result={result} />
      )
      
      // Should show result with line count
      expect(screen.getByText(/file1\.txt.*\+1 more/)).toBeInTheDocument()
    })
    
    it('should show error status for failed Bash commands', () => {
      const bashTool = MOCK_TOOLS.bash('invalid-command')
      
      const result = {
        stdout: '',
        stderr: 'command not found: invalid-command',
        interrupted: false
      }
      
      render(
        <ToolCallDisplay toolCall={bashTool} result={result} />
      )
      
      // Should show error indicator
      expect(screen.getByText(/✗/)).toBeInTheDocument()
      // Error is shown in the brief message for short errors
      expect(screen.getByText(/✗ Error/)).toBeInTheDocument()
    })
    
    it('should collapse long results by default', () => {
      const longResult = {
        stdout: 'Line 1\n'.repeat(50),
        stderr: '',
        interrupted: false
      }
      
      const readTool = MOCK_TOOLS.read('/path/to/file.ts')
      render(
        <ToolCallDisplay toolCall={readTool} result={longResult} />
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
      
      const result = 'File contents here with multiple lines\nLine 2\nLine 3'
      
      render(
        <ToolCallDisplay toolCall={readTool} result={result} />
      )
      
      // Should show file loaded indicator
      expect(screen.getByText(/3 lines loaded/)).toBeInTheDocument()
    })
    
    it('should handle Write tool results', () => {
      const writeTool = MOCK_TOOLS.write('/path/to/file.ts', 'new content')
      
      const result = { success: true }
      
      render(
        <ToolCallDisplay toolCall={writeTool} result={result} />
      )
      
      // Should show success indicator
      expectContent.text('Updated')
    })
    
    it('should handle error results gracefully', () => {
      const result = {
        error: 'Permission denied',
        is_error: true
      }
      
      const readTool = MOCK_TOOLS.read('/path/to/file.ts')
      render(
        <ToolCallDisplay toolCall={readTool} result={result} />
      )
      
      // Should show error
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