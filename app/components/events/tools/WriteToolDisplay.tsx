import { useState, memo } from 'react'
import { RiArrowDownSLine } from 'react-icons/ri'
import { colors, typography, radius, transition, spacing } from '../../../constants/design'
import type { ToolUseContent } from '../../../types/events'
import clsx from 'clsx'

interface WriteToolDisplayProps {
  toolCall: ToolUseContent
  hasResult: boolean
  result?: unknown
  isStreaming?: boolean
  isError?: boolean
}

// Get file information for Write events
const getWriteFileInfo = (toolCall: ToolUseContent): { content: string; fileName: string; lineCount: number; sizeEstimate: string } | null => {
  if (toolCall.name !== 'Write' || !toolCall.input || typeof toolCall.input !== 'object') return null
  
  const params = toolCall.input as Record<string, unknown>
  const content = params.content as string
  const filePath = params.file_path as string
  
  if (content === undefined || content === null || !filePath) return null
  
  const lines = content.split('\n')
  // Handle empty content - empty string results in [''] which is 1 line
  const lineCount = content === '' ? 1 : lines.length
  const sizeInBytes = new Blob([content]).size
  const sizeEstimate = sizeInBytes < 1024 
    ? `${sizeInBytes} B`
    : sizeInBytes < 1024 * 1024
    ? `${Math.round(sizeInBytes / 1024)} KB`
    : `${Math.round(sizeInBytes / (1024 * 1024))} MB`
  
  return {
    content,
    fileName: filePath.split('/').pop() || filePath,
    lineCount,
    sizeEstimate
  }
}

export const WriteToolDisplay = memo(({ toolCall, hasResult, result }: WriteToolDisplayProps) => {
  const [showWritePreview, setShowWritePreview] = useState(false)
  
  // Only show if this is a Write tool with successful result
  // Real Write tool results come as strings like "File created successfully at: /path/to/file"
  const isSuccessfulWrite = hasResult && 
    result && 
    (
      // Handle object format (for tests)
      (typeof result === 'object' && 'success' in result && (result as { success: boolean }).success) ||
      // Handle string format (for real usage)
      (typeof result === 'string' && result.includes('successfully'))
    )
    
  if (!isSuccessfulWrite) {
    return null
  }
  
  const writeFileInfo = getWriteFileInfo(toolCall)
  
  if (!writeFileInfo) {
    return null
  }
  
  return (
    <div className="py-2">
      <div className={clsx(
        'flex items-center gap-3 mb-2',
        typography.font.mono,
        typography.size.xs
      )}>
        <span className={colors.text.secondary}>
          {writeFileInfo.fileName}
        </span>
        
        <span className={colors.text.tertiary}>
          {writeFileInfo.lineCount} line{writeFileInfo.lineCount !== 1 ? 's' : ''}
        </span>
        
        <span className={colors.text.tertiary}>
          {writeFileInfo.sizeEstimate}
        </span>
      </div>
      
      {/* File preview - always show first ~10 lines in diff style */}
      <div className={clsx(
        colors.background.secondary,
        colors.border.subtle,
        'border',
        radius.lg,
        'overflow-hidden'
      )}>
        <div className={clsx(
          'overflow-x-auto',
          spacing.md
        )}>
          {(() => {
            const lines = writeFileInfo.content.split('\n')
            const previewLines = showWritePreview ? lines : lines.slice(0, 10)
            
            return (
              <div>
                {previewLines.map((line, index) => {
                  const lineNumber = index + 1
                  return (
                    <div
                      key={index}
                      className={clsx(
                        'code-line flex',
                        'bg-emerald-950/20 border-l-2 border-emerald-600'
                      )}
                    >
                      {/* Line number gutter */}
                      <div className={clsx(
                        'line-number select-none px-3 text-right',
                        typography.font.mono,
                        typography.size.xs,
                        colors.text.muted,
                        'w-12 flex-shrink-0'
                      )}>
                        {lineNumber}
                      </div>
                      
                      {/* + indicator */}
                      <div className={clsx(
                        'line-indicator select-none px-2',
                        typography.font.mono,
                        typography.size.sm,
                        'text-emerald-500'
                      )}>
                        +
                      </div>
                      
                      {/* Code content */}
                      <div className={clsx(
                        'flex-1 pr-12',
                        typography.font.mono,
                        typography.size.sm,
                        colors.text.primary,
                        'whitespace-pre',
                        'leading-relaxed'
                      )}>
                        {line || '\u00A0'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
        
        {/* Show more/less button at bottom */}
        {writeFileInfo.lineCount > 10 && (
          <div className={clsx(
            'border-t',
            colors.border.subtle,
            'px-4 py-2'
          )}>
            <button
              onClick={() => setShowWritePreview(!showWritePreview)}
              className={clsx(
                'flex items-center gap-1',
                'px-2 py-1',
                'border border-zinc-700',
                'bg-zinc-800/50',
                'hover:bg-zinc-700/50',
                'rounded',
                transition.fast,
                typography.font.mono,
                'text-2xs',
                colors.text.tertiary
              )}
              aria-label={showWritePreview ? 'Show less' : 'Show all'}
            >
              <RiArrowDownSLine className={clsx(
                'w-3 h-3',
                transition.fast,
                showWritePreview && 'rotate-180'
              )} />
              {showWritePreview ? 'Show less' : `Show all ${writeFileInfo.lineCount} lines`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

WriteToolDisplay.displayName = 'WriteToolDisplay'