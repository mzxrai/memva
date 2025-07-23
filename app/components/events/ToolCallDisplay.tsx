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
import { WebSearchToolDisplay } from './tools/WebSearchToolDisplay'
import { TaskToolDisplay } from './tools/TaskToolDisplay'
import { ExitPlanModeDisplay } from './tools/ExitPlanModeDisplay'
import CompactInlinePermission from '../permissions/CompactInlinePermission'
import type { ToolUseContent } from '../../types/events'
import type { PermissionRequest } from '../../db/schema'
import clsx from 'clsx'

interface ToolCallDisplayProps {
  toolCall: ToolUseContent
  hasResult?: boolean
  result?: unknown
  permission?: PermissionRequest
  onApprovePermission?: (id: string) => void
  onDenyPermission?: (id: string) => void
  onApprovePermissionWithSettings?: (id: string, permissionMode: 'default' | 'acceptEdits') => void
  isProcessingPermission?: boolean
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
  exit_plan_mode: RiFileTextLine,
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
    exit_plan_mode: 'Proposed Plan',
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
    case 'Task':
      return (params.description as string) || ''
    case 'exit_plan_mode':
      return '' // Don't show the markdown content in the header
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
  
  // Handle tool_result structure from Claude Code SDK
  if (typeof result === 'object' && result !== null) {
    const toolResult = result as { type?: string, tool_use_id?: string, content?: unknown, is_error?: boolean }
    
    // Check if this is a tool_result structure
    if (toolResult.type === 'tool_result') {
      // For tool_result structure, content contains the actual result and is_error is at top level
      const isError = toolResult.is_error === true
      const content = toolResult.content
      
      if (isError) {
        // Display the actual error content
        const errorContent = typeof content === 'string' ? content : JSON.stringify(content)
        const lines = errorContent.trim().split('\n')
        if (lines.length > 3) {
          return { status: 'error', brief: `${lines.slice(0, 3).join('\n')}\n(+${lines.length - 3} more lines)`, full: errorContent }
        }
        return { status: 'error', brief: errorContent.substring(0, 500) + (errorContent.length > 500 ? '...' : ''), full: errorContent.length > 500 ? errorContent : undefined }
      } else {
        // Handle successful tool_result content
        if (typeof content === 'string') {
          const lines = content.trim().split('\n')
          if (lines.length > 3) {
            return { status: 'success', brief: `${lines.length} lines`, full: content }
          }
          return { status: 'success', brief: content.substring(0, 300) + (content.length > 300 ? '...' : ''), full: content }
        }
        return { status: 'success', brief: JSON.stringify(content).substring(0, 300) + '...', full: JSON.stringify(content, null, 2) }
      }
    }
    
    // Handle standardized SDK result format { content: string, is_error: boolean }
    const sdkResult = result as { content?: string, is_error?: boolean, success?: boolean }
    if ('is_error' in sdkResult || 'content' in sdkResult) {
      const isError = sdkResult.is_error === true
      const content = sdkResult.content || ''
      
      if (isError) {
        // Display the actual error content
        const lines = content.trim().split('\n')
        if (lines.length > 3) {
          return { status: 'error', brief: `${lines.slice(0, 3).join('\n')}\n(+${lines.length - 3} more lines)`, full: content }
        }
        return { status: 'error', brief: content.substring(0, 500) + (content.length > 500 ? '...' : ''), full: content.length > 500 ? content : undefined }
      }
    }
    
    // Handle Write/Edit tool results
    if ((toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit') && 
        'success' in sdkResult && sdkResult.success) {
      return { status: 'success', brief: 'Updated' }
    }
    
    // Handle legacy error format
    const errorResult = result as { error?: string }
    if (errorResult.error) {
      return { status: 'error', brief: errorResult.error, full: errorResult.error.length > 300 ? errorResult.error : undefined }
    }
  }
  
  // Default formatting for string results
  if (typeof result === 'string') {
    const lines = result.trim().split('\n')
    if (lines.length > 3) {
      return { status: 'success', brief: `${lines.length} lines`, full: result }
    }
    return { status: 'success', brief: result.substring(0, 300) + (result.length > 300 ? '...' : ''), full: result }
  }
  
  return { status: 'success', brief: JSON.stringify(result).substring(0, 300) + '...', full: JSON.stringify(result, null, 2) }
}

// Tools that have custom display components
const TOOLS_WITH_CUSTOM_DISPLAY = new Set([
  'Write',
  'Bash',
  'Read',
  'TodoWrite',
  'WebSearch',
  'Edit',
  'MultiEdit',
  'Task',
  'exit_plan_mode'
])

export const ToolCallDisplay = memo(({ 
  toolCall, 
  hasResult = false, 
  result, 
  permission, 
  onApprovePermission, 
  onDenyPermission, 
  onApprovePermissionWithSettings,
  isProcessingPermission = false,
  className, 
  isStreaming = false, 
  isError = false 
}: ToolCallDisplayProps) => {
  const [showFullResult, setShowFullResult] = useState(false)
  const isEditTool = toolCall.name === 'Edit' || toolCall.name === 'MultiEdit'
  const hasCustomDisplay = TOOLS_WITH_CUSTOM_DISPLAY.has(toolCall.name)
  
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
    // Handle SDK result format
    let resultContent: string | null = null
    if (result && typeof result === 'object' && result !== null && 'content' in result) {
      const sdkResult = result as { content?: string }
      resultContent = typeof sdkResult.content === 'string' ? sdkResult.content : null
    } else if (typeof result === 'string') {
      resultContent = result
    }
    
    if (!resultContent) {
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
          const contentLines = resultContent.split('\n')
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
            
            const lineMatch = resultContent.match(new RegExp(`(\\d+)→\\s*${escapedLine}`, 'm'))
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
    const lineNumberMatch = resultContent.match(/(\d+)→/)
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
      <div
        className={clsx(
          'w-full flex items-center gap-3',
          'py-1'
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
            'truncate flex-1 min-w-0'
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
      </div>
      
      {/* Inline permission request */}
      {permission && onApprovePermission && onDenyPermission && (
        <div className="mt-2 mb-2">
          <CompactInlinePermission
            request={permission}
            onApprove={onApprovePermission}
            onDeny={onDenyPermission}
            onApproveWithSettings={onApprovePermissionWithSettings}
            isProcessing={isProcessingPermission}
            isExitPlanMode={toolCall.name === 'exit_plan_mode'}
          />
        </div>
      )}
      
      {/* Result section - minimal inline display */}
      {formattedResult && !hasCustomDisplay && (
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
      {toolCall.name === 'Write' && (
        <WriteToolDisplay 
          toolCall={toolCall}
          hasResult={hasResult}
          result={result}
          isStreaming={isStreaming}
          isError={isError}
        />
      )}
      
      {/* Bash tool result section */}
      {toolCall.name === 'Bash' && (
        <BashToolDisplay 
          toolCall={toolCall}
          hasResult={hasResult}
          result={result}
        />
      )}
      
      {/* Read tool result section */}
      {toolCall.name === 'Read' && (
        <ReadToolDisplay 
          toolCall={toolCall}
          hasResult={hasResult}
          result={result}
        />
      )}
      
      {/* TodoWrite tool result section */}
      {toolCall.name === 'TodoWrite' && (
        <TodoWriteToolDisplay 
          toolCall={toolCall}
          hasResult={hasResult}
          result={result}
        />
      )}
      
      {/* WebSearch tool result section */}
      {toolCall.name === 'WebSearch' && (
        <WebSearchToolDisplay 
          toolCall={toolCall}
          hasResult={hasResult}
          result={result}
        />
      )}
      
      {/* Edit/MultiEdit tool result section */}
      {(toolCall.name === 'Edit' || toolCall.name === 'MultiEdit') && (
        <EditToolDisplay 
          toolCall={toolCall}
          hasResult={hasResult}
          result={result}
          lineInfo={lineInfo}
        />
      )}
      
      {/* Task tool result section */}
      {toolCall.name === 'Task' && (
        <TaskToolDisplay 
          toolCall={toolCall}
          hasResult={hasResult}
          result={result}
        />
      )}
      
      {/* Exit plan mode display */}
      {toolCall.name === 'exit_plan_mode' && (
        <ExitPlanModeDisplay 
          toolCall={toolCall}
          hasResult={hasResult}
          result={result}
        />
      )}
    </div>
  )
})

ToolCallDisplay.displayName = 'ToolCallDisplay'