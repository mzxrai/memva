import { useState, memo, useMemo } from 'react'
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
  RiFileCopyLine,
  RiDeleteBinLine,
  RiAddLine,
} from 'react-icons/ri'
import { colors, typography, radius, transition, iconSize } from '../../constants/design'
import { CodeBlock } from './CodeBlock'
import { WriteToolDisplay } from './tools/WriteToolDisplay'
import { EditToolDisplay } from './tools/EditToolDisplay'
import { BashToolDisplay } from './tools/BashToolDisplay'
import { ReadToolDisplay } from './tools/ReadToolDisplay'
import { TodoWriteToolDisplay } from './tools/TodoWriteToolDisplay'
import type { ToolUseContent } from '../../types/events'
import clsx from 'clsx'

interface ToolCallDisplayProps {
  toolCall: ToolUseContent
  hasResult?: boolean
  result?: unknown
  className?: string
  isStreaming?: boolean
  isError?: boolean
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

// Get display name for tool
const getToolDisplayName = (toolName: string): string => {
  const displayNames: Record<string, string> = {
    TodoWrite: 'Update Todos',
  }
  return displayNames[toolName] || toolName
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
    return { status: 'success', brief: result.substring(0, 150) + (result.length > 150 ? '...' : ''), full: result }
  }
  
  return { status: 'success', brief: JSON.stringify(result).substring(0, 150) + '...', full: JSON.stringify(result, null, 2) }
}

