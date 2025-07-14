import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventRenderer } from '../components/events/EventRenderer'

describe('EventRenderer', () => {
  it('should render user message events with proper styling', () => {
    const userEvent = {
      type: 'user',
      content: 'Hello Claude, how are you?',
      timestamp: '2025-07-14T10:00:00.000Z',
      uuid: 'test-uuid-123'
    }

    render(<EventRenderer event={userEvent} />)

    expect(screen.getByText('Hello Claude, how are you?')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('should render assistant message events with text content', () => {
    const assistantEvent = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'text',
            text: 'I am doing well, thank you for asking!'
          }
        ]
      },
      timestamp: '2025-07-14T10:01:00.000Z',
      uuid: 'test-uuid-456'
    }

    render(<EventRenderer event={assistantEvent} />)

    expect(screen.getByText('I am doing well, thank you for asking!')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
  })

  it('should render system messages with appropriate styling', () => {
    const systemEvent = {
      type: 'system',
      content: 'Session started',
      timestamp: '2025-07-14T09:59:00.000Z',
      uuid: 'test-uuid-789'
    }

    render(<EventRenderer event={systemEvent} />)

    expect(screen.getByText('Session started')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('should render error events with error styling', () => {
    const errorEvent = {
      type: 'error',
      content: 'Something went wrong',
      timestamp: '2025-07-14T10:02:00.000Z',
      uuid: 'test-uuid-error'
    }

    render(<EventRenderer event={errorEvent} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('should render user cancellation events with appropriate styling', () => {
    const cancelEvent = {
      type: 'user_cancelled',
      content: 'Processing cancelled by user',
      timestamp: '2025-07-14T10:03:00.000Z',
      uuid: 'test-uuid-cancel'
    }

    render(<EventRenderer event={cancelEvent} />)

    expect(screen.getByText('Processing cancelled by user')).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('should fall back to JSON display for unknown event types', () => {
    const unknownEvent = {
      type: 'unknown_type',
      someData: 'test data',
      timestamp: '2025-07-14T10:04:00.000Z'
    }

    render(<EventRenderer event={unknownEvent} />)

    expect(screen.getByText('Raw Event Data')).toBeInTheDocument()
    expect(screen.getByText(/"someData": "test data"/)).toBeInTheDocument()
  })
})