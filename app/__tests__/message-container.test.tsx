import { render, screen } from '@testing-library/react'
import { MessageContainer } from '../components/events/MessageContainer'
import { describe, it, expect } from 'vitest'
import { expectContent } from '../test-utils/component-testing'

describe('MessageContainer', () => {
  it('renders children content correctly', () => {
    render(
      <MessageContainer>
        <div>Test content</div>
      </MessageContainer>
    )
    
    expectContent.text('Test content')
  })

  it('renders complex nested content', () => {
    render(
      <MessageContainer>
        <div>
          <p>Paragraph content</p>
          <span>Span content</span>
        </div>
      </MessageContainer>
    )
    
    expectContent.text('Paragraph content')
    expectContent.text('Span content')
  })

  it('renders multiple children elements', () => {
    render(
      <MessageContainer>
        <div>First child</div>
        <div>Second child</div>
      </MessageContainer>
    )
    
    expectContent.text('First child')
    expectContent.text('Second child')
  })

  it('renders semantic HTML structure as a container', () => {
    render(
      <MessageContainer>
        <div>Container content</div>
      </MessageContainer>
    )
    
    const containerElement = screen.getByText('Container content').parentElement
    expect(containerElement?.tagName).toBe('DIV')
    expect(containerElement).toBeInTheDocument()
  })

  it('preserves accessibility of child elements', () => {
    render(
      <MessageContainer>
        <button>Click me</button>
        <input aria-label="Test input" />
      </MessageContainer>
    )
    
    const button = screen.getByRole('button', { name: 'Click me' })
    const input = screen.getByRole('textbox', { name: 'Test input' })
    
    expect(button).toBeInTheDocument()
    expect(input).toBeInTheDocument()
  })

  it('handles empty content gracefully', () => {
    render(
      <MessageContainer>
        <div></div>
      </MessageContainer>
    )
    
    const containerElements = screen.getAllByRole('generic')
    expect(containerElements.length).toBeGreaterThan(0)
    expect(containerElements[0]).toBeInTheDocument()
  })

  it('works with custom className while maintaining functionality', () => {
    render(
      <MessageContainer className="custom-styling">
        <div>Styled content</div>
      </MessageContainer>
    )
    
    expectContent.text('Styled content')
    const containerElement = screen.getByText('Styled content').parentElement
    expect(containerElement).toBeInTheDocument()
  })
})