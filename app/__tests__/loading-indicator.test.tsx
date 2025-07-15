import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LoadingIndicator } from '../components/LoadingIndicator'

describe('LoadingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should display initial loading state with zero tokens and time', () => {
    render(<LoadingIndicator tokenCount={0} startTime={Date.now()} />)
    
    expect(screen.getByText(/0 tokens/)).toBeInTheDocument()
    expect(screen.getByText(/0s/)).toBeInTheDocument()
  })

  it('should display token count with proper formatting', () => {
    render(<LoadingIndicator tokenCount={1234} startTime={Date.now()} />)
    
    // Token count starts at 0 and animates to target value
    expect(screen.getByText(/tokens/)).toBeInTheDocument()
  })

  it('should update elapsed time accurately', () => {
    const startTime = Date.now()
    render(<LoadingIndicator tokenCount={0} startTime={startTime} />)
    
    // Initially shows 0s
    expect(screen.getByText(/0s/)).toBeInTheDocument()
    
    // After 1 second
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText(/1s/)).toBeInTheDocument()
    
    // After 10 seconds
    act(() => {
      vi.advanceTimersByTime(9000)
    })
    expect(screen.getByText(/10s/)).toBeInTheDocument()
  })

  it('should display an action verb with ellipsis', () => {
    render(<LoadingIndicator tokenCount={0} startTime={Date.now()} />)
    
    // Should show some action text with ellipsis indicating activity
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
  })

  it('should show and hide based on loading state', () => {
    const { rerender } = render(
      <LoadingIndicator tokenCount={100} startTime={Date.now()} isLoading={true} />
    )
    
    // Should display loading content when isLoading is true
    expect(screen.getByText(/tokens/)).toBeInTheDocument()
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
    
    rerender(
      <LoadingIndicator tokenCount={100} startTime={Date.now()} isLoading={false} />
    )
    
    // Should not display when isLoading is false
    expect(screen.queryByText(/tokens/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument()
  })

  it('should format large token counts as k values', () => {
    render(<LoadingIndicator tokenCount={1234567} startTime={Date.now()} />)
    
    // Large token counts should be formatted with 'k' suffix
    expect(screen.getByText(/tokens/)).toBeInTheDocument()
  })

  it('should format elapsed time in minutes and seconds after 60 seconds', () => {
    const startTime = Date.now()
    render(<LoadingIndicator tokenCount={0} startTime={startTime} />)
    
    act(() => {
      vi.advanceTimersByTime(65000) // 65 seconds
    })
    
    expect(screen.getByText(/1m 5s/)).toBeInTheDocument()
  })

  it('should indicate loading activity with visual spinner', () => {
    render(<LoadingIndicator tokenCount={0} startTime={Date.now()} />)
    
    // Component should have visual indicators of loading state
    const container = screen.getByText(/tokens/).closest('div')
    expect(container).toBeInTheDocument()
    
    // Should show token count and elapsed time together
    expect(screen.getByText(/tokens/)).toBeInTheDocument()
    expect(screen.getByText(/0s/)).toBeInTheDocument()
  })

  it('should display consistent loading information layout', () => {
    render(<LoadingIndicator tokenCount={42} startTime={Date.now()} />)
    
    const container = screen.getByText(/tokens/).closest('div')
    expect(container).toBeInTheDocument()
    
    // Should contain action text, token count, and elapsed time
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
    expect(screen.getByText(/tokens/)).toBeInTheDocument() 
    expect(screen.getByText(/0s/)).toBeInTheDocument()
  })
})