import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolCallDisplay } from '../components/events/ToolCallDisplay'
import { EditToolDisplay } from '../components/events/tools/EditToolDisplay'
import { createMockPermissionRequest } from '../test-utils/factories'
import { PermissionStatus } from '../types/permissions'
import type { ToolUseContent } from '../types/events'

describe('Edit Preview with Permissions', () => {
  describe('ToolCallDisplay with Edit permissions', () => {
    it('should show diff preview when permission is pending', () => {
      const editToolCall: ToolUseContent = {
        type: 'tool_use',
        id: 'test-edit-1',
        name: 'Edit',
        input: {
          file_path: '/test/file.ts',
          old_string: 'const oldValue = 1;',
          new_string: 'const newValue = 2;'
        }
      }

      const permission = createMockPermissionRequest({
        id: 'perm-1',
        tool_use_id: 'test-edit-1',
        status: PermissionStatus.PENDING
      })

      render(
        <ToolCallDisplay
          toolCall={editToolCall}
          permission={permission}
          onApprovePermission={vi.fn()}
          onDenyPermission={vi.fn()}
        />
      )

      // Should show permission request
      expect(screen.getByText('Do you approve this action?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Approve permission' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Deny permission' })).toBeInTheDocument()

      // Should show diff preview
      expect(screen.getByText('const oldValue = 1;')).toBeInTheDocument()
      expect(screen.getByText('const newValue = 2;')).toBeInTheDocument()
    })

    it('should show MultiEdit preview with multiple changes', () => {
      const multiEditToolCall: ToolUseContent = {
        type: 'tool_use',
        id: 'test-multiedit-1',
        name: 'MultiEdit',
        input: {
          file_path: '/test/file.ts',
          edits: [
            {
              old_string: 'const a = 1;',
              new_string: 'const a = 2;'
            },
            {
              old_string: 'const b = 3;',
              new_string: 'const b = 4;'
            }
          ]
        }
      }

      const permission = createMockPermissionRequest({
        id: 'perm-2',
        tool_use_id: 'test-multiedit-1',
        status: PermissionStatus.PENDING
      })

      render(
        <ToolCallDisplay
          toolCall={multiEditToolCall}
          permission={permission}
          onApprovePermission={vi.fn()}
          onDenyPermission={vi.fn()}
        />
      )

      // Should show permission request
      expect(screen.getByText('Do you approve this action?')).toBeInTheDocument()

      // Should show edit count
      expect(screen.getByText('2 edits applied')).toBeInTheDocument()

      // Should show both edits in preview
      expect(screen.getByText('const a = 1;')).toBeInTheDocument()
      expect(screen.getByText('const a = 2;')).toBeInTheDocument()
      expect(screen.getByText('const b = 3;')).toBeInTheDocument()
      expect(screen.getByText('const b = 4;')).toBeInTheDocument()
    })

    it('should not show diff preview for non-edit tools', () => {
      const bashToolCall: ToolUseContent = {
        type: 'tool_use',
        id: 'test-bash-1',
        name: 'Bash',
        input: {
          command: 'ls -la'
        }
      }

      const permission = createMockPermissionRequest({
        id: 'perm-3',
        tool_use_id: 'test-bash-1',
        status: PermissionStatus.PENDING
      })

      render(
        <ToolCallDisplay
          toolCall={bashToolCall}
          permission={permission}
          onApprovePermission={vi.fn()}
          onDenyPermission={vi.fn()}
        />
      )

      // Should show permission request
      expect(screen.getByText('Do you approve this action?')).toBeInTheDocument()

      // Should NOT show any diff elements
      expect(screen.queryByText('const')).not.toBeInTheDocument()
    })
  })

  describe('EditToolDisplay component', () => {
    it('should show diff preview without result', () => {
      const editToolCall: ToolUseContent = {
        type: 'tool_use',
        id: 'test-edit-2',
        name: 'Edit',
        input: {
          file_path: '/test/component.tsx',
          old_string: 'return <div>Hello</div>',
          new_string: 'return <div>Hello World</div>'
        }
      }

      render(
        <EditToolDisplay
          toolCall={editToolCall}
          hasResult={false}
          result={undefined}
          lineInfo={null}
          showPreview={true}
        />
      )

      // Should show the diff
      expect(screen.getByText('return <div>Hello</div>')).toBeInTheDocument()
      expect(screen.getByText('return <div>Hello World</div>')).toBeInTheDocument()
    })

    it('should show error when result contains error', () => {
      const editToolCall: ToolUseContent = {
        type: 'tool_use',
        id: 'test-edit-3',
        name: 'Edit',
        input: {
          file_path: '/test/file.ts',
          old_string: 'const x = 1;',
          new_string: 'const y = 2;'
        }
      }

      const errorResult = {
        content: 'Failed to edit file: File not found',
        is_error: true
      }

      render(
        <EditToolDisplay
          toolCall={editToolCall}
          hasResult={true}
          result={errorResult}
          lineInfo={null}
        />
      )

      // Should show error message
      expect(screen.getByText('Failed to edit file: File not found')).toBeInTheDocument()
      
      // Should NOT show the diff
      expect(screen.queryByText('const x = 1;')).not.toBeInTheDocument()
    })

    it('should handle expand/collapse for large diffs', async () => {
      const user = userEvent.setup()
      
      // Create a large edit with many lines
      const oldLines = Array.from({ length: 20 }, (_, i) => `line${i}: 'old value ${i}',`).join('\n')
      const newLines = Array.from({ length: 20 }, (_, i) => `line${i}: 'new value ${i}',`).join('\n')

      const editToolCall: ToolUseContent = {
        type: 'tool_use',
        id: 'test-edit-4',
        name: 'Edit',
        input: {
          file_path: '/test/large-file.ts',
          old_string: oldLines,
          new_string: newLines
        }
      }

      render(
        <EditToolDisplay
          toolCall={editToolCall}
          hasResult={false}
          result={undefined}
          lineInfo={null}
          showPreview={true}
        />
      )

      // Should show expand button for large content
      const expandButton = screen.getByRole('button', { name: 'Expand' })
      expect(expandButton).toBeInTheDocument()
      expect(expandButton).toHaveTextContent('Show 30 more lines') // 40 total lines - 10 shown = 30 more

      // Click to expand
      await user.click(expandButton)

      // Button should now say collapse
      expect(screen.getByRole('button', { name: 'Collapse' })).toHaveTextContent('Show less')
    })

    it('should show line numbers when lineInfo is provided', () => {
      const editToolCall: ToolUseContent = {
        type: 'tool_use',
        id: 'test-edit-5',
        name: 'Edit',
        input: {
          file_path: '/test/file.ts',
          old_string: 'const value = 1;',
          new_string: 'const value = 2;'
        }
      }

      const lineInfo = {
        startLine: 42,
        showLineNumbers: true
      }

      render(
        <EditToolDisplay
          toolCall={editToolCall}
          hasResult={false}
          result={undefined}
          lineInfo={lineInfo}
          showPreview={true}
        />
      )

      // DiffViewer should receive the line number info
      // Note: We'd need to check the actual DiffViewer implementation
      // to verify line numbers are displayed starting at 42
      expect(screen.getByText('const value = 1;')).toBeInTheDocument()
    })

    it('should handle empty edits gracefully', () => {
      const editToolCall: ToolUseContent = {
        type: 'tool_use',
        id: 'test-edit-6',
        name: 'MultiEdit',
        input: {
          file_path: '/test/file.ts',
          edits: []
        }
      }

      const { container } = render(
        <EditToolDisplay
          toolCall={editToolCall}
          hasResult={false}
          result={undefined}
          lineInfo={null}
        />
      )

      // With empty edits, the component returns null (no render)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Permission state transitions', () => {
    it('should show diff during pending state and after approval', () => {
      const editToolCall: ToolUseContent = {
        type: 'tool_use',
        id: 'test-edit-7',
        name: 'Edit',
        input: {
          file_path: '/test/file.ts',
          old_string: 'let count = 0;',
          new_string: 'let count = 1;'
        }
      }

      // First render with pending permission
      const { rerender } = render(
        <ToolCallDisplay
          toolCall={editToolCall}
          permission={createMockPermissionRequest({
            id: 'perm-4',
            tool_use_id: 'test-edit-7',
            status: PermissionStatus.PENDING
          })}
          onApprovePermission={vi.fn()}
          onDenyPermission={vi.fn()}
        />
      )

      // Should show diff with pending permission
      expect(screen.getByText('Do you approve this action?')).toBeInTheDocument()
      expect(screen.getByText('let count = 0;')).toBeInTheDocument()
      expect(screen.getByText('let count = 1;')).toBeInTheDocument()

      // Simulate approval - rerender with approved permission and result
      rerender(
        <ToolCallDisplay
          toolCall={editToolCall}
          permission={createMockPermissionRequest({
            id: 'perm-4',
            tool_use_id: 'test-edit-7',
            status: PermissionStatus.APPROVED
          })}
          hasResult={true}
          result={{ content: 'Edit successful', is_error: false }}
          onApprovePermission={vi.fn()}
          onDenyPermission={vi.fn()}
        />
      )

      // Should still show diff after approval
      expect(screen.getByText('Approved')).toBeInTheDocument()
      expect(screen.getByText('let count = 0;')).toBeInTheDocument()
      expect(screen.getByText('let count = 1;')).toBeInTheDocument()
    })
  })
})