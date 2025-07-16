import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { expectContent, expectSemanticMarkup } from '../test-utils/component-testing'
import { createMockSession } from '../test-utils/factories'
import StatusIndicator from '../components/StatusIndicator'

describe('StatusIndicator Component', () => {
  it('should display grey dot for not_started sessions', () => {
    const session = createMockSession({ claude_status: 'not_started' })
    render(<StatusIndicator session={session} />)
    
    // Should have a status indicator with accessible label
    const statusElement = expectSemanticMarkup.status('Session status')
    expect(statusElement).toHaveTextContent('')
    
    // Should have a grey dot visually
    const dot = statusElement.querySelector('[data-testid="status-dot"]')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('data-status', 'not_started')
  })

  it('should display green pulsing dot for processing sessions', () => {
    const session = createMockSession({ claude_status: 'processing' })
    render(<StatusIndicator session={session} />)
    
    // Should have a status indicator with accessible label
    const statusElement = expectSemanticMarkup.status('Session status')
    expect(statusElement).toHaveTextContent('Processing')
    
    // Should have a green pulsing dot
    const dot = statusElement.querySelector('[data-testid="status-dot"]')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('data-status', 'processing')
    expect(dot).toHaveAttribute('data-pulse', 'true')
  })

  it('should display green dot with "Needs Input" badge for waiting_for_input sessions', () => {
    const session = createMockSession({ claude_status: 'waiting_for_input' })
    render(<StatusIndicator session={session} />)
    
    // Should have a status indicator with accessible label
    const statusElement = expectSemanticMarkup.status('Session status')
    expect(statusElement).toHaveTextContent('Needs Input')
    
    // Should have a green dot
    const dot = statusElement.querySelector('[data-testid="status-dot"]')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('data-status', 'waiting_for_input')
    
    // Should have a "Needs Input" badge
    expectContent.text('Needs Input')
  })

  it('should display green dot with "Needs Input" badge for completed sessions', () => {
    const session = createMockSession({ claude_status: 'completed' })
    render(<StatusIndicator session={session} />)
    
    // Should have a status indicator with accessible label
    const statusElement = expectSemanticMarkup.status('Session status')
    expect(statusElement).toHaveTextContent('Needs Input')
    
    // Should have a green dot
    const dot = statusElement.querySelector('[data-testid="status-dot"]')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('data-status', 'completed')
    
    // Should have a "Needs Input" badge
    expectContent.text('Needs Input')
  })

  it('should display red dot for error sessions', () => {
    const session = createMockSession({ claude_status: 'error' })
    render(<StatusIndicator session={session} />)
    
    // Should have a status indicator with accessible label
    const statusElement = expectSemanticMarkup.status('Session status')
    expect(statusElement).toHaveTextContent('Error')
    
    // Should have a red dot
    const dot = statusElement.querySelector('[data-testid="status-dot"]')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('data-status', 'error')
  })

  it('should handle unknown status gracefully', () => {
    const session = createMockSession({ claude_status: 'unknown_status' as any })
    render(<StatusIndicator session={session} />)
    
    // Should default to not_started behavior
    const statusElement = expectSemanticMarkup.status('Session status')
    expect(statusElement).toHaveTextContent('Unknown')
    
    // Should have a grey dot as fallback
    const dot = statusElement.querySelector('[data-testid="status-dot"]')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('data-status', 'unknown')
  })

  it('should be accessible with proper ARIA attributes', () => {
    const session = createMockSession({ claude_status: 'processing' })
    render(<StatusIndicator session={session} />)
    
    // Status should have proper role and label
    const statusElement = expectSemanticMarkup.status('Session status')
    expect(statusElement).toHaveAttribute('role', 'status')
    expect(statusElement).toHaveAttribute('aria-label', 'Session status')
    
    // Should be live region for screen readers
    expect(statusElement).toHaveAttribute('aria-live', 'polite')
  })
})