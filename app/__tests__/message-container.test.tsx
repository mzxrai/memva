import { render, screen } from '@testing-library/react'
import { MessageContainer } from '../components/events/MessageContainer'
import { describe, it, expect } from 'vitest'

describe('MessageContainer', () => {
  it('renders children content', () => {
    render(
      <MessageContainer>
        <div>Test content</div>
      </MessageContainer>
    )
    
    expect(screen.getByText('Test content')).toBeTruthy()
  })

  it('applies consistent base styling', () => {
    const { container } = render(
      <MessageContainer>
        <div>Content</div>
      </MessageContainer>
    )
    
    const messageBox = container.firstChild as HTMLElement
    expect(messageBox.className).toContain('p-4')
  })

  it('accepts and applies additional className', () => {
    const { container } = render(
      <MessageContainer className="custom-class">
        <div>Content</div>
      </MessageContainer>
    )
    
    const messageBox = container.firstChild as HTMLElement
    expect(messageBox.className).toContain('custom-class')
  })

  it('maintains base styling when custom className is provided', () => {
    const { container } = render(
      <MessageContainer className="mt-8">
        <div>Content</div>
      </MessageContainer>
    )
    
    const messageBox = container.firstChild as HTMLElement
    expect(messageBox.className).toContain('p-4')
    expect(messageBox.className).toContain('mt-8')
  })
})