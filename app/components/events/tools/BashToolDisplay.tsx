import { useState, memo } from 'react'
import { RiArrowDownSLine } from 'react-icons/ri'
import { colors, typography, transition } from '../../../constants/design'
import { CodeBlock } from '../CodeBlock'
import type { ToolUseContent } from '../../../types/events'
import clsx from 'clsx'

interface BashToolDisplayProps {
  toolCall: ToolUseContent
  hasResult: boolean
  result?: unknown
}

// Format Bash command result - handles only Claude Code SDK format
const formatBashResult = (result: unknown): { status: 'success' | 'error', brief: string, full?: string } | null => {
  if (!result || typeof result !== 'object' || result === null) {
    return null
  }
  
  const sdkResult = result as { content?: string, is_error?: boolean }
  
  if (sdkResult.content === undefined) {
    return null
  }
  
  const content = sdkResult.content.trim()
  const isError = sdkResult.is_error === true
  
  if (isError) {
    return { status: 'error', brief: '✗ Error', full: content }
  }
  
  if (!content) {
    return { status: 'success', brief: 'Done' }
  }
  
  const lines = content.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    return { status: 'success', brief: 'Done' }
  } else if (lines.length === 1) {
    const line = lines[0]
    const brief = line.length > 200 ? line.substring(0, 200) + '…' : line
    return { status: 'success', brief, full: content }
  } else {
    // For multi-line output, show the first non-empty line
    const firstNonEmptyLine = lines.find(line => line.trim()) || lines[0]
    const preview = firstNonEmptyLine.length > 80 ? firstNonEmptyLine.substring(0, 80) + '…' : firstNonEmptyLine
    const brief = `${preview} (+${lines.length - 1} more lines)`
    return { status: 'success', brief, full: content }
  }
}

export const BashToolDisplay = memo(({ toolCall, hasResult, result }: BashToolDisplayProps) => {
  const [showFullResult, setShowFullResult] = useState(false)
  
  // Only show for Bash tools with results
  if (toolCall.name !== 'Bash' || !hasResult || !result) {
    return null
  }
  
  const formattedResult = formatBashResult(result)
  
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
        {formattedResult.full && (formattedResult.full.length > 100 || formattedResult.brief.includes('more lines')) && (
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

BashToolDisplay.displayName = 'BashToolDisplay'