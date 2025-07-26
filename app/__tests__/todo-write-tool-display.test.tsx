import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoWriteToolDisplay } from '../components/events/tools/TodoWriteToolDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectContent } from '../test-utils/component-testing'

// Helper function to create todo items
function createTodoItem(status: 'pending' | 'in_progress' | 'completed', content?: string) {
  return {
    id: crypto.randomUUID(),
    content: content || `Test ${status} task`,
    status,
    priority: 'high' as const
  }
}

describe('TodoWriteToolDisplay Component', () => {
  describe('when TodoWrite tool has result', () => {
    it('should display todo list with proper status indicators', () => {
      const toolCall = MOCK_TOOLS.todoWrite([createTodoItem('completed'), createTodoItem('in_progress'), createTodoItem('pending')])

      render(
        <TodoWriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: "Todos have been modified successfully", is_error: false }}
        />
      )

      // Should show all three todos with their status indicators
      expect(screen.getByText('✅')).toBeInTheDocument() // completed
      expect(screen.getByText('🔄')).toBeInTheDocument() // in_progress  
      expect(screen.getByText('Test pending task').parentElement?.querySelector('svg')).toBeInTheDocument() // pending

      expectContent.text('Test completed task')
      expectContent.text('Test in_progress task')
      expectContent.text('Test pending task')
    })

    it('should display only pending and in progress todos correctly', () => {
      const toolCall = MOCK_TOOLS.todoWrite([createTodoItem('pending'), createTodoItem('in_progress')])

      render(
        <TodoWriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: "Todos have been modified successfully", is_error: false }}
        />
      )

      expect(screen.getByText('🔄')).toBeInTheDocument()
      expect(screen.getByText('Test pending task').parentElement?.querySelector('svg')).toBeInTheDocument()
      expect(screen.queryByText('✅')).not.toBeInTheDocument()
    })

    it('should handle single todo item', () => {
      const toolCall = MOCK_TOOLS.todoWrite([createTodoItem('completed')])

      render(
        <TodoWriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: "Todos have been modified successfully", is_error: false }}
        />
      )

      expect(screen.getByText('✅')).toBeInTheDocument()
      expectContent.text('Test completed task')
    })

    it('should handle empty todo list gracefully', () => {
      const toolCall = MOCK_TOOLS.todoWrite([])

      render(
        <TodoWriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: "Todos have been modified successfully", is_error: false }}
        />
      )

      expectContent.text('No tasks')
    })

    it('should display todo items in a structured format', () => {
      const toolCall = MOCK_TOOLS.todoWrite([createTodoItem('pending')])

      render(
        <TodoWriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: "Todos have been modified successfully", is_error: false }}
        />
      )

      // Verify todo items are displayed in a readable, structured format
      const todoText = screen.getByText('Test pending task')
      expect(todoText).toBeInTheDocument()
      expect(todoText).toBeVisible()
    })

    it('should apply correct styling for different todo states', () => {
      const toolCall = MOCK_TOOLS.todoWrite([
        createTodoItem('completed'),
        createTodoItem('in_progress'),
        createTodoItem('pending')
      ])

      render(
        <TodoWriteToolDisplay
          toolCall={toolCall}
          hasResult={true}
          result={{ content: "Todos have been modified successfully", is_error: false }}
        />
      )

      // Completed should have strikethrough and muted color
      const completedTask = screen.getByText('Test completed task')
      expect(completedTask).toHaveClass('line-through')
      expect(completedTask).toHaveClass('text-zinc-500')

      // In progress should have normal bright color
      const inProgressTask = screen.getByText('Test in_progress task')
      expect(inProgressTask).toHaveClass('text-zinc-100')

      // Pending should have muted but not as much as completed
      const pendingTask = screen.getByText('Test pending task')
      expect(pendingTask).toHaveClass('text-zinc-300')
    })
  })

  describe('when TodoWrite tool has invalid result', () => {
    it('should not display for non-TodoWrite tools', () => {
      const bashTool = MOCK_TOOLS.bash('ls -la')

      render(
        <TodoWriteToolDisplay
          toolCall={bashTool}
          hasResult={true}
          result={{ content: "file1.txt\nfile2.txt", is_error: false }}
        />
      )

      // Should not render anything for non-TodoWrite tools
      expect(screen.queryByText(/task/)).not.toBeInTheDocument()
    })

    it('should not display when result has wrong format', () => {
      const todoTool = MOCK_TOOLS.todoWrite([createTodoItem('pending')])

      render(
        <TodoWriteToolDisplay
          toolCall={todoTool}
          hasResult={true}
          result="Success"
        />
      )

      // Should not render anything for wrong result format  
      expect(screen.queryByText(/task/)).not.toBeInTheDocument()
    })

    it('should not display when hasResult is false', () => {
      const todoTool = MOCK_TOOLS.todoWrite([createTodoItem('pending')])

      render(
        <TodoWriteToolDisplay
          toolCall={todoTool}
          hasResult={false}
          result={{ content: "Success", is_error: false }}
        />
      )

      // Should not render anything when hasResult is false
      expect(screen.queryByText(/task/)).not.toBeInTheDocument()
    })

    it('should not display when result is null', () => {
      const todoTool = MOCK_TOOLS.todoWrite([createTodoItem('pending')])

      render(
        <TodoWriteToolDisplay
          toolCall={todoTool}
          hasResult={true}
          result={null}
        />
      )

      // Should not render anything when result is null
      expect(screen.queryByText(/task/)).not.toBeInTheDocument()
    })
  })
})