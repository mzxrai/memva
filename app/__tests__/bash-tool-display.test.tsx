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
        stdout: 'file1.txt',
        stderr: '',
        interrupted: false
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

    it('should display preview with line count for multi-line result', () => {
      const bashTool = MOCK_TOOLS.bash('ls -la')
      const result = {
        stdout: 'file1.txt\nfile2.txt\nfile3.txt',
        stderr: '',
        interrupted: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show preview with additional line count
      expectContent.text('file1.txt (+2 more)')
    })

    it('should truncate very long single lines', () => {
      const bashTool = MOCK_TOOLS.bash('echo')
      const longOutput = 'a'.repeat(250)
      const result = {
        stdout: longOutput,
        stderr: '',
        interrupted: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should truncate and show ellipsis
      expect(screen.getByText(/a{150,}…/)).toBeInTheDocument()
    })

    it('should show expand button for long output and expand when clicked', () => {
      const bashTool = MOCK_TOOLS.bash('ls -la')
      const longOutput = 'a'.repeat(150)
      const result = {
        stdout: longOutput,
        stderr: '',
        interrupted: false
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show expand button
      const expandButton = screen.getByRole('button', { name: /expand/i })
      expect(expandButton).toBeInTheDocument()

      // Click to expand
      fireEvent.click(expandButton)

      // Should show collapse button and code block
      expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument()
      expect(screen.getByLabelText('code block')).toBeInTheDocument()
    })
  })

  describe('when Bash tool has error result', () => {
    it('should display error status for stderr output', () => {
      const bashTool = MOCK_TOOLS.bash('invalid-command')
      const result = {
        stdout: '',
        stderr: 'command not found: invalid-command',
        interrupted: false
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

    it('should display interrupted status', () => {
      const bashTool = MOCK_TOOLS.bash('long-running-command')
      const result = {
        stdout: 'partial output',
        stderr: '',
        interrupted: true
      }
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={result}
        />
      )

      // Should show interrupted indicator
      expectContent.text('✗ Interrupted')
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

  describe('when result format is invalid', () => {
    it('should handle non-object result gracefully', () => {
      const bashTool = MOCK_TOOLS.bash('ls')
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result="string result"
        />
      )

      // Should not render anything for invalid format
      expect(screen.queryByText('string result')).not.toBeInTheDocument()
    })

    it('should handle empty result object', () => {
      const bashTool = MOCK_TOOLS.bash('ls')
      
      render(
        <BashToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result={{}}
        />
      )

      // Should show "Done" for empty but successful result
      expectContent.text('Done')
    })
  })
})