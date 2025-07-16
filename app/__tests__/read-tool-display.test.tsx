import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReadToolDisplay } from '../components/events/tools/ReadToolDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectContent } from '../test-utils/component-testing'

describe('ReadToolDisplay Component', () => {
  describe('when Read tool has successful result', () => {
    it('should display line count for single line result', () => {
      const readTool = MOCK_TOOLS.read('/test/file.ts')
      const result = 'console.log("Hello World")'
      
      render(
        <ReadToolDisplay 
          toolCall={readTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show line count
      expectContent.text('1 line loaded')
    })

    it('should display line count for multi-line result', () => {
      const readTool = MOCK_TOOLS.read('/test/file.ts')
      const result = 'import React from "react"\n\nfunction App() {\n  return <div>Hello</div>\n}'
      
      render(
        <ReadToolDisplay 
          toolCall={readTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show plural lines
      expectContent.text('5 lines loaded')
    })

    it('should show expand button for long content and expand when clicked', () => {
      const readTool = MOCK_TOOLS.read('/test/file.ts')
      const longResult = 'a'.repeat(150) // Long content that should be expandable
      
      render(
        <ReadToolDisplay 
          toolCall={readTool}
          hasResult={true}
          result={longResult}
        />
      )

      // Should show expand button
      const expandButton = screen.getByRole('button', { name: /expand/i })
      expect(expandButton).toBeInTheDocument()

      // Click to expand
      fireEvent.click(expandButton)

      // Should show full content and collapse button
      expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument()
      expect(screen.getByLabelText('code block')).toBeInTheDocument()
    })

    it('should handle empty file result', () => {
      const readTool = MOCK_TOOLS.read('/test/empty.txt')
      const result = ''
      
      render(
        <ReadToolDisplay 
          toolCall={readTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show 0 lines for empty file
      expectContent.text('0 lines loaded')
    })

    it('should handle file with only whitespace', () => {
      const readTool = MOCK_TOOLS.read('/test/whitespace.txt')
      const result = '   \n  \n  '
      
      render(
        <ReadToolDisplay 
          toolCall={readTool}
          hasResult={true}
          result={result}
        />
      )

      // Should count actual lines including whitespace
      expectContent.text('3 lines loaded')
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
          result="file1.txt\nfile2.txt"
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