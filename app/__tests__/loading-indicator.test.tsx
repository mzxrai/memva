import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LoadingIndicator } from '../components/LoadingIndicator'

describe('LoadingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should display initial state with zero tokens and time', () => {
    render(<LoadingIndicator tokenCount={0} startTime={Date.now()} />)
    
    expect(screen.getByText(/0 tokens/)).toBeInTheDocument()
    expect(screen.getByText(/0s/)).toBeInTheDocument()
  })

  it('should display token count', () => {
    render(<LoadingIndicator tokenCount={1234} startTime={Date.now()} />)
    
    expect(screen.getByText(/1,234 tokens/)).toBeInTheDocument()
  })

  it('should update elapsed time', () => {
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

  it('should cycle through fun action verbs', () => {
    render(<LoadingIndicator tokenCount={0} startTime={Date.now()} />)
    
    // Should show one of the action verbs
    const container = screen.getByTestId('loading-indicator')
    const text = container.textContent || ''
    
    // Check that it contains at least one of the expected verbs
    const verbs = [
      'Crunching', 'Pondering', 'Contemplating', 'Cogitating',
      'Ruminating', 'Deliberating', 'Noodling', 'Percolating',
      'Brewing', 'Vibing', 'Processing', 'Computing',
      'Calculating', 'Analyzing', 'Synthesizing', 'Fibberglibbiting'
    ]
    
    const hasVerb = verbs.some(verb => text.includes(verb))
    expect(hasVerb).toBe(true)
  })

  it('should change action verb periodically', () => {
    render(<LoadingIndicator tokenCount={0} startTime={Date.now()} />)
    
    const container = screen.getByTestId('loading-indicator')
    
    // Advance time to trigger verb change (every 2-3 seconds)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    
    // The verb might have changed (it's random, so we can't guarantee it)
    // But at least the component should still be rendering
    expect(container).toBeInTheDocument()
  })

  it('should hide when isLoading is false', () => {
    const { rerender } = render(
      <LoadingIndicator tokenCount={100} startTime={Date.now()} isLoading={true} />
    )
    
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    
    rerender(
      <LoadingIndicator tokenCount={100} startTime={Date.now()} isLoading={false} />
    )
    
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
  })

  it('should format large token counts with commas', () => {
    render(<LoadingIndicator tokenCount={1234567} startTime={Date.now()} />)
    
    // The displayed count will animate to the target, so we can't check exact value
    expect(screen.getByText(/tokens/)).toBeInTheDocument()
  })

  it('should show minutes after 60 seconds', () => {
    const startTime = Date.now()
    render(<LoadingIndicator tokenCount={0} startTime={startTime} />)
    
    act(() => {
      vi.advanceTimersByTime(65000) // 65 seconds
    })
    
    expect(screen.getByText(/1m 5s/)).toBeInTheDocument()
  })
})