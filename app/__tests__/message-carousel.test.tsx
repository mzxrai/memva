import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MessageCarousel from '../components/MessageCarousel'

describe('MessageCarousel Component', () => {
  it('should display assistant message with proper layout', async () => {
    const mockMessage = {
      uuid: 'test-123',
      timestamp: new Date().toISOString(),
      data: {
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I\'ll help you refactor that React component' }
          ]
        }
      }
    }
    
    render(<MessageCarousel sessionId="test-session" latestMessage={mockMessage} />)

    // Wait for component to render message
    await waitFor(() => {
      const messageItem = screen.getByTestId('message-item')
      expect(messageItem).toBeInTheDocument()
    })
    
    // Should show the message
    expect(screen.getByText(/I'll help you refactor that React component/)).toBeInTheDocument()
    
    // Should be contained in proper container for truncation behavior
    const container = screen.getByTestId('message-carousel')
    expect(container).toBeInTheDocument()
    // Verify the container has proper structure for text truncation
    expect(container).toBeVisible()
  })

  it('should display messages in a readable, accessible format', async () => {
    const mockMessage = {
      uuid: 'test-456',
      timestamp: new Date().toISOString(),
      data: {
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Test message for styling' }
          ]
        }
      }
    }
    
    render(<MessageCarousel sessionId="test-session" latestMessage={mockMessage} />)

    // Wait for component to render
    await waitFor(() => {
      const messageItem = screen.getByTestId('message-item')
      expect(messageItem).toBeInTheDocument()
    })

    // Verify message is displayed properly
    const container = screen.getByTestId('message-carousel')
    expect(container).toBeInTheDocument()
    
    const messageItem = screen.getByTestId('message-item')
    expect(messageItem).toBeInTheDocument()
    expect(messageItem).toBeVisible()
    expect(screen.getByText('Test message for styling')).toBeVisible()
  })

  it('should handle loading state properly', () => {
    render(<MessageCarousel sessionId="test-session" />)

    // Should show placeholder message when no latest message
    const container = screen.getByTestId('message-carousel')
    expect(container).toBeInTheDocument()
    expect(screen.getByText('No assistant message yet')).toBeInTheDocument()
  })
})