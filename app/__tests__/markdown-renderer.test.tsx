import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MarkdownRenderer } from '../components/MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('should render basic text', () => {
    render(<MarkdownRenderer content="Hello world" />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('should render headers', () => {
    const markdown = `# Heading 1
## Heading 2
### Heading 3`
    
    render(<MarkdownRenderer content={markdown} />)
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading 1')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading 2')
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Heading 3')
  })

  it('should render bold and italic text with semantic markup', () => {
    const markdown = `This is **bold** and this is *italic*`
    
    render(<MarkdownRenderer content={markdown} />)
    
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('italic').tagName).toBe('EM')
  })

  it('should render code blocks with syntax highlighting', () => {
    const markdown = `\`\`\`javascript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\``
    
    render(<MarkdownRenderer content={markdown} />)
    
    // Check that the code is rendered
    expect(screen.getByText(/const/)).toBeInTheDocument()
    expect(screen.getByText('"Hello, world!"')).toBeInTheDocument()
    expect(screen.getByText('console')).toBeInTheDocument()
  })

  it('should render inline code with semantic markup', () => {
    const markdown = 'Use `npm install` to install dependencies'
    
    render(<MarkdownRenderer content={markdown} />)
    
    const codeElement = screen.getByText('npm install')
    expect(codeElement.tagName).toBe('CODE')
    expect(codeElement).toBeInTheDocument()
  })

  it('should render links with proper attributes', () => {
    const markdown = 'Visit [Google](https://google.com)'
    
    render(<MarkdownRenderer content={markdown} />)
    
    const link = screen.getByRole('link', { name: 'Google' })
    expect(link).toHaveAttribute('href', 'https://google.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('should render lists', () => {
    const markdown = `
- Item 1
- Item 2
- Item 3

1. First
2. Second
3. Third`
    
    render(<MarkdownRenderer content={markdown} />)
    
    // Unordered list
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
    expect(screen.getByText('Item 3')).toBeInTheDocument()
    
    // Ordered list
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
  })

  it('should render blockquotes with semantic markup', () => {
    const markdown = '> This is a quote'
    
    render(<MarkdownRenderer content={markdown} />)
    
    const blockquote = screen.getByText('This is a quote').parentElement
    expect(blockquote?.tagName).toBe('BLOCKQUOTE')
    expect(blockquote).toBeInTheDocument()
  })

  it('should render tables from GFM', () => {
    const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`
    
    render(<MarkdownRenderer content={markdown} />)
    
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Header 1')).toBeInTheDocument()
    expect(screen.getByText('Cell 1')).toBeInTheDocument()
  })

  it('should render task lists from GFM', () => {
    const markdown = `
- [x] Completed task
- [ ] Incomplete task`
    
    render(<MarkdownRenderer content={markdown} />)
    
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
  })

  it('should render content with custom className applied', () => {
    const { container } = render(
      <MarkdownRenderer content="Test content" className="custom-class" />
    )
    
    expect(screen.getByText('Test content')).toBeInTheDocument()
    expect(container.firstChild).toBeInTheDocument()
    expect((container.firstChild as Element).tagName).toBe('DIV')
  })
})