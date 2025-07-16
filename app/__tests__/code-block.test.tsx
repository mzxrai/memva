import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CodeBlock } from '../components/events/CodeBlock'
import { expectContent } from '../test-utils/component-testing'

// Mock the clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
})

describe('CodeBlock component', () => {
  it('should render code content accessibly', () => {
    const code = `function hello() {
  console.log("Hello, world!");
}`
    
    render(<CodeBlock code={code} language="javascript" />)
    
    // Test code content is accessible within proper semantic region
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    expect(codeRegion).toBeInTheDocument()
    
    // Test code content is visible
    expectContent.text('function hello() {')
    expectContent.text('console.log("Hello, world!");')
  })
  
  it('should display language indicator when provided', () => {
    render(<CodeBlock code="const x = 1" language="typescript" />)
    
    // Test language indicator is visible to users
    expectContent.text('typescript')
  })
  
  it('should not display language indicator when not provided', () => {
    render(<CodeBlock code="const x = 1" />)
    
    // Test no language indicator is present
    expect(screen.queryByText('typescript')).not.toBeInTheDocument()
    expect(screen.queryByText('javascript')).not.toBeInTheDocument()
  })
  
  it('should show copy button on hover', () => {
    render(<CodeBlock code="const x = 1" />)
    
    // Initially, copy button should not be visible
    expect(screen.queryByLabelText('Copy code')).not.toBeInTheDocument()
    
    // Hover over the code block region
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    act(() => {
      fireEvent.mouseEnter(codeRegion)
    })
    
    // Copy button should now be visible and accessible
    const copyButton = screen.getByLabelText('Copy code')
    expect(copyButton).toBeInTheDocument()
    expect(copyButton.tagName).toBe('BUTTON')
  })
  
  it('should copy code to clipboard when copy button is clicked', async () => {
    const code = 'const x = 1'
    render(<CodeBlock code={code} />)
    
    // Hover to show copy button
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    act(() => {
      fireEvent.mouseEnter(codeRegion)
    })
    
    // Click copy button
    const copyButton = screen.getByLabelText('Copy code')
    await act(async () => {
      await fireEvent.click(copyButton)
    })
    
    // Verify clipboard write was called with the code
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(code)
  })
  
  it('should show feedback after copying', async () => {
    render(<CodeBlock code="const x = 1" />)
    
    // Hover and click copy
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    act(() => {
      fireEvent.mouseEnter(codeRegion)
    })
    
    const copyButton = screen.getByLabelText('Copy code')
    await act(async () => {
      await fireEvent.click(copyButton)
    })
    
    // Wait for the feedback message to appear
    await waitFor(() => {
      expectContent.text('Copied!')
    }, { timeout: 2000 })
  })
  
  it('should handle long code content properly', () => {
    const longCode = Array(100).fill('console.log("Line");').join('\n')
    
    render(<CodeBlock code={longCode} />)
    
    // Test that the code region is rendered and accessible
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    expect(codeRegion).toBeInTheDocument()
    
    // Test that the content is actually present (use getAllByText since there are multiple instances)
    const codeElements = screen.getAllByText('console.log("Line");')
    expect(codeElements.length).toBeGreaterThan(0)
  })
  
  it('should render with custom properties when provided', () => {
    render(
      <CodeBlock code="const x = 1" className="custom-class" />
    )
    
    // Test behavior remains the same regardless of custom styling
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    expect(codeRegion).toBeInTheDocument()
    expectContent.text('const x = 1')
  })
  
  it('should handle empty code gracefully', () => {
    render(<CodeBlock code="" />)
    
    // Should still render the accessible container
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    expect(codeRegion).toBeInTheDocument()
  })
})

describe('CodeBlock non-diff mode', () => {
  it('should not treat bash output with dashes as diff', () => {
    const bashOutput = `total 19336
drwxr-xr-x@ 36 mbm-premva staff 1152 Jul 16 11:41 .
drwxr-xr-x  29 mbm-premva staff  928 Jul 15 19:49 ..
-rw-r--r--@  1 mbm-premva staff   42 Jul 12 19:25 .dockerignore
-rw-r--r--@  1 mbm-premva staff  189 Jul 13 16:12 .envrc`
    
    render(<CodeBlock code={bashOutput} language="text" />)
    
    // Should render the content without diff styling
    expectContent.text('total 19336')
    expect(screen.getByText(/^-rw-r--r--@.*\.dockerignore$/)).toBeInTheDocument()
    
    // Should not have diff indicators (+ or - symbols) rendered separately
    // The dashes should be part of the actual content, not diff indicators
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    expect(codeRegion).toBeInTheDocument()
    
    // Check that the content is treated as plain text - no red coloring for "removed" lines
    const codeLine = screen.getByText(/^-rw-r--r--@.*\.dockerignore$/)
    expect(codeLine.closest('.code-line')).toHaveClass('border-transparent')
    expect(codeLine.closest('.code-line')).not.toHaveClass('bg-red-950/20')
  })
})

describe('CodeBlock diff mode', () => {
  const diffCode = `- function oldFunction() {
-   console.log("old");
+ function newFunction() {
+   console.log("new");
+   console.log("added line");
  }`
  
  it('should render diff with proper content structure', () => {
    render(<CodeBlock code={diffCode} language="diff" />)
    
    // Test that removed content is visible
    expectContent.text('function oldFunction() {')
    expectContent.text('console.log("old");')
    
    // Test that added content is visible
    expectContent.text('function newFunction() {')
    expectContent.text('console.log("new");')
    expectContent.text('console.log("added line");')
  })
  
  it('should render diff indicators for different line types', () => {
    render(<CodeBlock code={diffCode} language="diff" />)
    
    // Test the diff indicators are present and accessible
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    expect(codeRegion).toBeInTheDocument()
    
    // Test both addition and removal indicators exist
    const minusIndicators = screen.getAllByText('-')
    const plusIndicators = screen.getAllByText('+')
    
    expect(minusIndicators.length).toBeGreaterThan(0)
    expect(plusIndicators.length).toBeGreaterThan(0)
  })
  
  it('should display line numbers in diff mode', () => {
    render(<CodeBlock code={diffCode} language="diff" showLineNumbers />)
    
    // Test line numbers are visible to users
    expectContent.text('1')
    expectContent.text('2')
    
    // Test that the code region remains accessible
    const codeRegion = screen.getByRole('region', { name: /code block/i })
    expect(codeRegion).toBeInTheDocument()
  })
})