import { useState, useEffect, memo } from 'react'
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
import { DiffViewer } from './DiffViewer'
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

/**
 * Reconstructs the original and final file content from MultiEdit operations
 * to create a unified diff with proper line numbers
 */
function reconstructFileFromMultiEdit(edits: Array<{ old_string: string; new_string: string }>): { 
  originalContent: string; 
  finalContent: string 
} {
  if (edits.length === 0) {
    return { originalContent: '', finalContent: '' }
  }

  if (edits.length === 1) {
    // Single edit case
    return {
      originalContent: edits[0].old_string,
      finalContent: edits[0].new_string
    }
  }

  // For multiple edits, create a simple but effective reconstruction
  // Since MultiEdit edits are typically applied to different parts of the same file,
  // we'll concatenate them with clear separators to show the context
  
  const originalParts = edits.map((edit, index) => {
    // Add a comment to show which edit this is
    const marker = `// Edit ${index + 1}/${edits.length}`
    return `${marker}\n${edit.old_string}`
  })
  
  const finalParts = edits.map((edit, index) => {
    // Add the same comment structure
    const marker = `// Edit ${index + 1}/${edits.length}`
    return `${marker}\n${edit.new_string}`
  })
  
  return {
    originalContent: originalParts.join('\n\n'),
    finalContent: finalParts.join('\n\n')
  }
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
  // Auto-expand Edit/MultiEdit tools to show diff by default
  const isEditTool = toolCall.name === 'Edit' || toolCall.name === 'MultiEdit'
  const [isExpanded, setIsExpanded] = useState(isEditTool)
  const [showFullResult, setShowFullResult] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(!isEditTool)
  
  // Trigger animation after mount for Edit tools
  useEffect(() => {
    if (isEditTool && !hasAnimated) {
      // Small delay to allow initial render, then trigger animation
      const timer = setTimeout(() => setHasAnimated(true), 50)
      return () => clearTimeout(timer)
    }
  }, [isEditTool, hasAnimated])
  
  const Icon = toolIcons[toolCall.name] || RiToolsLine
  const primaryParam = getPrimaryParam(toolCall.name, toolCall.input)
  const formattedResult = result ? formatResult(toolCall.name, result) : null
  
  // Check if this is an Edit tool with diff data
  const isEditWithDiff = isEditTool && 
    toolCall.input && 
    typeof toolCall.input === 'object' && (
      // Single Edit tool format
      ('old_string' in toolCall.input && 
       'new_string' in toolCall.input &&
       typeof toolCall.input.old_string === 'string' &&
       typeof toolCall.input.new_string === 'string') ||
      // MultiEdit tool format  
      ('edits' in toolCall.input &&
       Array.isArray(toolCall.input.edits) &&
       toolCall.input.edits.length > 0 &&
       toolCall.input.edits.every(edit => 
         typeof edit === 'object' &&
         edit !== null &&
         'old_string' in edit &&
         'new_string' in edit &&
         typeof edit.old_string === 'string' &&
         typeof edit.new_string === 'string'
       ))
    )
  
  return (
    <div
      className={clsx(
        'group',
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
          'py-1',
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
      
      {/* Parameters (collapsible) - show diff for Edit tools */}
      <div 
        className={clsx(
          'overflow-hidden',
          isEditTool && 'transition-all duration-300 ease-in-out',
          isExpanded ? (
            isEditTool ? (
              hasAnimated ? 'max-h-[2000px] opacity-100' : 'max-h-[2000px] opacity-0'
            ) : 'max-h-[2000px] opacity-100'
          ) : 'max-h-0 opacity-0'
        )}
      >
        <div className="py-2">
          {isEditWithDiff ? (
            (() => {
              const input = toolCall.input as Record<string, unknown>
              
              // Handle single Edit tool
              if ('old_string' in input && 'new_string' in input) {
                return (
                  <DiffViewer
                    oldString={input.old_string as string}
                    newString={input.new_string as string}
                    fileName={input.file_path as string}
                  />
                )
              }
              
              // Handle MultiEdit tool - reconstruct full file diff
              if ('edits' in input && Array.isArray(input.edits)) {
                const edits = input.edits as Array<{ old_string: string; new_string: string }>
                const { originalContent, finalContent } = reconstructFileFromMultiEdit(edits)
                
                return (
                  <div>
                    <div className="text-xs text-zinc-400 mb-2 font-mono">
                      {edits.length} edit{edits.length !== 1 ? 's' : ''} applied
                    </div>
                    <DiffViewer
                      oldString={originalContent}
                      newString={finalContent}
                      fileName={input.file_path as string}
                    />
                  </div>
                )
              }
              
              return null
            })()
          ) : (
            <CodeBlock
              code={JSON.stringify(toolCall.input, null, 2)}
              language="json"
              showLineNumbers={false}
              className="text-xs"
            />
          )}
        </div>
      </div>
      
      {/* Result section - minimal inline display */}
      {formattedResult && (
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