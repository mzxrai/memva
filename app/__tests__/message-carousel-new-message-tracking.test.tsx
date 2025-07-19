import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MessageCarousel from '../components/MessageCarousel'

// Mock the useNewMessageTracking hook
const mockMarkAsNew = vi.fn()
const mockHasNewMessage = vi.fn(() => false)

vi.mock('../hooks/useNewMessageTracking', () => ({
  useNewMessageTracking: vi.fn(() => ({
    hasNewMessage: mockHasNewMessage(),
    markAsNew: mockMarkAsNew,
    clearNewMessage: vi.fn()
  }))
}))

describe('MessageCarousel New Message Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasNewMessage.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not mark initial message as new when component mounts with a message', () => {
    const mockMessage = {
      uuid: 'initial-123',
      timestamp: new Date().toISOString(),
      data: {
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Initial message' }
          ]
        }
      }
    }
    
    render(<MessageCarousel sessionId="test-session" latestMessage={mockMessage} />)
    
    // Should not call markAsNew for initial message
    expect(mockMarkAsNew).not.toHaveBeenCalled()
  })

  it('should mark first message as new when it arrives after mounting with no message', async () => {
    const { rerender } = render(<MessageCarousel sessionId="test-session" />)
    
    // Verify no message is shown initially
    expect(screen.getByText('No assistant message yet')).toBeInTheDocument()
    expect(mockMarkAsNew).not.toHaveBeenCalled()
    
    // Simulate first message arriving
    const firstMessage = {
      uuid: 'first-456',
      timestamp: new Date().toISOString(),
      data: {
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'First arriving message' }
          ]
        }
      }
    }
    
    rerender(<MessageCarousel sessionId="test-session" latestMessage={firstMessage} />)
    
    // Should mark the first arriving message as new
    await waitFor(() => {
      expect(mockMarkAsNew).toHaveBeenCalledWith('first-456')
    })
  })

  it('should mark subsequent messages as new after initial mount', async () => {
    const initialMessage = {
      uuid: 'initial-789',
      timestamp: new Date().toISOString(),
      data: {
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Initial message' }
          ]
        }
      }
    }
    
    const { rerender } = render(<MessageCarousel sessionId="test-session" latestMessage={initialMessage} />)
    
    // Initial message should not be marked as new
    expect(mockMarkAsNew).not.toHaveBeenCalled()
    
    // Simulate new message arriving
    const newMessage = {
      uuid: 'new-101',
      timestamp: new Date().toISOString(),
      data: {
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'New message' }
          ]
        }
      }
    }
    
    rerender(<MessageCarousel sessionId="test-session" latestMessage={newMessage} />)
    
    // Should mark the new message as new
    await waitFor(() => {
      expect(mockMarkAsNew).toHaveBeenCalledWith('new-101')
    })
  })

  it('should not mark message as new if UUID has not changed', async () => {
    const sameMessage = {
      uuid: 'same-202',
      timestamp: new Date().toISOString(),
      data: {
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Same message' }
          ]
        }
      }
    }
    
    const { rerender } = render(<MessageCarousel sessionId="test-session" latestMessage={sameMessage} />)
    
    // Clear any initial calls
    vi.clearAllMocks()
    
    // Re-render with same message (same UUID)
    rerender(<MessageCarousel sessionId="test-session" latestMessage={sameMessage} />)
    
    // Should not mark as new since UUID hasn't changed
    expect(mockMarkAsNew).not.toHaveBeenCalled()
  })
})