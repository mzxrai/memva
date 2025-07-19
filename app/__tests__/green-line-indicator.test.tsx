import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import MessageCarousel from '../components/MessageCarousel'
import { createMockAssistantEvent } from '../test-utils/factories'

describe('Green Line Indicator', () => {
  beforeEach(() => {
    // Clear localStorage and sessionStorage before each test
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('should show green line for new messages', async () => {
    const sessionId = 'test-session-1'
    const message = createMockAssistantEvent('Hello world', {
      uuid: 'msg-123',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    })

    const { rerender } = render(
      <MemoryRouter>
        <MessageCarousel sessionId={sessionId} latestMessage={null} />
      </MemoryRouter>
    )

    // Initially no message
    expect(screen.getByText('No assistant message yet')).toBeInTheDocument()

    // New message arrives
    rerender(
      <MemoryRouter>
        <MessageCarousel 
          sessionId={sessionId} 
          latestMessage={{
            uuid: message.uuid,
            timestamp: message.timestamp,
            data: message.data
          }} 
        />
      </MemoryRouter>
    )

    // Should display the message
    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument()
    })

    // Should have green line (opacity-100 class)
    const greenLine = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenLine).toHaveClass('opacity-100')
  })

  it('should not show green line for already seen messages', async () => {
    const sessionId = 'test-session-2'
    const message = createMockAssistantEvent('Already seen message', {
      uuid: 'msg-456',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    })

    // Mark message as seen in sessionStorage
    sessionStorage.setItem(`seenMessages-${sessionId}`, JSON.stringify(['msg-456']))

    render(
      <MemoryRouter>
        <MessageCarousel 
          sessionId={sessionId} 
          latestMessage={{
            uuid: message.uuid,
            timestamp: message.timestamp,
            data: message.data
          }} 
        />
      </MemoryRouter>
    )

    // Should display the message
    expect(screen.getByText('Already seen message')).toBeInTheDocument()

    // Should NOT have green line (opacity-0 class)
    const greenLine = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenLine).toHaveClass('opacity-0')
  })

  it('should persist green line state in localStorage', async () => {
    const sessionId = 'test-session-3'
    const message = createMockAssistantEvent('Persistent message', {
      uuid: 'msg-789',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    })

    render(
      <MemoryRouter>
        <MessageCarousel 
          sessionId={sessionId} 
          latestMessage={{
            uuid: message.uuid,
            timestamp: message.timestamp,
            data: message.data
          }} 
        />
      </MemoryRouter>
    )

    // Wait for the message to be marked as green
    await waitFor(() => {
      const stored = localStorage.getItem('memva_green_messages')
      expect(stored).toBeTruthy()
      
      const greenMessages = JSON.parse(stored || '{}')
      expect(greenMessages['msg-789']).toBeDefined()
      expect(greenMessages['msg-789'].sessionId).toBe(sessionId)
    })
  })

  it('should handle multiple messages correctly', async () => {
    const sessionId = 'test-session-4'
    const message1 = createMockAssistantEvent('First message', {
      uuid: 'msg-001',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    })

    const { rerender } = render(
      <MemoryRouter>
        <MessageCarousel 
          sessionId={sessionId} 
          latestMessage={{
            uuid: message1.uuid,
            timestamp: message1.timestamp,
            data: message1.data
          }} 
        />
      </MemoryRouter>
    )

    // First message should be green
    let greenLine = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenLine).toHaveClass('opacity-100')

    // Second message arrives
    const message2 = createMockAssistantEvent('Second message', {
      uuid: 'msg-002',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    })

    rerender(
      <MemoryRouter>
        <MessageCarousel 
          sessionId={sessionId} 
          latestMessage={{
            uuid: message2.uuid,
            timestamp: message2.timestamp,
            data: message2.data
          }} 
        />
      </MemoryRouter>
    )

    // Second message should also be green
    await waitFor(() => {
      expect(screen.getByText('Second message')).toBeInTheDocument()
    })
    
    greenLine = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenLine).toHaveClass('opacity-100')
  })
})