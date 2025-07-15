import { useState, memo } from 'react'
import type { ComponentType } from 'react'
import {
  RiFileTextLine,
  RiEditLine,
  RiTerminalLine,
  RiTaskLine,
  RiGlobalLine,
  RiSearchLine,
  RiToolsLine,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiCheckLine,
  RiFileCopyLine,
  RiDeleteBinLine,
  RiAddLine,
} from 'react-icons/ri'
import { colors, typography, radius, transition, iconSize } from '../../constants/design'
import { CodeBlock } from './CodeBlock'
import type { ToolUseContent } from '../../types/events'
import clsx from 'clsx'

interface ToolCallDisplayProps {
  toolCall: ToolUseContent
  hasResult?: boolean
  result?: unknown
  className?: string
}

// Map tool names to appropriate icons
const toolIcons: Record<string, ComponentType<{ className?: string; 'data-testid'?: string }>> = {
  Read: RiFileTextLine,
  Write: RiFileCopyLine,
  Edit: RiEditLine,
  MultiEdit: RiEditLine,
  Delete: RiDeleteBinLine,
  Create: RiAddLine,
  Bash: RiTerminalLine,
  Task: RiTaskLine,
  WebFetch: RiGlobalLine,
  WebSearch: RiGlobalLine,
  Grep: RiSearchLine,
  Glob: RiSearchLine,
  TodoWrite: RiTaskLine,
}

// Get icon test ID based on tool name
const getIconTestId = (toolName: string): string => {
  const iconMap: Record<string, string> = {
    Read: 'read-icon',
    Write: 'write-icon',
    Edit: 'edit-icon',
    MultiEdit: 'edit-icon',
    Bash: 'bash-icon',
    Task: 'task-icon',
    WebFetch: 'web-icon',
    WebSearch: 'web-icon',
    Grep: 'search-icon',
    Glob: 'search-icon',
  }
  return iconMap[toolName] || 'tools-icon'
}

// Get primary parameter to show in the header
const getPrimaryParam = (toolName: string, input: unknown): string => {
  if (!input || typeof input !== 'object') return ''
  
  const params = input as Record<string, unknown>
  
  switch (toolName) {
    case 'Read':
    case 'Write':
      return (params.file_path as string) || ''
    case 'Edit':
    case 'MultiEdit':
      return (params.file_path as string) || ''
    case 'Bash':
      return (params.command as string) || ''
    case 'Grep':
    case 'Glob':
      return (params.pattern as string) || ''
    case 'LS':
      return (params.path as string) || '.'
    case 'WebFetch':
    case 'WebSearch':
      return (params.url as string) || (params.query as string) || ''
    default: {
      // Return first string value found
      const firstValue = Object.values(params).find(v => typeof v === 'string')
      return (firstValue as string) || ''
    }
  }
}

// Format result based on tool type and result structure
const formatResult = (toolName: string, result: unknown): { status: 'success' | 'error', brief: string, full?: string } => {
  if (!result) return { status: 'success', brief: 'No result' }
  
  // Handle Bash command results
  if (toolName === 'Bash' && typeof result === 'object' && result !== null) {
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
        const preview = firstLine.length > 50 ? firstLine.substring(0, 50) + '…' : firstLine
        brief = `${preview} (+${lines.length - 1} more)`
      } else {
        brief = firstLine.substring(0, 80) + (firstLine.length > 80 ? '…' : '')
      }
      return { status: 'success', brief, full: bashResult.stdout }
    }
    return { status: 'success', brief: 'Done' }
  }
  
  // Handle Read tool results
  if (toolName === 'Read' && typeof result === 'string') {
    const lines = result.trim().split('\n')
    const lineCount = lines.length
    const brief = `${lineCount} line${lineCount !== 1 ? 's' : ''} loaded`
    return { status: 'success', brief, full: result }
  }
  
  // Handle Write/Edit tool results
  if ((toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit') && 
      typeof result === 'object' && result !== null) {
    const writeResult = result as { success?: boolean }
    if (writeResult.success) {
      return { status: 'success', brief: 'Updated' }
    }
  }
  
  // Handle error results
  if (typeof result === 'object' && result !== null) {
    const errorResult = result as { error?: string, is_error?: boolean }
    if (errorResult.error || errorResult.is_error) {
      return { status: 'error', brief: errorResult.error || 'Error occurred' }
    }
  }
  
  // Default formatting
  if (typeof result === 'string') {
    const lines = result.trim().split('\n')
    if (lines.length > 3) {
      return { status: 'success', brief: `${lines.length} lines`, full: result }
    }
    return { status: 'success', brief: result.substring(0, 50) + (result.length > 50 ? '...' : ''), full: result }
  }
  
  return { status: 'success', brief: JSON.stringify(result).substring(0, 50) + '...', full: JSON.stringify(result, null, 2) }
}

