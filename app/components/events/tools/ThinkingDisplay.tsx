import { memo, useState } from 'react'
import { RiArrowDownSLine } from 'react-icons/ri'
import { colors, typography, transition } from '../../../constants/design'
import type { ThinkingContent } from '../../../types/events'
import clsx from 'clsx'

interface ThinkingDisplayProps {
  content: ThinkingContent
}

export const ThinkingDisplay = memo(({ content }: ThinkingDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Handle cases where thinking might be undefined or empty
  const text = content.thinking || ''
  
  // Split content into lines
  const lines = text.split('\n').filter(line => line.trim() !== '')
  const hasMoreThanThreeLines = lines.length > 3
  
  // Get the lines to display
  const displayLines = isExpanded ? lines : lines.slice(0, 3)
  
  // If no content, show a placeholder
  if (lines.length === 0) {
    return (
      <div className="mt-2">
        <div className={clsx(
          'flex items-center gap-2 mb-2',
          typography.size.xs,
          colors.text.tertiary,
          typography.font.mono,
          'uppercase tracking-wider'
        )}>
          <span>Thinking</span>
        </div>
        <div className={clsx(
          typography.font.mono,
          typography.size.sm,
          colors.text.tertiary,
          'italic'
        )}>
          <p>Processing...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="mt-2">
      {/* Thinking badge */}
      <div className={clsx(
        'flex items-center gap-2 mb-2',
        typography.size.xs,
        colors.text.tertiary,
        typography.font.mono,
        'uppercase tracking-wider'
      )}>
        <span>Thinking</span>
      </div>
      
      {/* Content */}
      <div className={clsx(
        typography.font.mono,
        typography.size.sm,
        colors.text.secondary,
        'italic',
        'space-y-1'
      )}>
        {displayLines.map((line, index) => (
          <p key={index} className="leading-relaxed">
            {line}
          </p>
        ))}
      </div>
      
      {/* Expand/Collapse button */}
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

ThinkingDisplay.displayName = 'ThinkingDisplay'