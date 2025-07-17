import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToolCallDisplay } from '../components/events/ToolCallDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'

describe('Bash Tool Integration', () => {
  it('should display Bash tool result when passed correctly', () => {
    const bashTool = MOCK_TOOLS.bash('ls -la')
    const result = {
      content: 'file1.txt\nfile2.txt',
      is_error: false
    }
    
    render(
      <ToolCallDisplay 
        toolCall={bashTool}
        hasResult={true}
        result={result}
      />
    )

    // Should show the command in the header
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByText('ls -la')).toBeInTheDocument()
    
    // Should show the result preview
    expect(screen.getByText(/file1\.txt[\s\S]*file2\.txt/)).toBeInTheDocument()
  })
  
  it('should handle different result structures', () => {
    const bashTool = MOCK_TOOLS.bash('pwd')
    
    // Test with string result (might be how it's coming from the API)
    const { rerender } = render(
      <ToolCallDisplay 
        toolCall={bashTool}
        hasResult={true}
        result="/Users/test/project"
      />
    )
    
    // Should NOT show preview for string results (BashToolDisplay expects object)
    expect(screen.queryByText('/Users/test/project')).not.toBeInTheDocument()
    
    // Test with proper object result
    rerender(
      <ToolCallDisplay 
        toolCall={bashTool}
        hasResult={true}
        result={{ content: '/Users/test/project', is_error: false }}
      />
    )
    
    // Should show preview for object results
    expect(screen.getByText('/Users/test/project')).toBeInTheDocument()
  })
})