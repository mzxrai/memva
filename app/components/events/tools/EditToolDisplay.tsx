import { memo, useState } from 'react'
import { RiArrowDownSLine } from 'react-icons/ri'
import { colors, typography, transition } from '../../../constants/design'
import { DiffViewer } from '../DiffViewer'
import type { ToolUseContent } from '../../../types/events'
import clsx from 'clsx'

interface EditToolDisplayProps {
  toolCall: ToolUseContent
  hasResult: boolean
  result?: unknown
  lineInfo: { startLine: number; showLineNumbers: boolean } | null
}

// Reconstructs the original and final file content from MultiEdit operations
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

export const EditToolDisplay = memo(({ toolCall, hasResult, result, lineInfo }: EditToolDisplayProps) => {
  const [showFullDiff, setShowFullDiff] = useState(false)
  
  // Only show for Edit/MultiEdit tools with results
  const isEditTool = toolCall.name === 'Edit' || toolCall.name === 'MultiEdit'

  if (!isEditTool || !hasResult || !result) {
    return null
  }

  // Expect result format: {content: string, is_error: boolean}
  if (typeof result !== 'object' || result === null) {
    return null
  }

  const sdkResult = result as { content?: string, is_error?: boolean }

  if (sdkResult.content === undefined) {
    return null
  }

  const isError = sdkResult.is_error === true

  // Handle error display
  if (isError) {
    const errorContent = typeof sdkResult.content === 'string' ? sdkResult.content : 'Edit operation failed'
    
    return (
      <div className="py-2">
        <div className={clsx(
          typography.font.mono,
          typography.size.sm,
          colors.accent.red.text,
          'whitespace-pre-wrap'
        )}>
          {errorContent}
        </div>
      </div>
    )
  }

  // Check if this is an Edit tool with valid diff data
  const isEditWithDiff = toolCall.input &&
    typeof toolCall.input === 'object' &&
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

  if (!isEditWithDiff) {
    return null
  }

  const input = toolCall.input as Record<string, unknown>

  // Create the expand/collapse button renderer
  const renderExpandButton = (isExpanded: boolean, lineCount: number) => (
    <button
      onClick={() => setShowFullDiff(!showFullDiff)}
      className={clsx(
        'flex items-center gap-1',
        'px-2 py-1',
        'border border-zinc-700',
        'bg-zinc-800/50',
        'hover:bg-zinc-700/50',
        'rounded',
        transition.fast,
        typography.font.mono,
        'text-[0.625rem]', // 10px in rem units
        colors.text.tertiary
      )}
      aria-label={showFullDiff ? 'Collapse' : 'Expand'}
    >
      <RiArrowDownSLine className={clsx(
        'w-3 h-3',
        transition.fast,
        showFullDiff && 'rotate-180'
      )} />
      {showFullDiff ? 'Show less' : `Show ${lineCount - 10} more lines`}
    </button>
  )

  // Handle single Edit tool
  if ('old_string' in input && 'new_string' in input) {
    console.log('EditToolDisplay debug:', {
      toolCall: toolCall.name,
      toolId: toolCall.id,
      hasResult,
      lineInfo,
      startLine: lineInfo?.startLine,
      showLineNumbers: lineInfo?.showLineNumbers,
      defaultingTo1: !lineInfo?.startLine,
      oldString: (input.old_string as string).substring(0, 50) + '...',
      newString: (input.new_string as string).substring(0, 50) + '...',
      resultPreview: sdkResult.content?.substring(0, 100) + '...'
    })
    
    return (
      <DiffViewer
        oldString={input.old_string as string}
        newString={input.new_string as string}
        fileName={input.file_path as string}
        startLineNumber={lineInfo?.startLine || 1}
        showLineNumbers={lineInfo?.showLineNumbers ?? true}
        maxLines={showFullDiff ? undefined : 10}
        renderExpandButton={renderExpandButton}
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
          maxLines={showFullDiff ? undefined : 10}
          renderExpandButton={renderExpandButton}
        />
      </div>
    )
  }

  return null
})

EditToolDisplay.displayName = 'EditToolDisplay'