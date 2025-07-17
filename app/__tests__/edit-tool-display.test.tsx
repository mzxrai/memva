import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditToolDisplay } from '../components/events/tools/EditToolDisplay'
import type { ToolUseContent } from '../types/events'

describe('EditToolDisplay Component', () => {
  describe('when Edit tool has successful result', () => {
    it('should display diff for Edit tool changes', () => {
      const result = { content: 'File updated successfully', is_error: false }

      const editTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_test',
        name: 'Edit',
        input: {
          file_path: '/test/file.ts',
          old_string: 'const x = 1',
          new_string: 'const x = 2'
        }
      }

      render(
        <EditToolDisplay
          toolCall={editTool}
          hasResult={true}
          result={result}
          lineInfo={{ startLine: 1, showLineNumbers: true }}
        />
      )

      // Should show diff content from input
      expect(screen.getByText('const x = 1')).toBeInTheDocument()
      expect(screen.getByText('const x = 2')).toBeInTheDocument()
    })

    it('should display diff for MultiEdit tool changes', () => {
      const result = { content: 'File updated successfully', is_error: false }

      const multiEditTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_test',
        name: 'MultiEdit',
        input: {
          file_path: '/test/file.ts',
          edits: [
            { old_string: 'const x = 1', new_string: 'const x = 2' },
            { old_string: 'const y = 3', new_string: 'const y = 4' }
          ]
        }
      }

      render(
        <EditToolDisplay
          toolCall={multiEditTool}
          hasResult={true}
          result={result}
          lineInfo={{ startLine: 1, showLineNumbers: true }}
        />
      )

      // Should show all edits
      expect(screen.getByText('const x = 1')).toBeInTheDocument()
      expect(screen.getByText('const x = 2')).toBeInTheDocument()
      expect(screen.getByText('const y = 3')).toBeInTheDocument()
      expect(screen.getByText('const y = 4')).toBeInTheDocument()

      // Should show edit count
      expect(screen.getByText('2 edits applied')).toBeInTheDocument()
    })

    it('should handle edit with line info properly', () => {
      const result = { content: 'File updated successfully', is_error: false }

      const editTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_test',
        name: 'Edit',
        input: {
          file_path: '/test/file.ts',
          old_string: 'function test() {}',
          new_string: 'function test() {\n  return true\n}'
        }
      }

      render(
        <EditToolDisplay
          toolCall={editTool}
          hasResult={true}
          result={result}
          lineInfo={{ startLine: 10, showLineNumbers: true }}
        />
      )

      // Should show the diff starting from line 10
      expect(screen.getByText('function test() {}')).toBeInTheDocument()
      expect(screen.getByText('function test() {')).toBeInTheDocument()
      expect(screen.getByText('return true')).toBeInTheDocument()
    })
  })

  describe('when Edit tool has no result or invalid input', () => {
    it('should not render for non-Edit tools', () => {
      const bashTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_test',
        name: 'Bash',
        input: { command: 'ls -la' }
      }

      render(
        <EditToolDisplay
          toolCall={bashTool}
          hasResult={true}
          result={{ content: "File content", is_error: false }}
          lineInfo={null}
        />
      )

      // Should not render anything for non-Edit tools
      expect(screen.queryByText('File content')).not.toBeInTheDocument()
    })

    it('should not render when hasResult is false', () => {
      const editTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_test',
        name: 'Edit',
        input: {
          file_path: '/test/file.ts',
          old_string: 'const x = 1',
          new_string: 'const x = 2'
        }
      }

      render(
        <EditToolDisplay
          toolCall={editTool}
          hasResult={false}
          result={{ content: "File updated", is_error: false }}
          lineInfo={null}
        />
      )

      // Should not render anything when hasResult is false
      expect(screen.queryByText('const x = 1')).not.toBeInTheDocument()
    })

    it('should not render when result is null', () => {
      const editTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_test',
        name: 'Edit',
        input: {
          file_path: '/test/file.ts',
          old_string: 'const x = 1',
          new_string: 'const x = 2'
        }
      }

      render(
        <EditToolDisplay
          toolCall={editTool}
          hasResult={true}
          result={null}
          lineInfo={null}
        />
      )

      // Should not render anything when result is null
      expect(screen.queryByText('const x = 1')).not.toBeInTheDocument()
    })

    it('should not render when result has error', () => {
      const editTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_test',
        name: 'Edit',
        input: {
          file_path: '/test/file.ts',
          old_string: 'const x = 1',
          new_string: 'const x = 2'
        }
      }

      render(
        <EditToolDisplay
          toolCall={editTool}
          hasResult={true}
          result={{ content: "Edit failed", is_error: true }}
          lineInfo={null}
        />
      )

      // Should not render anything when there's an error
      expect(screen.queryByText('const x = 1')).not.toBeInTheDocument()
    })
  })
})