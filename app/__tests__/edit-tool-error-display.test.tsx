import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditToolDisplay } from '../components/events/tools/EditToolDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'

describe('EditToolDisplay Error Handling', () => {
  it('should display error message for failed Edit operation', () => {
    const editTool = MOCK_TOOLS.edit('/test/file.txt', 'old content', 'new content')
    const errorResult = {
      content: 'Error: File not found at /test/file.txt',
      is_error: true
    }
    
    render(
      <EditToolDisplay 
        toolCall={editTool} 
        hasResult={true}
        result={errorResult}
        lineInfo={null}
      />
    )

    // Error message should be displayed and accessible
    const errorText = 'Error: File not found at /test/file.txt'
    expect(screen.getByText(errorText)).toBeInTheDocument()
    
    // Verify error is properly marked for accessibility
    const errorElement = screen.getByText(errorText)
    expect(errorElement).toBeVisible()
  })

  it('should display error message for failed MultiEdit operation', () => {
    const multiEditTool = {
      id: 'test-multiedit-1',
      name: 'MultiEdit' as const,
      type: 'tool_use' as const,
      input: {
        file_path: '/test/file.txt',
        edits: [
          { old_string: 'foo', new_string: 'bar' },
          { old_string: 'baz', new_string: 'qux' }
        ]
      }
    }
    
    const errorResult = {
      content: 'Error: Could not find "baz" in the file',
      is_error: true
    }
    
    render(
      <EditToolDisplay 
        toolCall={multiEditTool} 
        hasResult={true}
        result={errorResult}
        lineInfo={null}
      />
    )

    // Error message should be displayed
    expect(screen.getByText('Error: Could not find "baz" in the file')).toBeInTheDocument()
  })

  it('should display generic error message when content is not a string', () => {
    const editTool = MOCK_TOOLS.edit('/test/file.txt', 'old', 'new')
    const errorResult = {
      content: { error: 'complex error object' },
      is_error: true
    }
    
    render(
      <EditToolDisplay 
        toolCall={editTool} 
        hasResult={true}
        result={errorResult}
        lineInfo={null}
      />
    )

    // Should show generic error message
    expect(screen.getByText('Edit operation failed')).toBeInTheDocument()
  })

  it('should not display diff viewer when there is an error', () => {
    const editTool = MOCK_TOOLS.edit('/test/file.txt', 'old content', 'new content')
    const errorResult = {
      content: 'Error occurred',
      is_error: true
    }
    
    render(
      <EditToolDisplay 
        toolCall={editTool} 
        hasResult={true}
        result={errorResult}
        lineInfo={null}
      />
    )

    // Should not render any diff viewer elements
    expect(screen.queryByText('old content')).not.toBeInTheDocument()
    expect(screen.queryByText('new content')).not.toBeInTheDocument()
  })

  it('should display diff viewer for successful operations', () => {
    const editTool = MOCK_TOOLS.edit('/test/file.txt', 'old content', 'new content')
    const successResult = {
      content: 'File updated successfully',
      is_error: false
    }
    
    render(
      <EditToolDisplay 
        toolCall={editTool} 
        hasResult={true}
        result={successResult}
        lineInfo={null}
      />
    )

    // Should render diff viewer (checking for old/new content)
    // Note: The actual diff viewer implementation might render these differently
    // This test verifies that we're not showing error UI for successful operations
    expect(screen.queryByText('File updated successfully')).not.toBeInTheDocument()
    expect(screen.queryByText('Edit operation failed')).not.toBeInTheDocument()
  })
})