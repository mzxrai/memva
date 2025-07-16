import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditToolDisplay } from '../components/events/tools/EditToolDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectContent } from '../test-utils/component-testing'
import type { ToolUseContent } from '../types/events'

describe('EditToolDisplay Component', () => {
  describe('when Edit tool has successful result', () => {
    it('should display diff view for single Edit tool', () => {
      const editTool = MOCK_TOOLS.edit('/test/file.ts', 'const x = 1', 'const x = 2')
      const result = 'File updated successfully'
      
      render(
        <EditToolDisplay 
          toolCall={editTool}
          hasResult={true}
          result={result}
          lineInfo={{ startLine: 1, showLineNumbers: true }}
        />
      )

      // Should show diff content
      expectContent.text('const x = 1')
      expectContent.text('const x = 2')
    })

    it('should display multi-edit summary for MultiEdit tool', () => {
      const multiEditInput = {
        file_path: '/test/file.ts',
        edits: [
          { old_string: 'const x = 1', new_string: 'const x = 2' },
          { old_string: 'const y = 3', new_string: 'const y = 4' }
        ]
      }
      
      const multiEditTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_01ABC123',
        name: 'MultiEdit',
        input: multiEditInput
      }
      
      const result = 'File updated successfully'
      
      render(
        <EditToolDisplay 
          toolCall={multiEditTool}
          hasResult={true}
          result={result}
          lineInfo={{ startLine: 1, showLineNumbers: true }}
        />
      )

      // Should show edit count summary
      expectContent.text('2 edits applied')
      
      // Should show diff content
      expectContent.text('const x = 1')
      expectContent.text('const x = 2')
      expectContent.text('const y = 3')
      expectContent.text('const y = 4')
    })

    it('should handle Edit tool without line info', () => {
      const editTool = MOCK_TOOLS.edit('/test/file.ts', 'old content', 'new content')
      const result = 'File updated successfully'
      
      render(
        <EditToolDisplay 
          toolCall={editTool}
          hasResult={true}
          result={result}
          lineInfo={null}
        />
      )

      // Should still show diff with default line numbers
      expectContent.text('old content')
      expectContent.text('new content')
    })
  })

  describe('when Edit tool has no result', () => {
    it('should not render anything', () => {
      const editTool = MOCK_TOOLS.edit('/test/file.ts', 'old', 'new')
      
      render(
        <EditToolDisplay 
          toolCall={editTool}
          hasResult={false}
          lineInfo={null}
        />
      )

      // Should not render any diff content
      expect(screen.queryByText('old')).not.toBeInTheDocument()
      expect(screen.queryByText('new')).not.toBeInTheDocument()
    })
  })

  describe('when tool is not Edit/MultiEdit', () => {
    it('should not render anything for non-Edit tools', () => {
      const readTool = MOCK_TOOLS.read('/test/file.ts')
      
      render(
        <EditToolDisplay 
          toolCall={readTool}
          hasResult={true}
          result="File content"
          lineInfo={null}
        />
      )

      // Should not render anything
      expect(screen.queryByText('File content')).not.toBeInTheDocument()
    })
  })

  describe('when tool input is invalid', () => {
    it('should not render for Edit tool without proper input structure', () => {
      const invalidEditTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_01ABC123',
        name: 'Edit',
        input: { file_path: '/test/file.ts' } // Missing old_string/new_string
      }
      
      render(
        <EditToolDisplay 
          toolCall={invalidEditTool}
          hasResult={true}
          result="File updated"
          lineInfo={null}
        />
      )

      // Should not render diff view
      expect(screen.queryByText('File updated')).not.toBeInTheDocument()
    })

    it('should not render for MultiEdit tool with invalid edits array', () => {
      const invalidMultiEditTool: ToolUseContent = {
        type: 'tool_use',
        id: 'toolu_01ABC123',
        name: 'MultiEdit',
        input: { 
          file_path: '/test/file.ts',
          edits: [] // Empty edits array
        }
      }
      
      render(
        <EditToolDisplay 
          toolCall={invalidMultiEditTool}
          hasResult={true}
          result="File updated"
          lineInfo={null}
        />
      )

      // Should not render anything
      expect(screen.queryByText('File updated')).not.toBeInTheDocument()
    })
  })
})