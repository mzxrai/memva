import { useState, useEffect, memo, useMemo } from 'react'
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
import { DiffViewer } from './DiffViewer'
import { WriteToolDisplay } from './tools/WriteToolDisplay'
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
        const preview = firstLine.length > 150 ? firstLine.substring(0, 150) + '…' : firstLine
        brief = `${preview} (+${lines.length - 1} more)`
      } else {
        brief = firstLine.substring(0, 200) + (firstLine.length > 200 ? '…' : '')
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
    return { status: 'success', brief: result.substring(0, 150) + (result.length > 150 ? '...' : ''), full: result }
  }
  
  return { status: 'success', brief: JSON.stringify(result).substring(0, 150) + '...', full: JSON.stringify(result, null, 2) }
}

export const ToolCallDisplay = memo(({ toolCall, hasResult = false, result, className, isStreaming = false, isError = false }: ToolCallDisplayProps) => {
  // Auto-expand Edit/MultiEdit tools to show diff by default, but NOT during streaming
  const isEditTool = toolCall.name === 'Edit' || toolCall.name === 'MultiEdit'
  const [isExpanded, setIsExpanded] = useState(isEditTool && !isStreaming)
  const [showFullResult, setShowFullResult] = useState(false)
  
  // Check if this is an interrupted bash command
  const isInterrupted = toolCall.name === 'Bash' && 
    result && 
    typeof result === 'object' && 
    result !== null &&
    'interrupted' in result &&
    (result as { interrupted?: boolean }).interrupted === true
  
  // Debug logging
  if (isEditTool) {
    console.log('=== EDIT TOOL DEBUG ===')
    console.log('Tool name:', toolCall.name)
    console.log('Has result:', !!result)
    console.log('Result type:', typeof result)
    console.log('Result preview:', typeof result === 'string' ? result.substring(0, 200) : result)
    console.log('isStreaming:', isStreaming)
  }
  
  // Auto-expand Edit tools when streaming completes
  useEffect(() => {
    if (isEditTool && !isStreaming && !isExpanded) {
      setIsExpanded(true)
    }
  }, [isEditTool, isStreaming, isExpanded])
  
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
          console.log('DEBUG: Looking for first meaningful line:', firstMeaningfulLine)
          
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
                console.log('DEBUG: Found exact line match at:', lineNumber)
                return {
                  startLine: lineNumber,
                  showLineNumbers: true
                }
              }
            }
          }
          
          console.log('DEBUG: No exact match found for line:', firstMeaningfulLine)
          
          // Try a more flexible regex approach as fallback
          try {
            // Escape special regex characters and allow flexible whitespace
            const escapedLine = firstMeaningfulLine
              .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              .replace(/\s+/g, '\\s+') // Allow flexible whitespace
            
            const lineMatch = result.match(new RegExp(`(\\d+)→\\s*${escapedLine}`, 'm'))
            if (lineMatch) {
              const startLine = parseInt(lineMatch[1], 10)
              console.log('DEBUG: Found flexible match at:', startLine)
              return {
                startLine,
                showLineNumbers: true
              }
            }
          } catch (regexError) {
            console.error('Regex fallback failed:', regexError)
          }
        }
      } catch (e) {
        console.error('Error extracting line number:', e)
      }
    }
    
    // Fallback: just find the first line number in the content
    const lineNumberMatch = result.match(/(\d+)→/)
    if (lineNumberMatch) {
      const startLine = parseInt(lineNumberMatch[1], 10)
      console.log('DEBUG: Using fallback line number:', startLine)
      return {
        startLine,
        showLineNumbers: true
      }
    }
    
    return null
  }, [result, isEditTool, toolCall])
  
  // Check if this is an Edit tool with diff data AND we have the tool result
  const isEditWithDiff = isEditTool && 
    toolCall.input && 
    typeof toolCall.input === 'object' &&
    result && // Must have tool result to show diffs
    (
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
                    startLineNumber={lineInfo?.startLine || 1}
                    showLineNumbers={lineInfo?.showLineNumbers ?? true}
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
                      startLineNumber={lineInfo?.startLine || 1}
                      showLineNumbers={lineInfo?.showLineNumbers ?? true}
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
      {formattedResult && toolCall.name !== 'Write' && (
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
    </div>
  )
})

ToolCallDisplay.displayName = 'ToolCallDisplay'