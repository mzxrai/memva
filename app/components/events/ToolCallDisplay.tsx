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

export const ToolCallDisplay = memo(({ toolCall, hasResult = false, className }: ToolCallDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const Icon = toolIcons[toolCall.name] || RiToolsLine
  const primaryParam = getPrimaryParam(toolCall.name, toolCall.input)
  
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
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? 'hide parameters' : 'show parameters'}
        className={clsx(
          'w-full flex items-center gap-3 p-3',
          colors.background.hover,
          transition.fast,
          'cursor-pointer'
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
        
        {/* Expand/collapse icon */}
        {!hasResult && (
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
    </div>
  )
})

ToolCallDisplay.displayName = 'ToolCallDisplay'