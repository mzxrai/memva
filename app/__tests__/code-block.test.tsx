import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CodeBlock } from '../components/events/CodeBlock'

// Mock the clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
})

describe('CodeBlock component', () => {
  it('should render code content with proper formatting', () => {
    const code = `function hello() {
  console.log("Hello, world!");
}`
    
    render(<CodeBlock code={code} language="javascript" />)
    
    // Check if code is rendered
    expect(screen.getByText(/function hello/)).toBeInTheDocument()
    expect(screen.getByText(/console\.log/)).toBeInTheDocument()
    
    // Check if code content uses monospace font
    const codeTextElement = screen.getByText(/function hello/)
    expect(codeTextElement).toHaveClass('font-mono')
  })
  
  it('should display language indicator when provided', () => {
    render(<CodeBlock code="const x = 1" language="typescript" />)
    
    expect(screen.getByText('typescript')).toBeInTheDocument()
  })
  
  it('should not display language indicator when not provided', () => {
    render(<CodeBlock code="const x = 1" />)
    
    expect(screen.queryByText('typescript')).not.toBeInTheDocument()
  })
  
  it('should show copy button on hover', () => {
    const { container } = render(<CodeBlock code="const x = 1" />)
    
    // Initially, copy button should not be visible
    expect(screen.queryByLabelText('Copy code')).not.toBeInTheDocument()
    
    // Hover over the code block
    const codeBlock = container.firstChild as HTMLElement
    fireEvent.mouseEnter(codeBlock)
    
    // Copy button should now be visible
    expect(screen.getByLabelText('Copy code')).toBeInTheDocument()
  })
  
  it('should copy code to clipboard when copy button is clicked', async () => {
    const code = 'const x = 1'
    const { container } = render(<CodeBlock code={code} />)
    
    // Hover to show copy button
    const codeBlock = container.firstChild as HTMLElement
    fireEvent.mouseEnter(codeBlock)
    
    // Click copy button
    const copyButton = screen.getByLabelText('Copy code')
    await fireEvent.click(copyButton)
    
    // Verify clipboard write was called with the code
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(code)
  })
  
  it('should show feedback after copying', async () => {
    const { container } = render(<CodeBlock code="const x = 1" />)
    
    // Hover and click copy
    const codeBlock = container.firstChild as HTMLElement
    fireEvent.mouseEnter(codeBlock)
    
    const copyButton = screen.getByLabelText('Copy code')
    fireEvent.click(copyButton)
    
    // Wait for the state to update
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Should show check icon which has emerald color
    const button = screen.getByLabelText('Copy code')
    const checkIcon = button.querySelector('svg')
    expect(checkIcon).toHaveClass('text-emerald-500')
  })
  
  it('should handle long code with scroll', () => {
    const longCode = Array(100).fill('console.log("Line");').join('\n')
    
    render(<CodeBlock code={longCode} />)
    
    const preElement = screen.getByRole('region', { name: /code block/i }).querySelector('pre')
    expect(preElement).toHaveClass('overflow-x-auto')
  })
  
  it('should apply custom className if provided', () => {
    const { container } = render(
      <CodeBlock code="const x = 1" className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
  
  it('should handle empty code gracefully', () => {
    render(<CodeBlock code="" />)
    
    // Should still render the container
    const preElement = screen.getByRole('region', { name: /code block/i })
    expect(preElement).toBeInTheDocument()
  })
})

describe('CodeBlock diff mode', () => {
  const diffCode = `- function oldFunction() {
-   console.log("old");
+ function newFunction() {
+   console.log("new");
+   console.log("added line");
  }`
  
  it('should render diff with proper line indicators', () => {
    render(<CodeBlock code={diffCode} language="diff" />)
    
    // Check for diff indicators - get all and check they exist
    const minusIndicators = screen.getAllByText('-').filter(el => 
      el.classList.contains('line-indicator')
    )
    const plusIndicators = screen.getAllByText('+').filter(el => 
      el.classList.contains('line-indicator')
    )
    
    expect(minusIndicators.length).toBeGreaterThan(0)
    expect(plusIndicators.length).toBeGreaterThan(0)
  })
  
  it('should apply proper styling to added and removed lines', () => {
    render(<CodeBlock code={diffCode} language="diff" />)
    
    // Check for proper background classes on diff lines
    const removedLine = screen.getByText(/console.log\("old"\)/).closest('.code-line')
    const addedLine = screen.getByText(/console.log\("new"\)/).closest('.code-line')
    
    expect(removedLine).toHaveClass('bg-red-950/20')
    expect(addedLine).toHaveClass('bg-emerald-950/20')
  })
  
  it('should display line numbers in diff mode', () => {
    render(<CodeBlock code={diffCode} language="diff" showLineNumbers />)
    
    // Should show line numbers
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})