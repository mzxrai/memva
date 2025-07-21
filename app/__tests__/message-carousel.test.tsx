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
    
    // Should be contained in proper container
    const container = screen.getByTestId('message-carousel')
    expect(container).toHaveClass('overflow-hidden')
    expect(container).toHaveClass('h-16') // Fixed height for 2-3 lines
  })

  it('should apply consistent styling with design system', async () => {
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

    // Should follow design system patterns
    const container = screen.getByTestId('message-carousel')
    expect(container).toHaveClass('overflow-hidden')
    expect(container).toHaveClass('relative')
    
    const messageItem = screen.getByTestId('message-item')
    expect(messageItem).toHaveClass('text-zinc-300')
    expect(messageItem).toHaveClass('text-sm')
    expect(messageItem).toHaveClass('font-mono')
    expect(messageItem).toHaveClass('leading-5')
  })

  it('should handle loading state properly', () => {
    render(<MessageCarousel sessionId="test-session" />)

    // Should show placeholder message when no latest message
    const container = screen.getByTestId('message-carousel')
    expect(container).toBeInTheDocument()
    expect(screen.getByText('No assistant message yet')).toBeInTheDocument()
  })
})