import { memo } from 'react'
import { RiCheckboxBlankLine } from 'react-icons/ri'
import { colors, typography } from '../../../constants/design'
import type { ToolUseContent } from '../../../types/events'
import clsx from 'clsx'

interface TodoWriteToolDisplayProps {
  toolCall: ToolUseContent
  hasResult: boolean
  result?: unknown
}

type TodoItem = {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
}

// Extract and validate todo items from tool input
const extractTodoItems = (input: unknown): TodoItem[] => {
  if (!input || typeof input !== 'object' || input === null) {
    return []
  }

  const inputObj = input as Record<string, unknown>
  if (!Array.isArray(inputObj.todos)) {
    return []
  }

  return inputObj.todos.filter((todo: unknown): todo is TodoItem => {
    if (!todo || typeof todo !== 'object' || todo === null) {
      return false
    }

    const todoObj = todo as Record<string, unknown>
    return (
      typeof todoObj.id === 'string' &&
      typeof todoObj.content === 'string' &&
      (todoObj.status === 'pending' || todoObj.status === 'in_progress' || todoObj.status === 'completed') &&
      (todoObj.priority === 'high' || todoObj.priority === 'medium' || todoObj.priority === 'low')
    )
  })
}


export const TodoWriteToolDisplay = memo(({ toolCall, hasResult, result }: TodoWriteToolDisplayProps) => {
  // Only show for TodoWrite tools with results
  if (toolCall.name !== 'TodoWrite' || !hasResult || !result) {
    return null
  }

  // Expect result format: {content: string, is_error: boolean}
  if (typeof result !== 'object' || result === null) {
    return null
  }

  const sdkResult = result as { content?: string, is_error?: boolean }

  if (sdkResult.content === undefined) {
    return null
  }

  const isError = sdkResult.is_error === true

  // Handle error display
  if (isError) {
    const errorContent = typeof sdkResult.content === 'string' ? sdkResult.content : 'TodoWrite operation failed'
    
    return (
      <div className="py-2">
        <div className={clsx(
          typography.font.mono,
          typography.size.sm,
          colors.accent.red.text,
          'whitespace-pre-wrap'
        )}>
          {errorContent}
        </div>
      </div>
    )
  }

  const todos = extractTodoItems(toolCall.input)

  if (todos.length === 0) {
    return (
      <div className={clsx(
        'py-2',
        typography.font.mono,
        typography.size.sm,
        colors.text.tertiary
      )}>
        No tasks
      </div>
    )
  }

  return (
    <div className="py-2">
      <div className="space-y-1">
        {todos.map((todo) => {
          const isCompleted = todo.status === 'completed'
          const isInProgress = todo.status === 'in_progress'

          return (
            <div
              key={todo.id}
              className={clsx(
                'flex items-center gap-3',
                typography.font.mono,
                typography.size.sm
              )}
            >
              {/* Status indicator */}
              <span
                className={clsx(
                  'flex-shrink-0 w-5 h-5 flex items-center justify-center',
                  isCompleted && 'text-emerald-500',
                  isInProgress && 'text-blue-500',
                  !isCompleted && !isInProgress && 'text-zinc-500'
                )}
              >
                {isCompleted && <span>✅</span>}
                {isInProgress && <span>🔄</span>}
                {!isCompleted && !isInProgress && <RiCheckboxBlankLine className="w-[18px] h-[18px]" />}
              </span>

              {/* Task text */}
              <span
                className={clsx(
                  'flex-1',
                  isCompleted && 'text-zinc-500 line-through',
                  isInProgress && 'text-zinc-100',
                  !isCompleted && !isInProgress && 'text-zinc-300'
                )}
              >
                {todo.content}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})

TodoWriteToolDisplay.displayName = 'TodoWriteToolDisplay'