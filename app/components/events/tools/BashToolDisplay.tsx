import { useState, memo } from 'react'
import { RiArrowDownSLine } from 'react-icons/ri'
import stripAnsi from 'strip-ansi'
import { colors, typography, transition } from '../../../constants/design'
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
  
  // Strip ANSI escape codes from the content
  const content = stripAnsi(sdkResult.content.trim())
  const isError = sdkResult.is_error === true
  
  if (isError) {
    // Show actual error content in the brief, with same formatting logic as success
    if (!content) {
      return { status: 'error', brief: '✗ Error' }
    }
    
    const errorLines = content.split('\n').filter(line => line.trim())
    
    if (errorLines.length === 0) {
      return { status: 'error', brief: '✗ Error' }
    } else if (errorLines.length === 1 && errorLines[0].length > 100) {
      // Handle long single line errors
      const line = errorLines[0]
      const brief = line.substring(0, 100) + '…\n(show full output)'
      return { status: 'error', brief, full: content }
    } else if (errorLines.length <= 3) {
      // Show all lines if 3 or fewer
      return { status: 'error', brief: errorLines.join('\n') }
    } else {
      // Show first 3 lines with more indicator
      const preview = errorLines.slice(0, 3).join('\n')
      return { status: 'error', brief: `${preview}\n(+${errorLines.length - 3} more lines)`, full: content }
    }
  }
  
  if (!content) {
    return { status: 'success', brief: 'Done' }
  }
  
  const lines = content.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    return { status: 'success', brief: 'Done' }
  } else if (lines.length === 1 && lines[0].length > 100) {
    // Handle long single lines
    const line = lines[0]
    const brief = line.substring(0, 100) + '…\n(show full output)'
    return { status: 'success', brief, full: content }
  } else if (lines.length <= 3) {
    // Show all lines if 3 or fewer
    const brief = lines.join('\n')
    return { status: 'success', brief, full: lines.length > 1 ? content : undefined }
  } else {
    // Show first 3 lines with more indicator
    const preview = lines.slice(0, 3).join('\n')
    const brief = `${preview}\n(+${lines.length - 3} more lines)`
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
  
  const hasExpandableContent = formattedResult.full && (formattedResult.brief.includes('more lines') || formattedResult.brief.includes('show full output'))
  
  // Split the brief into lines and expand indicator
  const briefLines = formattedResult.brief.split('\n')
  const expandIndicator = briefLines.find(line => line.includes('more lines') || line.includes('show full output'))
  const contentLines = briefLines.filter(line => !line.includes('more lines') && !line.includes('show full output'))
  
  return (
    <div className="py-2">
      <div className={clsx(
        typography.font.mono,
        typography.size.sm
      )}>
        {showFullResult && formattedResult.full ? (
          // Show full content with collapse option
          <div>
            <pre className={clsx(
              'whitespace-pre-wrap leading-relaxed',
              formattedResult.status === 'error' ? colors.accent.red.text : colors.text.tertiary
            )}>
              {formattedResult.full}
            </pre>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setShowFullResult(false)}
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
                aria-label="Collapse"
              >
                <RiArrowDownSLine className={clsx(
                  'w-3 h-3',
                  colors.text.tertiary,
                  transition.fast,
                  'rotate-180'
                )} />
              </button>
              <span className={clsx(
                typography.size.sm,
                colors.text.tertiary
              )}>
                Show less
              </span>
            </div>
          </div>
        ) : (
          // Show preview with inline expand option
          <div>
            <pre className={clsx(
              'whitespace-pre-wrap leading-relaxed',
              formattedResult.status === 'error' ? colors.accent.red.text : colors.text.tertiary
            )}>
              {contentLines.join('\n')}
              {hasExpandableContent && (
                <>
                  {'\n'}
                  <span className="inline-flex items-center gap-2">
                    <span>{expandIndicator}</span>
                    <button
                      onClick={() => setShowFullResult(true)}
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
                      aria-label="Expand"
                    >
                      <RiArrowDownSLine className={clsx(
                        'w-3 h-3',
                        colors.text.tertiary,
                        transition.fast
                      )} />
                    </button>
                  </span>
                </>
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
})

BashToolDisplay.displayName = 'BashToolDisplay'