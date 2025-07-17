import { useState, memo } from 'react'
import { RiArrowDownSLine } from 'react-icons/ri'
import { colors, typography, transition } from '../../../constants/design'
import { CodeBlock } from '../CodeBlock'
import type { ToolUseContent } from '../../../types/events'
import clsx from 'clsx'

interface ReadToolDisplayProps {
  toolCall: ToolUseContent
  hasResult: boolean
  result?: unknown
}

// Format Read tool result based on result structure
const formatReadResult = (result: unknown): { status: 'success' | 'error', brief: string, full?: string } | null => {
  if (!result || typeof result !== 'object' || result === null) {
    return null
  }

  const sdkResult = result as { content?: string, is_error?: boolean }

  if (sdkResult.content === undefined) {
    return null
  }

  const content = sdkResult.content
  const isError = sdkResult.is_error === true

  if (isError) {
    return { status: 'error', brief: 'Error reading file', full: content }
  }

  const lines = content.split('\n')
  const lineCount = content === '' ? 0 : lines.length
  const brief = `${lineCount} line${lineCount !== 1 ? 's' : ''} loaded`

  return { status: 'success', brief, full: content }
}

export const ReadToolDisplay = memo(({ toolCall, hasResult, result }: ReadToolDisplayProps) => {
  const [showFullResult, setShowFullResult] = useState(false)

  // Only show for Read tools with results (allow empty string)
  if (toolCall.name !== 'Read' || !hasResult || result == null) {
    return null
  }

  const formattedResult = formatReadResult(result)

  if (!formattedResult) {
    return null
  }

  return (
    <div className="py-2">
      <div className={clsx(
        'flex items-center gap-2',
        typography.font.mono,
        typography.size.xs
      )}>
        {formattedResult.full && formattedResult.full.length > 100 && (
          <button
            onClick={() => setShowFullResult(!showFullResult)}
            className={clsx(
              'flex items-center justify-center',
              'w-5 h-5',
              'border border-zinc-700',
              'bg-zinc-800/50',
              'hover:bg-zinc-700/50',
              'rounded',
              transition.fast
            )}
            aria-label={showFullResult ? 'Collapse' : 'Expand'}
          >
            <RiArrowDownSLine className={clsx(
              'w-3 h-3',
              colors.text.tertiary,
              transition.fast,
              showFullResult && 'rotate-180'
            )} />
          </button>
        )}
        <span className={clsx(
          formattedResult.status === 'error' ? colors.accent.red.text : colors.text.tertiary
        )}>
          {formattedResult.brief}
        </span>
      </div>

      {/* Expanded result view */}
      {showFullResult && formattedResult.full && (
        <div className="mt-2">
          <CodeBlock
            code={formattedResult.full}
            language="text"
            showLineNumbers={false}
            className="text-xs"
          />
        </div>
      )}
    </div>
  )
})

ReadToolDisplay.displayName = 'ReadToolDisplay'