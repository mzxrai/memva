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
    
    // Should show file path as primary parameter for Edit tool
    expect(screen.getByText('/path/to/file.ts')).toBeInTheDocument()
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
})