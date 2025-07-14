import { render, screen } from '@testing-library/react'
import { MessageHeader } from '../components/events/MessageHeader'
import { RiUser3Line, RiSparklingLine } from 'react-icons/ri'
import { describe, it, expect } from 'vitest'

describe('MessageHeader', () => {
  it('renders icon and title', () => {
    render(
      <MessageHeader
        icon={RiUser3Line}
        title="Test User"
      />
    )
    
    expect(screen.getByText('Test User')).toBeTruthy()
    // Icon is rendered but doesn't have text content, so we check for the element
    const icon = document.querySelector('svg')
    expect(icon).toBeTruthy()
  })

  it('applies consistent header styling', () => {
    const { container } = render(
      <MessageHeader
        icon={RiUser3Line}
        title="Test"
      />
    )
    
    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('flex')
    expect(header.className).toContain('items-center')
    expect(header.className).toContain('gap-2')
    expect(header.className).toContain('mb-3')
  })

  it('renders optional children', () => {
    render(
      <MessageHeader
        icon={RiSparklingLine}
        title="Claude"
      >
        <span data-testid="badge">Badge</span>
      </MessageHeader>
    )
    
    expect(screen.getByText('Claude')).toBeTruthy()
    expect(screen.getByTestId('badge')).toBeTruthy()
  })

  it('applies correct icon styling', () => {
    render(
      <MessageHeader
        icon={RiUser3Line}
        title="User"
      />
    )
    
    const icon = document.querySelector('svg')
    expect(icon?.className).toContain('w-4')
    expect(icon?.className).toContain('h-4')
    expect(icon?.className).toContain('text-zinc-500')
  })

  it('applies correct title styling', () => {
    render(
      <MessageHeader
        icon={RiUser3Line}
        title="Test Title"
      />
    )
    
    const title = screen.getByText('Test Title')
    expect(title.className).toContain('text-sm')
    expect(title.className).toContain('font-medium')
    expect(title.className).toContain('text-zinc-500')
  })

  it('accepts custom className', () => {
    const { container } = render(
      <MessageHeader
        icon={RiUser3Line}
        title="Test"
        className="custom-class"
      />
    )
    
    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('custom-class')
  })
})