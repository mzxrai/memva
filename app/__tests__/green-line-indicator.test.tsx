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

    // Mark message as seen in localStorage with timestamp structure
    localStorage.setItem(`seenMessages-${sessionId}`, JSON.stringify([
      { uuid: 'msg-456', timestamp: Date.now() }
    ]))

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

  it('should NOT show green line when user is viewing the active session', async () => {
    const sessionId = 'test-session-5'
    
    // Mark this session as active (user is currently viewing it)
    localStorage.setItem('activeSession', sessionId)
    
    const message = createMockAssistantEvent('Message while viewing', {
      uuid: 'msg-active-001',
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

    // Should display the message
    await waitFor(() => {
      expect(screen.getByText('Message while viewing')).toBeInTheDocument()
    })

    // Should NOT have green line since user is actively viewing this session
    const greenLine = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenLine).toHaveClass('opacity-0')
    
    // Should still be marked as seen
    const seenMessages = JSON.parse(localStorage.getItem(`seenMessages-${sessionId}`) || '[]')
    expect(seenMessages.some((m: any) => m.uuid === 'msg-active-001')).toBe(true)
  })

  it('should show green line when user is viewing a different session', async () => {
    const sessionId = 'test-session-6'
    const otherSessionId = 'other-session'
    
    // Mark a different session as active
    localStorage.setItem('activeSession', otherSessionId)
    
    const message = createMockAssistantEvent('Message for inactive session', {
      uuid: 'msg-inactive-001',
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

    // Should display the message
    await waitFor(() => {
      expect(screen.getByText('Message for inactive session')).toBeInTheDocument()
    })

    // SHOULD have green line since user is viewing a different session
    const greenLine = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenLine).toHaveClass('opacity-100')
  })

  it('should clean up old seen messages after 24 hours', async () => {
    const sessionId = 'test-session-7'
    const now = Date.now()
    const oneDayAgo = now - (24 * 60 * 60 * 1000)
    const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000)
    
    // Set up seen messages with different ages
    localStorage.setItem(`seenMessages-${sessionId}`, JSON.stringify([
      { uuid: 'old-msg', timestamp: twoDaysAgo },
      { uuid: 'recent-msg', timestamp: oneDayAgo + 1000 }, // Just within 24 hours
      { uuid: 'new-msg', timestamp: now }
    ]))
    
    const message = createMockAssistantEvent('Test message', {
      uuid: 'test-msg',
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
    
    // Wait for cleanup to run
    await waitFor(() => {
      const seenMessages = JSON.parse(localStorage.getItem(`seenMessages-${sessionId}`) || '[]')
      
      // Old message should be removed
      expect(seenMessages.some((m: any) => m.uuid === 'old-msg')).toBe(false)
      
      // Recent messages should remain
      expect(seenMessages.some((m: any) => m.uuid === 'recent-msg')).toBe(true)
      expect(seenMessages.some((m: any) => m.uuid === 'new-msg')).toBe(true)
    })
  })
})