import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WriteToolDisplay } from '../components/events/tools/WriteToolDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectSemanticMarkup, expectContent } from '../test-utils/component-testing'
import type { ToolUseContent } from '../types/events'

describe('WriteToolDisplay Component', () => {
  const createWriteToolCall = (filePath: string, content: string): ToolUseContent => {
    return MOCK_TOOLS.write(filePath, content)
  }

  describe('when Write tool has result', () => {
    it('should display file name and metadata', () => {
      const toolCall = createWriteToolCall('/test/app.tsx', 'import React from "react"\n\nfunction App() {\n  return <div>Hello</div>\n}')

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      expectContent.text('app.tsx')
      expectContent.text('5 lines')
      expectContent.text('71 B')
    })

    it('should show first 10 lines in diff style by default', () => {
      const longContent = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join('\n')
      const toolCall = createWriteToolCall('/test/long-file.ts', longContent)

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      // Should show first 10 lines
      expectContent.text('line 1')
      expectContent.text('line 10')

      // Should not show line 11 initially
      expect(screen.queryByText('line 11')).not.toBeInTheDocument()

      // Should show expand button for files > 10 lines
      expectContent.text('Show all 15 lines')
    })

    it('should expand to show all lines when expand button is clicked', () => {
      const longContent = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join('\n')
      const toolCall = createWriteToolCall('/test/long-file.ts', longContent)

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      const expandButton = screen.getByText('Show all 15 lines')
      fireEvent.click(expandButton)

      // Should now show all lines
      expectContent.text('line 1')
      expectContent.text('line 15')

      // Button should change to "Show less"
      expectSemanticMarkup.button('Show less')
    })

    it('should not show expand button for files with 10 or fewer lines', () => {
      const shortContent = Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join('\n')
      const toolCall = createWriteToolCall('/test/short-file.ts', shortContent)

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      // Should show all lines
      expectContent.text('line 1')
      expectContent.text('line 8')

      // Should not show expand button
      expect(screen.queryByRole('button', { name: /show all/i })).not.toBeInTheDocument()
    })

    it('should apply syntax highlighting based on file extension', () => {
      const jsContent = 'function test() {\n  return "hello"\n}'
      const toolCall = createWriteToolCall('/test/script.js', jsContent)

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      // Should have proper line numbers and + indicators for diff style
      const codeLines = screen.getAllByText('+')
      expect(codeLines.length).toBeGreaterThan(0)

      // Should show line numbers
      expectContent.text('1')
      expectContent.text('2')
    })

    it('should calculate file size correctly', () => {
      const content = 'a'.repeat(1024) // 1KB
      const toolCall = createWriteToolCall('/test/large.txt', content)

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      expectContent.text('1 KB')
    })

    it('should handle empty files', () => {
      const toolCall = createWriteToolCall('/test/empty.txt', '')

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      expectContent.text('empty.txt')
      expectContent.text('1 line') // Empty file still has 1 line
      expectContent.text('0 B')
    })

    it('should not display when result is unsuccessful', () => {
      const toolCall = createWriteToolCall('/test/app.tsx', 'some content')

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'Permission denied', is_error: true }}
        />
      )

      // Should not render anything when there's an error
      expect(screen.queryByText('app.tsx')).not.toBeInTheDocument()
    })
  })

  describe('when Write tool has no result', () => {
    it('should not render anything', () => {
      const toolCall = createWriteToolCall('/test/app.tsx', 'content')

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={false}
        />
      )

      expect(screen.queryByText('app.tsx')).not.toBeInTheDocument()
    })
  })

  describe('when Write tool has failed', () => {
    it('should not render the preview', () => {
      const toolCall = createWriteToolCall('/test/app.tsx', 'content')

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ success: false, error: 'Permission denied' }}
        />
      )

      expect(screen.queryByText('app.tsx')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have proper ARIA labels for expand button', () => {
      const longContent = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join('\n')
      const toolCall = createWriteToolCall('/test/long-file.ts', longContent)

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      const expandButton = screen.getByText('Show all 15 lines')
      expect(expandButton).toHaveAttribute('aria-label', 'Show all')

      fireEvent.click(expandButton)

      const collapseButton = screen.getByText('Show less')
      expect(collapseButton).toHaveAttribute('aria-label', 'Show less')
    })

    it('should have proper code region semantics', () => {
      const toolCall = createWriteToolCall('/test/app.tsx', 'const x = 1')

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      // Code block should have proper semantics (handled by CodeBlock component)
      expectContent.text('const x = 1')
    })
  })

  describe('interaction behavior', () => {
    it('should toggle expand/collapse on button clicks', () => {
      const longContent = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join('\n')
      const toolCall = createWriteToolCall('/test/long-file.ts', longContent)

      render(
        <WriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: 'File created successfully', is_error: false }}
        />
      )

      const expandButton = screen.getByText('Show all 15 lines')

      // Initially collapsed
      expect(screen.queryByText('line 15')).not.toBeInTheDocument()

      // Expand
      fireEvent.click(expandButton)
      expectContent.text('line 15')

      // Collapse
      const collapseButton = screen.getByText('Show less')
      fireEvent.click(collapseButton)
      expect(screen.queryByText('line 15')).not.toBeInTheDocument()
    })
  })
})