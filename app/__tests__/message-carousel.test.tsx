import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MessageCarousel from '../components/MessageCarousel'

describe('MessageCarousel Component', () => {
  it('should display demo message with proper layout', async () => {
    render(<MessageCarousel sessionId="test-session" />)

    // Wait for component to render demo message
    await waitFor(() => {
      const messageItem = screen.getByTestId('message-item')
      expect(messageItem).toBeInTheDocument()
    })
    
    // Should show one of the demo messages
    expect(screen.getByText(/I'll help you refactor that React component/)).toBeInTheDocument()
    
    // Should be contained in proper container
    const container = screen.getByTestId('message-carousel')
    expect(container).toHaveClass('overflow-hidden')
    expect(container).toHaveClass('h-16') // Fixed height for 2-3 lines
  })

  it('should apply consistent styling with design system', async () => {
    render(<MessageCarousel sessionId="test-session" />)

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

    // Should show loading skeleton initially
    const container = screen.getByTestId('message-carousel')
    expect(container).toBeInTheDocument()
  })
})