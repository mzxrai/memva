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

// Format Bash command result based on result structure
const formatBashResult = (result: unknown): { status: 'success' | 'error', brief: string, full?: string } | null => {
  if (!result || typeof result !== 'object' || result === null) {
    return null
  }
  
  const bashResult = result as { stdout?: string, stderr?: string, interrupted?: boolean }
  
  if (bashResult.interrupted) {
    return { status: 'error', brief: '✗ Interrupted', full: bashResult.stdout || bashResult.stderr }
  }
  
  if (bashResult.stderr && bashResult.stderr.trim()) {
    return { status: 'error', brief: '✗ Error', full: bashResult.stderr }
  }
  
  if (bashResult.stdout) {
    const lines = bashResult.stdout.trim().split('\n')
    const firstLine = lines[0] || ''
    let brief: string
    
    if (lines.length > 1) {
      const preview = firstLine.length > 150 ? firstLine.substring(0, 150) + '…' : firstLine
      brief = `${preview} (+${lines.length - 1} more)`
    } else {
      brief = firstLine.substring(0, 200) + (firstLine.length > 200 ? '…' : '')
    }
    
    return { status: 'success', brief, full: bashResult.stdout }
  }
  
  return { status: 'success', brief: 'Done' }
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
            language="bash"
            showLineNumbers={false}
            className="text-xs"
          />
        </div>
      )}
    </div>
  )
})

BashToolDisplay.displayName = 'BashToolDisplay'