import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToolCallDisplay } from '../components/events/ToolCallDisplay'
import type { ToolUseContent } from '../types/events'

describe('ToolCallDisplay Error Indicators', () => {
  const bashCall: ToolUseContent = {
    type: 'tool_use',
    id: 'test-tool-id',
    name: 'Bash',
    input: { command: 'ls /nonexistent' }
  }

  it('should show green checkmark for successful commands', () => {
    render(
      <ToolCallDisplay 
        toolCall={bashCall} 
        hasResult={true}
        result={{ stdout: 'file1.txt\nfile2.txt', stderr: '', interrupted: false }}
        isError={false}
      />
    )

    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toHaveClass('bg-emerald-400')
  })

  it('should show red X for failed commands', () => {
    render(
      <ToolCallDisplay 
        toolCall={bashCall} 
        hasResult={true}
        result={{ stdout: '', stderr: 'ls: /nonexistent: No such file or directory', interrupted: false }}
        isError={true}
      />
    )

    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toHaveClass('bg-red-400')
  })

  it('should show amber pause icon for interrupted commands', () => {
    render(
      <ToolCallDisplay 
        toolCall={bashCall} 
        hasResult={true}
        result={{ stdout: 'Partial output...', stderr: '', interrupted: true }}
        isError={false}
      />
    )

    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toHaveClass('bg-amber-400')
  })

  it('should prioritize interrupted state over error state', () => {
    render(
      <ToolCallDisplay 
        toolCall={bashCall} 
        hasResult={true}
        result={{ stdout: '', stderr: 'Error occurred', interrupted: true }}
        isError={true}
      />
    )

    const indicator = screen.getByTestId('tool-status-indicator')
    // Should show amber (interrupted) not red (error)
    expect(indicator).toHaveClass('bg-amber-400')
  })

  it('should show gray pulsing indicator for pending commands', () => {
    render(
      <ToolCallDisplay 
        toolCall={bashCall} 
        hasResult={false}
      />
    )

    const indicator = screen.getByTestId('tool-status-indicator')
    expect(indicator).toHaveClass('bg-zinc-600', 'animate-pulse')
  })
})