import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToolCallDisplay } from '../components/events/ToolCallDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'

describe('ToolCallDisplay Status Indicators', () => {
  it('should indicate successful command completion', () => {
    const bashTool = MOCK_TOOLS.bash('ls /home')
    
    render(
      <ToolCallDisplay 
        toolCall={bashTool} 
        hasResult={true}
        result={{ stdout: 'file1.txt\nfile2.txt', stderr: '', interrupted: false }}
        isError={false}
      />
    )

    // Status indicator should be present and indicate success
    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveAttribute('data-status', 'success')
  })

  it('should indicate failed command execution', () => {
    const bashTool = MOCK_TOOLS.bash('ls /nonexistent')
    
    render(
      <ToolCallDisplay 
        toolCall={bashTool} 
        hasResult={true}
        result={{ stdout: '', stderr: 'ls: /nonexistent: No such file or directory', interrupted: false }}
        isError={true}
      />
    )

    // Status indicator should indicate error
    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveAttribute('data-status', 'error')
  })

  it('should indicate interrupted command execution', () => {
    const bashTool = MOCK_TOOLS.bash('long-running-command')
    
    render(
      <ToolCallDisplay 
        toolCall={bashTool} 
        hasResult={true}
        result={{ stdout: 'Partial output...', stderr: '', interrupted: true }}
        isError={false}
      />
    )

    // Status indicator should indicate interrupted
    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveAttribute('data-status', 'interrupted')
  })

  it('should prioritize interrupted status over error status', () => {
    const bashTool = MOCK_TOOLS.bash('command-that-fails')
    
    render(
      <ToolCallDisplay 
        toolCall={bashTool} 
        hasResult={true}
        result={{ stdout: '', stderr: 'Error occurred', interrupted: true }}
        isError={true}
      />
    )

    // Should show interrupted status, not error status
    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveAttribute('data-status', 'interrupted')
  })

  it('should indicate pending command execution', () => {
    const bashTool = MOCK_TOOLS.bash('pending-command')
    
    render(
      <ToolCallDisplay 
        toolCall={bashTool} 
        hasResult={false}
      />
    )

    // Status indicator should indicate pending
    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveAttribute('data-status', 'pending')
  })

  it('should show correct tool name and primary parameter', () => {
    const readTool = MOCK_TOOLS.read('/test/file.txt')
    
    render(
      <ToolCallDisplay 
        toolCall={readTool} 
        hasResult={true}
        result="File content here"
        isError={false}
      />
    )

    // Should display tool name and file path
    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.getByText('/test/file.txt')).toBeInTheDocument()
  })

  it('should handle various tool types correctly', () => {
    const writeTool = MOCK_TOOLS.write('/test/output.txt', 'content')
    
    render(
      <ToolCallDisplay 
        toolCall={writeTool} 
        hasResult={true}
        result={{ success: true }}
        isError={false}
      />
    )

    // Should display write tool information
    expect(screen.getByText('Write')).toBeInTheDocument()
    expect(screen.getByText('/test/output.txt')).toBeInTheDocument()
    
    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toHaveAttribute('data-status', 'success')
  })
})