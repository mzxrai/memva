import { memo, useState } from 'react'
import type { ToolUseContent } from '../../../types/events'
import { RiArrowDownSLine, RiCheckLine, RiCloseLine } from 'react-icons/ri'
import { colors, typography, transition } from '../../../constants/design'
import clsx from 'clsx'

interface TaskToolDisplayProps {
  toolCall: ToolUseContent
  hasResult: boolean
  result?: unknown
}

export const TaskToolDisplay = memo(({ toolCall, hasResult, result }: TaskToolDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (toolCall.name !== 'Task') {
    return null
  }
  
  // Extract input parameters
  const input = toolCall.input as { description?: string; prompt?: string } | null
  const prompt = input?.prompt || ''
  
  // Split prompt into lines for expand/collapse functionality
  const promptLines = prompt.split('\n').filter(line => line.trim() !== '')
  const hasMultipleLines = promptLines.length > 1
  const displayLines = isExpanded ? promptLines : promptLines.slice(0, 1)
  
  // Determine task status from result
  let taskStatus: 'completed' | 'failed' = 'completed'
  if (hasResult && result && typeof result === 'object' && result !== null) {
    const errorResult = result as { error?: string; is_error?: boolean }
    if (errorResult.error || errorResult.is_error) {
      taskStatus = 'failed'
    }
  }
  
  return (
    <div className="py-2">
      {/* Prompt section */}
      {prompt && (
        <div>
          <div className={clsx(
            'flex items-center gap-2 mb-1',
            typography.size.xs,
            colors.text.tertiary,
            typography.font.mono,
            'uppercase tracking-wider'
          )}>
            <span>Prompt</span>
          </div>
          
          <div className={clsx(
            typography.font.mono,
            typography.size.sm,
            colors.text.secondary,
            'space-y-1'
          )}>
            {displayLines.map((line, index) => (
              <p key={index} className="leading-relaxed">
                {line}
              </p>
            ))}
          </div>
          
          {/* Expand/Collapse button */}
          {hasMultipleLines && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={clsx(
                  'flex items-center justify-center',
                  'w-5 h-5',
                  'border border-zinc-700',
                  'bg-zinc-800/50',
                  'hover:bg-zinc-700/50',
                  'rounded',
                  'flex-shrink-0',
                  transition.fast
                )}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <RiArrowDownSLine className={clsx(
                  'w-3 h-3',
                  colors.text.tertiary,
                  transition.fast,
                  isExpanded && 'rotate-180'
                )} />
              </button>
              <span className={clsx(typography.size.xs, colors.text.tertiary, typography.font.mono)}>
                {isExpanded ? 'Show less' : `+${promptLines.length - 1} more lines`}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Task status */}
      {hasResult && (
        <div className={clsx(
          'mt-3 flex items-center gap-2',
          typography.font.mono,
          typography.size.sm
        )}>
          {taskStatus === 'completed' ? (
            <RiCheckLine className={clsx('w-4 h-4', colors.accent.green.text)} />
          ) : (
            <RiCloseLine className={clsx('w-4 h-4', colors.accent.red.text)} />
          )}
          <span className={clsx(
            taskStatus === 'completed' ? colors.text.secondary : colors.accent.red.text
          )}>
            {taskStatus === 'completed' ? 'Task completed' : 'Task failed'}
          </span>
        </div>
      )}
    </div>
  )
})

TaskToolDisplay.displayName = 'TaskToolDisplay'