import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
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

  it('should show green line for new messages when session has no activity', async () => {
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

    // Since there's no activity record for this session, message should be green
    const greenIndicator = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenIndicator).toHaveClass('opacity-100')
  })

  it('should not show green line for messages older than last activity', async () => {
    const sessionId = 'test-session-2'
    const activityTime = new Date()
    const messageTime = new Date(activityTime.getTime() - 5000) // Message 5 seconds BEFORE activity
    
    const message = createMockAssistantEvent('Old message', {
      uuid: 'msg-456',
      session_id: sessionId,
      timestamp: messageTime.toISOString()
    })

    // Mark session as having activity AFTER the message was sent
    localStorage.setItem('memvaSessionActivity', JSON.stringify({
      [sessionId]: activityTime.getTime()
    }))

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
    expect(screen.getByText('Old message')).toBeInTheDocument()

    // Message should NOT be green since it's older than last activity
    const greenIndicator = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenIndicator).toHaveClass('opacity-0')
  })

  it('should show green line for messages newer than last activity', async () => {
    const sessionId = 'test-session-3'
    const activityTime = new Date()
    const messageTime = new Date(activityTime.getTime() + 5000) // 5 seconds after activity
    
    const message = createMockAssistantEvent('New message after activity', {
      uuid: 'msg-789',
      session_id: sessionId,
      timestamp: messageTime.toISOString()
    })

    // Mark session as having activity before the message
    localStorage.setItem('memvaSessionActivity', JSON.stringify({
      [sessionId]: activityTime.getTime()
    }))

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
    expect(screen.getByText('New message after activity')).toBeInTheDocument()

    // Message should be green since it's newer than last activity
    const greenIndicator = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenIndicator).toHaveClass('opacity-100')
  })

  it('should not show green line for messages older than 24 hours', async () => {
    const sessionId = 'test-session-4'
    const oldMessageTime = new Date(Date.now() - (25 * 60 * 60 * 1000)) // 25 hours ago
    
    const message = createMockAssistantEvent('Very old message', {
      uuid: 'msg-old',
      session_id: sessionId,
      timestamp: oldMessageTime.toISOString()
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
    expect(screen.getByText('Very old message')).toBeInTheDocument()

    // Message should NOT be green since it's older than 24 hours
    const greenIndicator = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenIndicator).toHaveClass('opacity-0')
  })

  it('should update green status when activity changes in another tab', async () => {
    const sessionId = 'test-session-5'
    const messageTime = new Date()
    const message = createMockAssistantEvent('Cross-tab message', {
      uuid: 'msg-cross',
      session_id: sessionId,
      timestamp: messageTime.toISOString()
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

    // Initially should be green (no activity)
    let greenIndicator = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
    expect(greenIndicator).toHaveClass('opacity-100')

    // Update localStorage to simulate another tab marking activity AFTER the message
    const activityTime = messageTime.getTime() + 5000 // 5 seconds after message
    const newActivity = JSON.stringify({ [sessionId]: activityTime })
    localStorage.setItem('memvaSessionActivity', newActivity)
    
    // Simulate storage event from another tab
    const storageEvent = new StorageEvent('storage', {
      key: 'memvaSessionActivity',
      newValue: newActivity,
      storageArea: localStorage
    })
    
    act(() => {
      window.dispatchEvent(storageEvent)
    })

    // Wait for the component to update
    await waitFor(() => {
      greenIndicator = screen.getByTestId('message-carousel').querySelector('.bg-emerald-500')
      expect(greenIndicator).toHaveClass('opacity-0')
    })
  })
})