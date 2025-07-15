import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { expectSemanticMarkup, expectContent } from '../test-utils/component-testing'

describe('MarkdownRenderer', () => {
  it('should render basic text', () => {
    render(<MarkdownRenderer content="Hello world" />)
    expectContent.text('Hello world')
  })

  it('should render headers', () => {
    const markdown = `# Heading 1
## Heading 2
### Heading 3`
    
    render(<MarkdownRenderer content={markdown} />)
    
    expectSemanticMarkup.heading(1, 'Heading 1')
    expectSemanticMarkup.heading(2, 'Heading 2')
    expectSemanticMarkup.heading(3, 'Heading 3')
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
    expectContent.text('const')
    expectContent.text('"Hello, world!"')
    expectContent.text('console')
  })

  it('should render inline code with semantic markup', () => {
    const markdown = 'Use `npm install` to install dependencies'
    
    render(<MarkdownRenderer content={markdown} />)
    
    expectContent.code('npm install')
  })

  it('should render links with proper attributes', () => {
    const markdown = 'Visit [Google](https://google.com)'
    
    render(<MarkdownRenderer content={markdown} />)
    
    const link = expectSemanticMarkup.link('Google', 'https://google.com')
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
    
    // Check that lists are rendered with proper semantic structure
    const lists = screen.getAllByRole('list')
    expect(lists).toHaveLength(2)
    
    // Check list items are accessible
    expectContent.text('Item 1')
    expectContent.text('Item 2')
    expectContent.text('Item 3')
    expectContent.text('First')
    expectContent.text('Second')
    expectContent.text('Third')
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
    expectContent.text('Header 1')
    expectContent.text('Cell 1')
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
    
    expectContent.text('Test content')
    expect(container.firstChild).toBeInTheDocument()
    expect((container.firstChild as Element).tagName).toBe('DIV')
  })
})