export const ToolCallDisplay = memo(({ toolCall, hasResult = false, result, className, isStreaming = false, isError = false }: ToolCallDisplayProps) => {
  // Auto-expand Edit/MultiEdit tools to show diff by default, but NOT during streaming
  const isEditTool = toolCall.name === 'Edit' || toolCall.name === 'MultiEdit'
  // Synchronously expand edit tools when they have results
  const [isExpanded, setIsExpanded] = useState((isEditTool && !isStreaming) || (isEditTool && hasResult))
  const [showFullResult, setShowFullResult] = useState(false)
  
  // Check if this is an interrupted bash command
  const isInterrupted = toolCall.name === 'Bash' && 
    result && 
    typeof result === 'object' && 
    result !== null &&
    'interrupted' in result &&
    (result as { interrupted?: boolean }).interrupted === true
  
  
  // Removed useEffect that caused delayed expansion - now handled synchronously in initial state
  
  const Icon = toolIcons[toolCall.name] || RiToolsLine
  const primaryParam = getPrimaryParam(toolCall.name, toolCall.input)
  const formattedResult = result ? formatResult(toolCall.name, result) : null
  
  // Extract line number information from tool result if available (memoized)
  const lineInfo = useMemo(() => {
    if (!result || typeof result !== 'string') {
      return null
    }
    
    // For Edit tools, intelligently find the line number by matching the actual edit content
    if (isEditTool && toolCall.input && typeof toolCall.input === 'object') {
      try {
        let firstMeaningfulLine: string | null = null
        
        if (toolCall.name === 'Edit') {
          // For single Edit, get first non-empty line from new_string or old_string
          const input = toolCall.input as { new_string?: string; old_string?: string }
          const editContent = input.new_string || input.old_string || ''
          const lines = editContent.split('\n')
          firstMeaningfulLine = lines.find(line => line.trim().length > 0) || null
        } else if (toolCall.name === 'MultiEdit') {
          // For MultiEdit, use the first edit's content
          const input = toolCall.input as { edits?: Array<{ new_string?: string; old_string?: string }> }
          if (Array.isArray(input.edits) && input.edits.length > 0) {
            const firstEdit = input.edits[0]
            const editContent = firstEdit.new_string || firstEdit.old_string || ''
            const lines = editContent.split('\n')
            firstMeaningfulLine = lines.find(line => line.trim().length > 0) || null
          }
        }
        
        if (firstMeaningfulLine) {
          // More robust approach: normalize whitespace and try to find the line
          // This handles tabs vs spaces, trailing whitespace, etc.
          const normalizedSearchLine = firstMeaningfulLine.trim()
          
          // Split content into lines and search for matching line
          const contentLines = result.split('\n')
          for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i]
            const lineNumberMatch = line.match(/^(\d+)→(.*)$/)
            if (lineNumberMatch) {
              const lineNumber = parseInt(lineNumberMatch[1], 10)
              const lineContent = lineNumberMatch[2].trim()
              
              // Compare normalized content
              if (lineContent === normalizedSearchLine) {
                return {
                  startLine: lineNumber,
                  showLineNumbers: true
                }
              }
            }
          }
          
          // Try a more flexible regex approach as fallback
          try {
            // Escape special regex characters and allow flexible whitespace
            const escapedLine = firstMeaningfulLine
              .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              .replace(/\s+/g, '\\s+') // Allow flexible whitespace
            
            const lineMatch = result.match(new RegExp(`(\\d+)→\\s*${escapedLine}`, 'm'))
            if (lineMatch) {
              const startLine = parseInt(lineMatch[1], 10)
              return {
                startLine,
                showLineNumbers: true
              }
            }
          } catch {
            // Regex fallback failed, continue to next fallback
          }
        }
      } catch {
        // Error extracting line number, continue to fallback
      }
    }
    
    // Fallback: just find the first line number in the content
    const lineNumberMatch = result.match(/(\d+)→/)
    if (lineNumberMatch) {
      const startLine = parseInt(lineNumberMatch[1], 10)
      return {
        startLine,
        showLineNumbers: true
      }
    }
    
    return null
  }, [result, isEditTool, toolCall])
  
  
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
          typography.size.base,
          typography.weight.medium,
          colors.text.primary
        )}>
          {getToolDisplayName(toolCall.name)}
        </span>
        
        {/* Status indicator - shows right after tool name */}
        <div 
          data-testid="tool-status-indicator"
          data-status={hasResult ? (isInterrupted ? 'interrupted' : (isError ? 'error' : 'success')) : 'pending'}
          className={clsx(
            'w-2 h-2 rounded-full',
            hasResult ? (
              isInterrupted ? 'bg-amber-400' : (isError ? 'bg-red-400' : 'bg-emerald-400')
            ) : 'bg-zinc-600 animate-pulse'
          )} />
        
        {/* Primary parameter preview */}
        {primaryParam && (
          <span className={clsx(
            typography.font.mono,
            typography.size.sm,
            colors.text.secondary,
            'truncate max-w-3xl'
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
        
        {/* Spacer to push expand icon to the right */}
        <div className="flex-1" />
        
        {/* Expand/collapse icon - only show if no result */}
        {!formattedResult && (
          <div>
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
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="py-2">
          <EditToolDisplay
            toolCall={toolCall}
            hasResult={hasResult}
            result={result}
            lineInfo={lineInfo}
          />
          
          {!isEditTool && (
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
      {formattedResult && toolCall.name !== 'Write' && toolCall.name !== 'Bash' && toolCall.name !== 'Read' && toolCall.name !== 'TodoWrite' && (
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
      
      {/* Write tool file preview section */}
      <WriteToolDisplay 
        toolCall={toolCall}
        hasResult={hasResult}
        result={result}
        isStreaming={isStreaming}
        isError={isError}
      />
      
      {/* Bash tool result section */}
      <BashToolDisplay 
        toolCall={toolCall}
        hasResult={hasResult}
        result={result}
      />
      
      {/* Read tool result section */}
      <ReadToolDisplay 
        toolCall={toolCall}
        hasResult={hasResult}
        result={result}
      />
      
      {/* TodoWrite tool result section */}
      <TodoWriteToolDisplay 
        toolCall={toolCall}
        hasResult={hasResult}
        result={result}
      />
    </div>
  )
})

ToolCallDisplay.displayName = 'ToolCallDisplay'