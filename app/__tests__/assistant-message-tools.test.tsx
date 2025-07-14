import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventRenderer } from '../components/events/EventRenderer'

describe('Assistant Message Tool Rendering', () => {
  it('should render tool use content with tool name and parameters', () => {
    const assistantEventWithTool = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'Read',
            input: {
              file_path: '/Users/test/file.ts',
              limit: 100
            }
          }
        ]
      },
      timestamp: '2025-07-14T10:01:00.000Z',
      uuid: 'test-uuid-tool'
    }

    render(<EventRenderer event={assistantEventWithTool} />)

    expect(screen.getByText('Tool:')).toBeInTheDocument()
    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.getByText(/"file_path": "\/Users\/test\/file.ts"/)).toBeInTheDocument()
    expect(screen.getByText(/"limit": 100/)).toBeInTheDocument()
  })

  it('should render thinking content as collapsible details', () => {
    const assistantEventWithThinking = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'thinking',
            text: 'Let me think about this problem step by step...'
          }
        ]
      },
      timestamp: '2025-07-14T10:01:00.000Z',
      uuid: 'test-uuid-thinking'
    }

    render(<EventRenderer event={assistantEventWithThinking} />)

    expect(screen.getByText('🤔 Thinking...')).toBeInTheDocument()
    expect(screen.getByText('Let me think about this problem step by step...')).toBeInTheDocument()
  })

  it('should render mixed content with text and tool use', () => {
    const assistantEventMixed = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'text',
            text: 'I need to read the file first.'
          },
          {
            type: 'tool_use',
            id: 'toolu_456',
            name: 'Read',
            input: {
              file_path: '/Users/test/config.json'
            }
          }
        ]
      },
      timestamp: '2025-07-14T10:02:00.000Z',
      uuid: 'test-uuid-mixed'
    }

    render(<EventRenderer event={assistantEventMixed} />)

    expect(screen.getByText('I need to read the file first.')).toBeInTheDocument()
    expect(screen.getByText('Tool:')).toBeInTheDocument()
    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.getByText(/"file_path": "\/Users\/test\/config.json"/)).toBeInTheDocument()
  })

  it('should handle assistant events with simple content structure', () => {
    const simpleAssistantEvent = {
      type: 'assistant',
      content: 'Simple response text',
      timestamp: '2025-07-14T10:03:00.000Z',
      uuid: 'test-uuid-simple'
    }

    render(<EventRenderer event={simpleAssistantEvent} />)

    expect(screen.getByText('Simple response text')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
  })

  it('should handle assistant events from database with data field', () => {
    const databaseEvent = {
      type: 'assistant',
      data: {
        message: {
          content: [
            {
              type: 'text',
              text: 'Response from database event'
            }
          ]
        }
      },
      timestamp: '2025-07-14T10:04:00.000Z',
      uuid: 'test-uuid-db'
    }

    render(<EventRenderer event={databaseEvent} />)

    expect(screen.getByText('Response from database event')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
  })
})