import { render, screen } from '@testing-library/react'
import { MessageHeader } from '../components/events/MessageHeader'
import { RiUser3Line, RiSparklingLine } from 'react-icons/ri'
import { describe, it, expect } from 'vitest'

describe('MessageHeader', () => {
  it('should render title text and icon visually', () => {
    const { container } = render(
      <MessageHeader
        icon={RiUser3Line}
        title="Test User"
      />
    )
    
    // Test visible content - title should be accessible
    expect(screen.getByText('Test User')).toBeInTheDocument()
    
    // Test icon is rendered - check for SVG element presence (focusing on behavior)
    const svgElement = container.querySelector('svg')
    expect(svgElement).toBeInTheDocument()
  })

  it('should render header as a proper banner/header element', () => {
    const { container } = render(
      <MessageHeader
        icon={RiUser3Line}
        title="Message from User"
      />
    )
    
    // Test that the header is structured as a proper container
    const header = container.firstChild as HTMLElement
    expect(header).toBeInTheDocument()
    expect(header.tagName).toBe('DIV')
    
    // Test that content is properly accessible
    expect(screen.getByText('Message from User')).toBeVisible()
  })

  it('should render optional children content', () => {
    render(
      <MessageHeader
        icon={RiSparklingLine}
        title="Claude"
      >
        <span>Badge Content</span>
      </MessageHeader>
    )
    
    // Test all content is rendered and accessible
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('Badge Content')).toBeInTheDocument()
  })

  it('should display different icons and titles correctly', () => {
    const { container } = render(
      <MessageHeader
        icon={RiSparklingLine}
        title="Assistant Response"
      />
    )
    
    // Test that different content is rendered properly
    expect(screen.getByText('Assistant Response')).toBeInTheDocument()
    
    // Test icon is present (different icon than previous tests)
    const svgElement = container.querySelector('svg')
    expect(svgElement).toBeInTheDocument()
  })

  it('should support custom styling through className prop', () => {
    const { container } = render(
      <MessageHeader
        icon={RiUser3Line}
        title="Custom Styled Header"
        className="custom-test-class"
      />
    )
    
    // Test that custom class is applied (behavior-focused, not implementation)
    const header = container.firstChild as HTMLElement
    expect(header).toHaveClass('custom-test-class')
    
    // Test that content is still accessible with custom styling
    expect(screen.getByText('Custom Styled Header')).toBeInTheDocument()
  })

  it('should maintain accessible content structure', () => {
    const { container } = render(
      <MessageHeader
        icon={RiUser3Line}
        title="User Message"
      >
        <span>Message Badge</span>
      </MessageHeader>
    )
    
    // Test that all content is properly structured for accessibility
    expect(screen.getByText('User Message')).toBeInTheDocument()
    expect(screen.getByText('Message Badge')).toBeInTheDocument()
    
    // Test that icon is present and accessible
    const svgElement = container.querySelector('svg')
    expect(svgElement).toBeInTheDocument()
  })
})