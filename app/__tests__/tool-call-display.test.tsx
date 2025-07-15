import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolCallDisplay } from '../components/events/ToolCallDisplay'
import type { ToolUseContent } from '../types/events'

describe('ToolCallDisplay component', () => {
  const basicToolCall: ToolUseContent = {
    type: 'tool_use',
    id: 'toolu_01ABC123',
    name: 'Read',
    input: {
      file_path: '/path/to/file.ts'
    }
  }
  
  it('should render tool name with proper styling', () => {
    render(<ToolCallDisplay toolCall={basicToolCall} />)
    
    expect(screen.getByText('Read')).toBeInTheDocument()
    // Should use monospace font for tool name
    expect(screen.getByText('Read')).toHaveClass('font-mono')
  })
  
  it('should display appropriate icon for different tool types', () => {
    const tools = [
      { name: 'Read', iconTestId: 'read-icon' },
      { name: 'Write', iconTestId: 'write-icon' },
      { name: 'Edit', iconTestId: 'edit-icon' },
      { name: 'Bash', iconTestId: 'bash-icon' },
      { name: 'Task', iconTestId: 'task-icon' },
      { name: 'WebFetch', iconTestId: 'web-icon' },
      { name: 'Grep', iconTestId: 'search-icon' },
    ]
    
    tools.forEach(({ name, iconTestId }) => {
      const { unmount } = render(
        <ToolCallDisplay toolCall={{ ...basicToolCall, name }} />
      )
      expect(screen.getByTestId(iconTestId)).toBeInTheDocument()
      unmount()
    })
  })
  
  it('should show primary parameter in header', () => {
    render(<ToolCallDisplay toolCall={basicToolCall} />)
    
    // Should show the file path as primary parameter
    expect(screen.getByText('/path/to/file.ts')).toBeInTheDocument()
    expect(screen.getByText('/path/to/file.ts')).toHaveClass('font-mono')
  })
  
  it('should render parameters in collapsed state by default', () => {
    render(<ToolCallDisplay toolCall={basicToolCall} />)
    
    // Parameters should not be visible initially
    expect(screen.queryByText('file_path')).not.toBeInTheDocument()
  })
  
  it('should expand to show parameters when clicked', () => {
    render(<ToolCallDisplay toolCall={basicToolCall} />)
    
    // Click to expand
    const expandButton = screen.getByRole('button', { name: /show parameters/i })
    fireEvent.click(expandButton)
    
    // Parameters should now be visible in the JSON code block
    const codeBlock = screen.getByLabelText('code block')
    expect(codeBlock).toHaveTextContent('"file_path": "/path/to/file.ts"')
  })
  
  it('should show primary parameter for Edit tool', () => {
    const complexInput = {
      file_path: '/path/to/file.ts',
      old_string: 'const x = 1',
      new_string: 'const x = 2'
    }
    
    render(
      <ToolCallDisplay 
        toolCall={{ ...basicToolCall, name: 'Edit', input: complexInput }} 
      />
    )
    
    // Should show file path as primary parameter for Edit tool in the header
    const headerElement = screen.getByRole('button', { name: /hide parameters/i })
    expect(headerElement).toHaveTextContent('/path/to/file.ts')
    
    // Should auto-expand to show diff for Edit tools
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
    expect(screen.getByText('const x = 2')).toBeInTheDocument()
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
    
    render(
      <ToolCallDisplay 
        toolCall={{ ...basicToolCall, name: 'MultiEdit', input: multiEditInput }} 
      />
    )
    
    // Should auto-expand to show unified diff for MultiEdit tools
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
    expect(screen.getByText('const x = 2')).toBeInTheDocument()
    expect(screen.getByText('const y = 3')).toBeInTheDocument()
    expect(screen.getByText('const y = 4')).toBeInTheDocument()
    
    // Should show edit summary instead of individual counters
    expect(screen.getByText('2 edits applied')).toBeInTheDocument()
  })
  
  it('should handle empty input gracefully', () => {
    render(
      <ToolCallDisplay toolCall={{ ...basicToolCall, input: {} }} />
    )
    
    // Should still show the tool name even with empty input
    expect(screen.getByText('Read')).toBeInTheDocument()
  })
  
  it('should render complex nested input properly', () => {
    const nestedInput = {
      options: {
        recursive: true,
        pattern: '*.ts'
      },
      paths: ['/src', '/tests']
    }
    
    render(
      <ToolCallDisplay 
        toolCall={{ ...basicToolCall, input: nestedInput }} 
      />
    )
    
    // Expand to see parameters
    fireEvent.click(screen.getByRole('button', { name: /show parameters/i }))
    
    // Should render JSON nicely
    expect(screen.getByText(/"recursive":/)).toBeInTheDocument()
    expect(screen.getByText(/true/)).toBeInTheDocument()
  })
  
  it('should apply custom className if provided', () => {
    const { container } = render(
      <ToolCallDisplay toolCall={basicToolCall} className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
  
  it('should indicate when linked to a result', () => {
    render(
      <ToolCallDisplay toolCall={basicToolCall} hasResult={true} />
    )
    
    // Should show some indication that result is available
    expect(screen.getByTestId('has-result-indicator')).toBeInTheDocument()
  })
  
  describe('with results', () => {
    it('should display result inline when provided', () => {
      const result = {
        stdout: 'File content here',
        stderr: '',
        interrupted: false
      }
      
      render(
        <ToolCallDisplay toolCall={basicToolCall} result={result} />
      )
      
      // Should show result content
      expect(screen.getByText(/stdout.*File content here/)).toBeInTheDocument()
    })
    
    it('should show success status for successful Bash commands', () => {
      const bashCall: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_01ABC123',
        name: 'Bash',
        input: { command: 'ls -la' }
      }
      
      const result = {
        stdout: 'file1.txt\nfile2.txt',
        stderr: '',
        interrupted: false
      }
      
      render(
        <ToolCallDisplay toolCall={bashCall} result={result} />
      )
      
      // Should show result with line count
      expect(screen.getByText(/file1\.txt.*\+1 more/)).toBeInTheDocument()
    })
    
    it('should show error status for failed Bash commands', () => {
      const bashCall: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_01ABC123',
        name: 'Bash',
        input: { command: 'invalid-command' }
      }
      
      const result = {
        stdout: '',
        stderr: 'command not found: invalid-command',
        interrupted: false
      }
      
      render(
        <ToolCallDisplay toolCall={bashCall} result={result} />
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
      
      render(
        <ToolCallDisplay toolCall={basicToolCall} result={longResult} />
      )
      
      // Should show collapsed state with expand button
      const expandButton = screen.getByRole('button', { name: /expand/i })
      expect(expandButton).toBeInTheDocument()
      
      // Click to expand
      fireEvent.click(expandButton)
      
      // The button should now be collapse
      expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument()
    })
    
    it('should handle Read tool results', () => {
      const readCall: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_01ABC123',
        name: 'Read',
        input: { file_path: '/path/to/file.ts' }
      }
      
      const result = 'File contents here with multiple lines\nLine 2\nLine 3'
      
      render(
        <ToolCallDisplay toolCall={readCall} result={result} />
      )
      
      // Should show file loaded indicator
      expect(screen.getByText(/3 lines loaded/)).toBeInTheDocument()
    })
    
    it('should handle Write tool results', () => {
      const writeCall: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_01ABC123',
        name: 'Write',
        input: { file_path: '/path/to/file.ts', content: 'new content' }
      }
      
      const result = { success: true }
      
      render(
        <ToolCallDisplay toolCall={writeCall} result={result} />
      )
      
      // Should show success indicator
      expect(screen.getByText('Updated')).toBeInTheDocument()
    })
    
    it('should handle error results gracefully', () => {
      const result = {
        error: 'Permission denied',
        is_error: true
      }
      
      render(
        <ToolCallDisplay toolCall={basicToolCall} result={result} />
      )
      
      // Should show error
      expect(screen.getByText(/Permission denied/)).toBeInTheDocument()
    })
    
    it('should not show result section when result is null', () => {
      render(
        <ToolCallDisplay toolCall={basicToolCall} result={null} />
      )
      
      // Should not show result section
      expect(screen.queryByText('Result')).not.toBeInTheDocument()
    })
  })
})