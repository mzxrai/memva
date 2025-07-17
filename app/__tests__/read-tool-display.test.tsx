import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReadToolDisplay } from '../components/events/tools/ReadToolDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectContent } from '../test-utils/component-testing'

describe('ReadToolDisplay Component', () => {
  describe('when Read tool has result', () => {
    it('should display line count for read content', () => {
      const result = { content: 'console.log("Hello World")', is_error: false }
      const toolCall = MOCK_TOOLS.read('/app/test.js')

      render(<ReadToolDisplay toolCall={toolCall} hasResult={true} result={result} />)

      expectContent.text('1 line loaded')
    })

    it('should handle multi-line file contents', () => {
      const result = { content: 'import React from "react"\n\nfunction App() {\n  return <div>Hello</div>\n}', is_error: false }
      const toolCall = MOCK_TOOLS.read('/app/App.tsx')

      render(<ReadToolDisplay toolCall={toolCall} hasResult={true} result={result} />)

      expectContent.text('5 lines loaded')
    })

    it('should show expand button for long content', () => {
      const longResult = { content: 'a'.repeat(150), is_error: false } // Long content that should be expandable
      const toolCall = MOCK_TOOLS.read('/app/large.txt')

      render(<ReadToolDisplay toolCall={toolCall} hasResult={true} result={longResult} />)

      // Should show expand button for long content
      const expandButton = screen.getByRole('button', { name: /expand/i })
      expect(expandButton).toBeInTheDocument()

      // Should show line count
      expectContent.text('1 line loaded')
    })

    it('should handle empty files', () => {
      const result = { content: '', is_error: false }
      const toolCall = MOCK_TOOLS.read('/app/empty.txt')

      render(<ReadToolDisplay toolCall={toolCall} hasResult={true} result={result} />)

      expectContent.text('0 lines loaded')
    })

    it('should handle whitespace-only files', () => {
      const result = { content: '   \n  \n  ', is_error: false }
      const toolCall = MOCK_TOOLS.read('/app/whitespace.txt')

      render(<ReadToolDisplay toolCall={toolCall} hasResult={true} result={result} />)

      expectContent.text('3 lines loaded')
    })

    it('should expand and show file content when expand button is clicked', () => {
      const longContent = 'Line 1\n'.repeat(20)
      const result = { content: longContent, is_error: false }
      const toolCall = MOCK_TOOLS.read('/app/test.txt')

      render(<ReadToolDisplay toolCall={toolCall} hasResult={true} result={result} />)

      // Should show expand button
      const expandButton = screen.getByRole('button', { name: /expand/i })

      // Click to expand
      fireEvent.click(expandButton)

      // Should show the content - there should be multiple "Line 1" instances now visible
      const line1Elements = screen.getAllByText('Line 1')
      expect(line1Elements.length).toBeGreaterThan(1) // Should have multiple instances visible

      // Should show collapse button
      const collapseButton = screen.getByRole('button', { name: /collapse/i })
      expect(collapseButton).toBeInTheDocument()
    })
  })

  describe('when Read tool has no result', () => {
    it('should not render anything', () => {
      const readTool = MOCK_TOOLS.read('/test/file.ts')

      render(
        <ReadToolDisplay
          toolCall={readTool}
          hasResult={false}
        />
      )

      // Should not render any content
      expect(screen.queryByText(/lines loaded/)).not.toBeInTheDocument()
    })
  })

  describe('when tool is not Read', () => {
    it('should not render anything for non-Read tools', () => {
      const bashTool = MOCK_TOOLS.bash('ls')

      render(
        <ReadToolDisplay
          toolCall={bashTool}
          hasResult={true}
          result={{ content: "file1.txt\nfile2.txt", is_error: false }}
        />
      )

      // Should not render anything
      expect(screen.queryByText(/lines loaded/)).not.toBeInTheDocument()
    })
  })

  describe('when result format is invalid', () => {
    it('should not render for non-string result', () => {
      const readTool = MOCK_TOOLS.read('/test/file.ts')

      render(
        <ReadToolDisplay
          toolCall={readTool}
          hasResult={true}
          result={{ stdout: 'not a string' }}
        />
      )

      // Should not render anything for invalid format
      expect(screen.queryByText(/lines loaded/)).not.toBeInTheDocument()
    })

    it('should handle null result gracefully', () => {
      const readTool = MOCK_TOOLS.read('/test/file.ts')

      render(
        <ReadToolDisplay
          toolCall={readTool}
          hasResult={true}
          result={null}
        />
      )

      // Should not render anything
      expect(screen.queryByText(/lines loaded/)).not.toBeInTheDocument()
    })
  })
})