export const ToolCallDisplay = memo(({ toolCall, hasResult = false, result, className }: ToolCallDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showFullResult, setShowFullResult] = useState(false)
  
  const Icon = toolIcons[toolCall.name] || RiToolsLine
  const primaryParam = getPrimaryParam(toolCall.name, toolCall.input)
  const formattedResult = result ? formatResult(toolCall.name, result) : null
  
  return (
    <div
      className={clsx(
        'group',
        colors.background.secondary,
        colors.border.subtle,
        'border',
        radius.lg,
        'overflow-hidden',
        transition.normal,
        className
      )}
    >
      {/* Tool header */}
      <button
        onClick={() => !formattedResult && setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? 'hide parameters' : 'show parameters'}
        className={clsx(
          'w-full flex items-center gap-3',
          formattedResult ? 'px-3 py-2' : 'p-3',
          !formattedResult && colors.background.hover,
          transition.fast,
          formattedResult ? 'cursor-default' : 'cursor-pointer'
        )}
      >
        {/* Tool icon */}
        <Icon 
          className={clsx(iconSize.md, colors.text.secondary)}
          data-testid={getIconTestId(toolCall.name)}
        />
        
        {/* Tool name */}
        <span className={clsx(
          typography.font.mono,
          typography.size.sm,
          typography.weight.medium,
          colors.text.primary
        )}>
          {toolCall.name}
        </span>
        
        {/* Primary parameter preview */}
        {primaryParam && (
          <span className={clsx(
            typography.font.mono,
            typography.size.sm,
            colors.text.secondary,
            'truncate max-w-md'
          )}>
            {primaryParam}
          </span>
        )}
        
        {/* Tool ID badge - hidden, for testing only */}
        <span className={clsx(
          'px-2 py-0.5',
          colors.background.tertiary,
          colors.border.subtle,
          'border',
          radius.sm,
          typography.font.mono,
          typography.size.xs,
          colors.text.tertiary,
          'select-none',
          'hidden' // Hide the ID
        )}>
          {toolCall.id}
        </span>
        
        {/* Result indicator */}
        {hasResult && (
          <div
            data-testid="has-result-indicator"
            className={clsx(
              'p-1',
              colors.accent.green.bg,
              colors.accent.green.border,
              'border',
              radius.full,
              'ml-auto'
            )}
          >
            <RiCheckLine className={clsx(iconSize.xs, colors.accent.green.text)} />
          </div>
        )}
        
        {/* Expand/collapse icon - only show if no result */}
        {!formattedResult && (
          <div className="ml-auto">
            {isExpanded ? (
              <RiArrowDownSLine className={clsx(iconSize.md, colors.text.tertiary)} />
            ) : (
              <RiArrowRightSLine className={clsx(iconSize.md, colors.text.tertiary)} />
            )}
          </div>
        )}
      </button>
      
      {/* Parameters (collapsible) */}
      {isExpanded && (
        <div className={clsx(
          'border-t',
          colors.border.subtle,
          'p-3'
        )}>
          <CodeBlock
            code={JSON.stringify(toolCall.input, null, 2)}
            language="json"
            showLineNumbers={false}
            className="text-xs"
          />
        </div>
      )}
      
      {/* Result section - minimal inline display */}
      {formattedResult && (
        <div className="px-3 pb-2">
          <div className={clsx(
            'flex items-center gap-2',
            typography.font.mono,
            typography.size.xs
          )}>
            <span className={clsx(
              formattedResult.status === 'error' ? colors.accent.red.text : colors.text.tertiary
            )}>
              {formattedResult.brief}
            </span>
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
          </div>
          
          {/* Expanded result view */}
          {showFullResult && formattedResult.full && (
            <div className="mt-2">
              <CodeBlock
                code={formattedResult.full}
                language={toolCall.name === 'Bash' ? 'bash' : 'text'}
                showLineNumbers={false}
                className="text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
})

ToolCallDisplay.displayName = 'ToolCallDisplay'