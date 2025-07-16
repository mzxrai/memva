import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BashToolDisplay } from '../components/events/tools/BashToolDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectContent } from '../test-utils/component-testing'

describe('BashToolDisplay Component', () => {
  describe('when Bash tool has successful result', () => {
    it('should display brief output for single line result', () => {
      const bashTool = MOCK_TOOLS.bash('ls -la')
      const result = {
        content: 'file1.txt',
        is_error: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show brief output
      expectContent.text('file1.txt')
    })

    it('should display all lines for 3 or fewer lines', () => {
      const bashTool = MOCK_TOOLS.bash('ls -la')
      const result = {
        content: 'file1.txt\nfile2.txt\nfile3.txt',
        is_error: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show all 3 lines without truncation
      expect(screen.getByText(/file1\.txt[\s\S]*file2\.txt[\s\S]*file3\.txt/)).toBeInTheDocument()
    })

    it('should show first 3 lines with more indicator for longer output', () => {
      const bashTool = MOCK_TOOLS.bash('ls -la')
      const result = {
        content: 'total 19336\ndrwxr-xr-x@ 36 user staff 1152 Jul 16 11:41 .\ndrwxr-xr-x  29 user staff  928 Jul 15 19:49 ..\n-rw-r--r--@  1 user staff   42 Jul 12 19:25 .dockerignore',
        is_error: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show first 3 lines with "more lines" indicator and expand button
      expect(screen.getByText(/total 19336[\s\S]*drwxr-xr-x@[\s\S]*drwxr-xr-x/)).toBeInTheDocument()
      expect(screen.getByText('(+1 more lines)')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
    })

    it('should truncate very long single lines with expand option', () => {
      const bashTool = MOCK_TOOLS.bash('echo')
      const longOutput = 'a'.repeat(250)
      const result = {
        content: longOutput,
        is_error: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should truncate and show ellipsis with expand option
      expect(screen.getByText(/a{100}…/)).toBeInTheDocument()
      expect(screen.getByText('(show full output)')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
    })

    it('should expand long single line when clicked', () => {
      const bashTool = MOCK_TOOLS.bash('echo')
      const longOutput = 'a'.repeat(150)
      const result = {
        content: longOutput,
        is_error: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show expand button
      const expandButton = screen.getByRole('button', { name: 'Expand' })
      expect(expandButton).toBeInTheDocument()

      // Click to expand
      fireEvent.click(expandButton)

      // Should show full content and "Collapse" button
      expect(screen.getByText('a'.repeat(150))).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument()
      expect(screen.getByText('Show less')).toBeInTheDocument()
    })

    it('should show all content for 2-line output without expand button', () => {
      const bashTool = MOCK_TOOLS.bash('node --version && npm --version')
      const result = {
        content: 'v23.10.0\n10.9.0',
        is_error: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show both lines without expand button
      expect(screen.getByText(/v23\.10\.0[\s\S]*10\.9\.0/)).toBeInTheDocument()
      
      // Should not have expand button since content is 2 lines or less
      expect(screen.queryByRole('button', { name: 'Expand' })).not.toBeInTheDocument()
    })

    it('should show expand button for 4+ line output', () => {
      const bashTool = MOCK_TOOLS.bash('ls -la')
      const result = {
        content: 'line1\nline2\nline3\nline4\nline5',
        is_error: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show first 3 lines with more lines indicator and expand button
      expect(screen.getByText(/line1[\s\S]*line2[\s\S]*line3/)).toBeInTheDocument()
      expect(screen.getByText('(+2 more lines)')).toBeInTheDocument()

      // Should have inline expand button
      const expandButton = screen.getByRole('button', { name: 'Expand' })
      expect(expandButton).toBeInTheDocument()

      // Click to expand
      fireEvent.click(expandButton)

      // Should show full content and "Collapse" button
      expect(screen.getByText(/line1[\s\S]*line2[\s\S]*line3[\s\S]*line4[\s\S]*line5/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument()
      expect(screen.getByText('Show less')).toBeInTheDocument()
    })
  })

  describe('when Bash tool has error result', () => {
    it('should display error status for error result', () => {
      const bashTool = MOCK_TOOLS.bash('invalid-command')
      const result = {
        content: 'command not found: invalid-command',
        is_error: true
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show error indicator and message
      expectContent.text('✗ Error')
    })

    it('should display permission error', () => {
      const bashTool = MOCK_TOOLS.bash('ls')
      const result = {
        content: 'Claude requested permissions to use Bash, but you haven\'t granted it yet.',
        is_error: true
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show error indicator
      expectContent.text('✗ Error')
    })
  })

  describe('when Bash tool has no result', () => {
    it('should not render anything', () => {
      const bashTool = MOCK_TOOLS.bash('ls')
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={false}
        />
      )

      // Should not render any output
      expect(screen.queryByText('ls')).not.toBeInTheDocument()
    })
  })

  describe('when tool is not Bash', () => {
    it('should not render anything for non-Bash tools', () => {
      const readTool = MOCK_TOOLS.read('/test/file.ts')
      
      render(
        <BashToolDisplay 
          toolCall={readTool}
          hasResult={true}
          result="File content"
        />
      )

      // Should not render anything
      expect(screen.queryByText('File content')).not.toBeInTheDocument()
    })
  })

  describe('when result has empty content', () => {
    it('should show "Done" for empty content but valid result', () => {
      const bashTool = MOCK_TOOLS.bash('ls')
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={{ content: '', is_error: false }}
        />
      )

      // Should show "Done" for empty but successful result
      expectContent.text('Done')
    })
  })
})