import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGreenLineIndicator } from '../hooks/useGreenLineIndicator'

describe('useGreenLineIndicator hook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('should initially return isGreen as false', () => {
    const { result } = renderHook(() => useGreenLineIndicator('session-1', 'msg-1'))
    expect(result.current.isGreen).toBe(false)
  })

  it('should mark a message as green', () => {
    const { result } = renderHook(() => useGreenLineIndicator('session-1', 'msg-1'))
    
    act(() => {
      result.current.markAsGreen('msg-1')
    })

    expect(result.current.isGreen).toBe(true)
    
    // Check localStorage
    const stored = JSON.parse(localStorage.getItem('memva_green_messages') || '{}')
    expect(stored['msg-1']).toBeDefined()
    expect(stored['msg-1'].sessionId).toBe('session-1')
  })

  it('should clear green messages for a session', () => {
    const { result } = renderHook(() => useGreenLineIndicator('session-1', 'msg-1'))
    
    // Mark as green first
    act(() => {
      result.current.markAsGreen('msg-1')
    })
    
    expect(result.current.isGreen).toBe(true)
    
    // Clear green for session
    act(() => {
      result.current.clearGreenForSession('session-1')
    })
    
    expect(result.current.isGreen).toBe(false)
    
    // Check localStorage
    const stored = JSON.parse(localStorage.getItem('memva_green_messages') || '{}')
    expect(stored['msg-1']).toBeUndefined()
  })

  it('should clean up expired messages from localStorage', () => {
    const { result } = renderHook(() => useGreenLineIndicator('session-1', 'msg-1'))
    
    // Mark as green
    act(() => {
      result.current.markAsGreen('msg-1')
    })
    
    expect(result.current.isGreen).toBe(true)
    
    // Check it's in localStorage
    let stored = JSON.parse(localStorage.getItem('memva_green_messages') || '{}')
    expect(stored['msg-1']).toBeDefined()
    
    // Advance time by 31 minutes and trigger cleanup
    act(() => {
      vi.advanceTimersByTime(31 * 60 * 1000)
    })
    
    // Manually trigger a new message to force cleanup
    act(() => {
      result.current.markAsGreen('msg-2')
    })
    
    // Old message should be cleaned up from localStorage
    stored = JSON.parse(localStorage.getItem('memva_green_messages') || '{}')
    expect(stored['msg-1']).toBeUndefined()
    expect(stored['msg-2']).toBeDefined()
  })

  it('should handle multiple messages independently', () => {
    const { result: hook1 } = renderHook(() => useGreenLineIndicator('session-1', 'msg-1'))
    const { result: hook2 } = renderHook(() => useGreenLineIndicator('session-2', 'msg-2'))
    
    // Mark first message as green
    act(() => {
      hook1.current.markAsGreen('msg-1')
    })
    
    expect(hook1.current.isGreen).toBe(true)
    expect(hook2.current.isGreen).toBe(false)
    
    // Mark second message as green
    act(() => {
      hook2.current.markAsGreen('msg-2')
    })
    
    expect(hook1.current.isGreen).toBe(true)
    expect(hook2.current.isGreen).toBe(true)
    
    // Clear first session
    act(() => {
      hook1.current.clearGreenForSession('session-1')
    })
    
    expect(hook1.current.isGreen).toBe(false)
    expect(hook2.current.isGreen).toBe(true)
  })

  it('should clean up expired entries when marking new messages', () => {
    const { result } = renderHook(() => useGreenLineIndicator('session-1', 'msg-new'))
    
    // Set up an old message in localStorage
    const oldMessage = {
      'msg-old': {
        expiresAt: Date.now() - 60 * 60 * 1000, // 1 hour ago
        sessionId: 'session-old'
      }
    }
    localStorage.setItem('memva_green_messages', JSON.stringify(oldMessage))
    
    // Mark a new message as green
    act(() => {
      result.current.markAsGreen('msg-new')
    })
    
    // Check that old message was cleaned up
    const stored = JSON.parse(localStorage.getItem('memva_green_messages') || '{}')
    expect(stored['msg-old']).toBeUndefined()
    expect(stored['msg-new']).toBeDefined()
  })
})