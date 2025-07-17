import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AssistantMessageEvent } from '../components/events/AssistantMessageEvent'
import { createMockEvent } from '../test-utils/factories'

describe('Tool Result Format Fix', () => {
  it('should handle tool results with standardized format from sessions page', () => {
    // Create a mock tool use event
    const toolUseEvent = createMockEvent({
      event_type: 'assistant',
      data: {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: 'tool_123',
            name: 'Bash',
            input: { command: 'ls -la' }
          }]
        }
      }
    })

    // Create the tool results map as it would be created by sessions.$sessionId.tsx after our fix
    const toolResults = new Map()
    
    // Simulate what our fix does: wrap string tool result content in standardized format
    const rawToolResult = 'file1.txt\nfile2.txt\nfile3.txt'
    const standardizedResult = {
      content: rawToolResult,
      is_error: false
    }
    
    toolResults.set('tool_123', {
      result: standardizedResult,
      isError: false
    })

    // Render the component with the standardized tool results
    const { container } = render(
      <AssistantMessageEvent 
        event={toolUseEvent}
        toolResults={toolResults}
      />
    )

    // The component should render without errors and display the tool properly
    expect(container).toBeInTheDocument()
    
    // Check that the tool status indicator shows success (green)
    const statusIndicator = container.querySelector('[data-testid="tool-status-indicator"]')
    expect(statusIndicator).toHaveAttribute('data-status', 'success')
    
    // Verify the tool result content is displayed correctly
    expect(container.textContent).toContain('file1.txt')
  })

  it('should demonstrate the problem when tool results are plain strings', () => {
    // Create a mock tool use event
    const toolUseEvent = createMockEvent({
      event_type: 'assistant', 
      data: {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: 'tool_456',
            name: 'Bash',
            input: { command: 'echo hello' }
          }]
        }
      }
    })

    // Create tool results map with plain string (the old problematic format)
    const toolResults = new Map()
    toolResults.set('tool_456', {
      result: 'hello world', // Plain string instead of {content: string, is_error: boolean}
      isError: false
    })

    // This should still render but the BashToolDisplay component won't format it properly
    const { container } = render(
      <AssistantMessageEvent 
        event={toolUseEvent}
        toolResults={toolResults}
      />
    )

    expect(container).toBeInTheDocument()
    
    // The status indicator should still show success
    const statusIndicator = container.querySelector('[data-testid="tool-status-indicator"]')
    expect(statusIndicator).toHaveAttribute('data-status', 'success')
  })
})