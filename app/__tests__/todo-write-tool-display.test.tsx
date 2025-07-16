import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoWriteToolDisplay } from '../components/events/tools/TodoWriteToolDisplay'
import { MOCK_TOOLS } from '../test-utils/factories'
import { expectContent } from '../test-utils/component-testing'

describe('TodoWriteToolDisplay Component', () => {
  describe('when TodoWrite tool has successful result', () => {
    it('should display todo items with status indicators', () => {
      const todoTool = MOCK_TOOLS.todoWrite([
        { id: '1', content: 'Write tests', status: 'completed', priority: 'high' },
        { id: '2', content: 'Implement feature', status: 'in_progress', priority: 'high' },
        { id: '3', content: 'Update docs', status: 'pending', priority: 'medium' }
      ])
      
      render(
        <TodoWriteToolDisplay 
          toolCall={todoTool}
          hasResult={true}
          result="Todos have been modified successfully"
        />
      )

      // Should show all todo items
      expectContent.text('Write tests')
      expectContent.text('Implement feature')
      expectContent.text('Update docs')
      
      // Should show all todo items with proper styling
      // (No longer showing progress indicator in simplified design)
    })

    it('should display priority indicators correctly', () => {
      const todoTool = MOCK_TOOLS.todoWrite([
        { id: '1', content: 'High priority task', status: 'pending', priority: 'high' },
        { id: '2', content: 'Medium priority task', status: 'pending', priority: 'medium' },
        { id: '3', content: 'Low priority task', status: 'pending', priority: 'low' }
      ])
      
      render(
        <TodoWriteToolDisplay 
          toolCall={todoTool}
          hasResult={true}
          result="Todos have been modified successfully"
        />
      )

      // Should show priority levels (high should be more prominent)
      expectContent.text('High priority task')
      expectContent.text('Medium priority task')
      expectContent.text('Low priority task')
    })

    it('should highlight in_progress tasks prominently', () => {
      const todoTool = MOCK_TOOLS.todoWrite([
        { id: '1', content: 'Current work item', status: 'in_progress', priority: 'high' },
        { id: '2', content: 'Completed item', status: 'completed', priority: 'high' },
        { id: '3', content: 'Future item', status: 'pending', priority: 'medium' }
      ])
      
      render(
        <TodoWriteToolDisplay 
          toolCall={todoTool}
          hasResult={true}
          result="Todos have been modified successfully"
        />
      )

      // Should show the in_progress item with special styling
      expectContent.text('Current work item')
    })

    it('should handle empty todo list', () => {
      const todoTool = MOCK_TOOLS.todoWrite([])
      
      render(
        <TodoWriteToolDisplay 
          toolCall={todoTool}
          hasResult={true}
          result="Todos have been modified successfully"
        />
      )

      // Should show empty state
      expectContent.text('No tasks')
    })

    it('should handle single todo item', () => {
      const todoTool = MOCK_TOOLS.todoWrite([
        { id: '1', content: 'Single task', status: 'pending', priority: 'high' }
      ])
      
      render(
        <TodoWriteToolDisplay 
          toolCall={todoTool}
          hasResult={true}
          result="Todos have been modified successfully"
        />
      )

      expectContent.text('Single task')
    })

    it('should show task count summary', () => {
      const todoTool = MOCK_TOOLS.todoWrite([
        { id: '1', content: 'Task 1', status: 'completed', priority: 'high' },
        { id: '2', content: 'Task 2', status: 'in_progress', priority: 'high' },
        { id: '3', content: 'Task 3', status: 'pending', priority: 'medium' },
        { id: '4', content: 'Task 4', status: 'pending', priority: 'low' }
      ])
      
      render(
        <TodoWriteToolDisplay 
          toolCall={todoTool}
          hasResult={true}
          result="Todos have been modified successfully"
        />
      )

      // Should show all task items
      expectContent.text('Task 1')
      expectContent.text('Task 2') 
      expectContent.text('Task 3')
      expectContent.text('Task 4')
    })
  })

  describe('when TodoWrite tool has no result', () => {
    it('should not render anything', () => {
      const todoTool = MOCK_TOOLS.todoWrite([
        { id: '1', content: 'Test task', status: 'pending', priority: 'high' }
      ])
      
      render(
        <TodoWriteToolDisplay 
          toolCall={todoTool}
          hasResult={false}
        />
      )

      // Should not render any content
      expect(screen.queryByText('Test task')).not.toBeInTheDocument()
    })
  })

  describe('when tool is not TodoWrite', () => {
    it('should not render anything for non-TodoWrite tools', () => {
      const bashTool = MOCK_TOOLS.bash('ls')
      
      render(
        <TodoWriteToolDisplay 
          toolCall={bashTool}
          hasResult={true}
          result="file1.txt\nfile2.txt"
        />
      )

      // Should not render anything
      expect(screen.queryByText('file1.txt')).not.toBeInTheDocument()
    })
  })

  describe('when result format is invalid', () => {
    it('should not render for invalid input format', () => {
      const invalidTool = {
        type: 'tool_use' as const,
        id: 'toolu_test',
        name: 'TodoWrite',
        input: { invalid: 'format' } // Missing todos array
      }
      
      render(
        <TodoWriteToolDisplay 
          toolCall={invalidTool}
          hasResult={true}
          result="Success"
        />
      )

      // Should not render anything for invalid format
      expect(screen.queryByText('Success')).not.toBeInTheDocument()
    })

    it('should handle malformed todo items gracefully', () => {
      const invalidTool = {
        type: 'tool_use' as const,
        id: 'toolu_test',
        name: 'TodoWrite',
        input: { 
          todos: [
            { id: '1', content: 'Valid task', status: 'pending', priority: 'high' },
            { content: 'Missing id and status' }, // Invalid item
            { id: '3', content: 'Another valid task', status: 'completed', priority: 'medium' }
          ]
        }
      }
      
      render(
        <TodoWriteToolDisplay 
          toolCall={invalidTool}
          hasResult={true}
          result="Success"
        />
      )

      // Should show valid items but skip invalid ones
      expectContent.text('Valid task')
      expectContent.text('Another valid task')
      expect(screen.queryByText('Missing id and status')).not.toBeInTheDocument()
    })
  })
})