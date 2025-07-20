import { memo, useState } from 'react'
import { RiArrowDownSLine } from 'react-icons/ri'
import { colors, typography, transition } from '../../../constants/design'
import { MarkdownRenderer } from '../../MarkdownRenderer'
import type { ToolUseContent } from '../../../types/events'
import clsx from 'clsx'

interface ExitPlanModeDisplayProps {
  toolCall: ToolUseContent
  hasResult?: boolean
  result?: unknown
}

export const ExitPlanModeDisplay = memo(({ toolCall }: ExitPlanModeDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false) // Start collapsed by default
  
  // Extract plan content from input
  const planContent = (toolCall.input as { plan?: string })?.plan || ''
  
  // Split content into lines for counting
  const lines = planContent.split('\n').filter(line => line.trim() !== '')
  const hasMoreThanThreeLines = lines.length > 3
  
  // Get the lines to display
  const displayLines = isExpanded ? lines : lines.slice(0, 3)
  
  // If no content, show a placeholder
  if (!planContent.trim()) {
    return (
      <div className={clsx(
        typography.font.mono,
        typography.size.sm,
        colors.text.tertiary,
        'italic'
      )}>
        <p>No plan content available</p>
      </div>
    )
  }
  
  return (
    <div>
      {/* Collapsible content */}
      {isExpanded ? (
        // Full content with markdown rendering
        <div className={clsx(
          'p-4',
          colors.background.secondary,
          'border border-zinc-800',
          'rounded-lg',
          '[&>div>*:first-child]:mt-0' // Remove top margin from first child
        )}>
          <MarkdownRenderer content={planContent} />
        </div>
      ) : (
        // Collapsed preview - show as markdown too for consistency
        <div className={clsx(
          'p-4',
          colors.background.secondary,
          'border border-zinc-800',
          'rounded-lg',
          '[&>div>*:first-child]:mt-0' // Remove top margin from first child
        )}>
          <MarkdownRenderer content={displayLines.join('\n') + (hasMoreThanThreeLines ? '\n...' : '')} />
        </div>
      )}
      
      {/* Expand/Collapse button - only show if content is long */}
      {hasMoreThanThreeLines && (
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
            {isExpanded ? 'Show less' : `+${lines.length - 3} more lines`}
          </span>
        </div>
      )}
    </div>
  )
})

ExitPlanModeDisplay.displayName = 'ExitPlanModeDisplay'