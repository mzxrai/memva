import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('useEventPolling Hook', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    vi.useFakeTimers()
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    vi.useRealTimers()
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should poll database for new events every 2 seconds', async () => {
    const { useEventPolling } = await import('../hooks/useEventPolling')
    
    const sessionId = 'test-session-id'
    
    const { result, unmount } = renderHook(() => useEventPolling(sessionId))
    
    // Should start with empty events
    expect(result.current.events).toEqual([])
    
    // Add an event to database
    const event = createMockEvent({
      session_id: 'claude-session-id',
      event_type: 'user',
      data: { type: 'user', content: 'Test message' },
      memva_session_id: sessionId
    })
    testDb.insertEvent(event)
    
    // Advance timers by 2 seconds to trigger polling
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    // Wait for the promise to resolve
    await act(async () => {
      await Promise.resolve()
    })
    
    // Should have found the new event
    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0]).toMatchObject({
      event_type: 'user',
      data: { type: 'user', content: 'Test message' }
    })
    
    // Clean up
    unmount()
  })

  it('should update events list when new events arrive', async () => {
    const { useEventPolling } = await import('../hooks/useEventPolling')
    
    const sessionId = 'test-session-id'
    
    // Start with one event
    const initialEvent = createMockEvent({
      session_id: 'claude-session-id',
      event_type: 'user',
      data: { type: 'user', content: 'Initial message' },
      memva_session_id: sessionId
    })
    testDb.insertEvent(initialEvent)
    
    const { result, unmount } = renderHook(() => useEventPolling(sessionId))
    
    // Wait for initial load
    await act(async () => {
      await Promise.resolve()
    })
    
    expect(result.current.events).toHaveLength(1)
    
    // Add another event
    const newEvent = createMockEvent({
      session_id: 'claude-session-id',
      event_type: 'assistant',
      data: { type: 'assistant', content: 'Assistant response' },
      memva_session_id: sessionId
    })
    testDb.insertEvent(newEvent)
    
    // Trigger polling
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    await act(async () => {
      await Promise.resolve()
    })
    
    // Should have both events
    expect(result.current.events).toHaveLength(2)
    expect(result.current.events.some(e => e.event_type === 'assistant')).toBe(true)
    
    unmount()
  })

  it('should handle polling errors gracefully', async () => {
    // Import the mocked service to override it for this test
    const eventService = await import('../db/event-session.service')
    const mockGetEventsForSession = eventService.getEventsForSession as any
    
    // Make this specific call throw an error
    mockGetEventsForSession.mockRejectedValueOnce(new Error('Database connection failed'))
    
    const { useEventPolling } = await import('../hooks/useEventPolling')
    
    const sessionId = 'test-session-id'
    
    const { result, unmount } = renderHook(() => useEventPolling(sessionId))
    
    // Wait for initial load
    await act(async () => {
      await Promise.resolve()
    })
    
    // Should have error set
    expect(result.current.error).toBe('Database connection failed')
    expect(result.current.events).toEqual([])
    
    unmount()
  })

  it('should stop polling when component unmounts', async () => {
    const { useEventPolling } = await import('../hooks/useEventPolling')
    
    const sessionId = 'test-session-id'
    
    const { unmount } = renderHook(() => useEventPolling(sessionId))
    
    // Wait for initial load
    await act(async () => {
      await Promise.resolve()
    })
    
    // Get the mock to track calls
    const eventService = await import('../db/event-session.service')
    const mockGetEventsForSession = eventService.getEventsForSession as any
    
    // Clear call history to track only future calls
    mockGetEventsForSession.mockClear()
    
    // Unmount the component
    unmount()
    
    // Advance timers - should not trigger more calls
    act(() => {
      vi.advanceTimersByTime(5000) // 5 seconds
    })
    
    await act(async () => {
      await Promise.resolve()
    })
    
    // Should not have been called after unmount
    expect(mockGetEventsForSession).not.toHaveBeenCalled()
  })

  it('should show events in real-time as they are stored', async () => {
    const { useEventPolling } = await import('../hooks/useEventPolling')
    
    const sessionId = 'test-session-id'
    
    const { result, unmount } = renderHook(() => useEventPolling(sessionId))
    
    await act(async () => {
      await Promise.resolve()
    })
    
    expect(result.current.events).toEqual([])
    
    // Simulate real-time event storage
    for (let i = 1; i <= 3; i++) {
      const event = createMockEvent({
        session_id: 'claude-session-id',
        event_type: i % 2 === 0 ? 'assistant' : 'user',
        data: { type: i % 2 === 0 ? 'assistant' : 'user', content: `Message ${i}` },
        memva_session_id: sessionId
      })
      testDb.insertEvent(event)
      
      // Trigger polling
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      
      await act(async () => {
        await Promise.resolve()
      })
      
      expect(result.current.events).toHaveLength(i)
    }
    
    unmount()
  })
})