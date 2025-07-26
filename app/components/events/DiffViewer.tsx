import { colors, typography } from '../../constants/design'
import clsx from 'clsx'
import * as Diff from 'diff'
import type { ReactNode } from 'react'

interface DiffViewerProps {
  oldString: string
  newString: string
  fileName?: string
  className?: string
  startLineNumber?: number
  showLineNumbers?: boolean
  maxLines?: number
  renderExpandButton?: (isExpanded: boolean, lineCount: number) => ReactNode
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed'
  oldLineNumber?: number
  newLineNumber?: number
  content: string
  indicator: ' ' | '+' | '-'
}

/**
 * Creates a unified diff with dual line numbers using the diff library
 */
function createUnifiedDiff(oldString: string, newString: string, startLineNumber: number = 1): DiffLine[] {
  const changes = Diff.diffLines(oldString, newString)
  const diffLines: DiffLine[] = []
  
  let oldLineNumber = startLineNumber
  let newLineNumber = startLineNumber
  
  for (const change of changes) {
    const lines = change.value.split('\n')
    // Remove the last empty line if it exists (common with split on newlines)
    if (lines[lines.length - 1] === '') {
      lines.pop()
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (change.added) {
        diffLines.push({
          type: 'added',
          newLineNumber: newLineNumber++,
          content: line,
          indicator: '+'
        })
      } else if (change.removed) {
        diffLines.push({
          type: 'removed',
          oldLineNumber: oldLineNumber++,
          content: line,
          indicator: '-'
        })
      } else {
        // Unchanged line
        diffLines.push({
          type: 'unchanged',
          oldLineNumber: oldLineNumber++,
          newLineNumber: newLineNumber++,
          content: line,
          indicator: ' '
        })
      }
    }
  }
  
  return diffLines
}

/**
 * Groups diff lines into hunks with context
 */
interface Hunk {
  startIndex: number
  endIndex: number
  hasChanges: boolean
}

function createHunks(diffLines: DiffLine[], contextLines: number = 3): Hunk[] {
  const hunks: Hunk[] = []
  let currentHunk: Hunk | null = null
  
  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i]
    const isChange = line.type !== 'unchanged'
    
    if (isChange) {
      // If we don't have a current hunk, or the last hunk is too far away, start a new one
      const hunkStart = Math.max(0, i - contextLines)
      
      if (!currentHunk || currentHunk.endIndex < hunkStart - 1) {
        // Start new hunk with context before
        currentHunk = {
          startIndex: hunkStart,
          endIndex: i,
          hasChanges: true
        }
        hunks.push(currentHunk)
      }
      
      // Extend current hunk to include this change
      currentHunk.endIndex = i
    } else if (currentHunk && i <= currentHunk.endIndex + contextLines) {
      // This is a context line after changes, extend the hunk
      currentHunk.endIndex = i
    }
  }
  
  return hunks
}

/**
 * Selects which hunks to display based on line budget
 */
function selectHunksToDisplay(
  diffLines: DiffLine[], 
  hunks: Hunk[], 
  maxLines: number
): { displayLines: DiffLine[], hiddenChangesAfter: number } {
  if (!hunks.length || !maxLines) {
    return { displayLines: diffLines, hiddenChangesAfter: 0 }
  }
  
  const result: DiffLine[] = []
  let remainingBudget = maxLines
  let lastIncludedIndex = -1
  let hiddenChangesAfter = 0
  
  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunk = hunks[hunkIndex]
    const hunkSize = hunk.endIndex - hunk.startIndex + 1
    
    if (hunkSize <= remainingBudget) {
      // Include this entire hunk
      for (let i = hunk.startIndex; i <= hunk.endIndex; i++) {
        result.push(diffLines[i])
      }
      remainingBudget -= hunkSize
      lastIncludedIndex = hunk.endIndex
    } else if (remainingBudget > 0 && hunkIndex === 0) {
      // For the first hunk, include as much as we can
      for (let i = hunk.startIndex; i < hunk.startIndex + remainingBudget; i++) {
        result.push(diffLines[i])
      }
      lastIncludedIndex = hunk.startIndex + remainingBudget - 1
      remainingBudget = 0
      
      // Count remaining changes in this partial hunk
      for (let i = lastIncludedIndex + 1; i <= hunk.endIndex; i++) {
        if (diffLines[i].type !== 'unchanged') {
          hiddenChangesAfter++
        }
      }
    } else {
      // Can't include this hunk, count its changes
      for (let i = hunk.startIndex; i <= hunk.endIndex; i++) {
        if (diffLines[i].type !== 'unchanged') {
          hiddenChangesAfter++
        }
      }
    }
    
    if (remainingBudget === 0) {
      // Count changes in remaining hunks
      for (let j = hunkIndex + 1; j < hunks.length; j++) {
        const remainingHunk = hunks[j]
        for (let i = remainingHunk.startIndex; i <= remainingHunk.endIndex; i++) {
          if (diffLines[i].type !== 'unchanged') {
            hiddenChangesAfter++
          }
        }
      }
      break
    }
  }
  
  return { displayLines: result, hiddenChangesAfter }
}

export function DiffViewer({ oldString, newString, fileName, className, startLineNumber, showLineNumbers = true, maxLines, renderExpandButton }: DiffViewerProps) {
  const diffLines = createUnifiedDiff(oldString, newString, startLineNumber)
  
  // Use smart hunk selection when truncating
  let displayLines: DiffLine[]
  let hiddenChangesAfter = 0
  
  if (maxLines && maxLines < diffLines.length) {
    const hunks = createHunks(diffLines)
    
    // If there are no changes, fall back to simple truncation
    if (hunks.length === 0) {
      displayLines = diffLines.slice(0, maxLines)
      hiddenChangesAfter = 0
    } else {
      const result = selectHunksToDisplay(diffLines, hunks, maxLines)
      displayLines = result.displayLines
      hiddenChangesAfter = result.hiddenChangesAfter
    }
  } else {
    displayLines = diffLines
  }
  
  const isTruncated = maxLines && diffLines.length > maxLines
  
  return (
    <div
      className={clsx(
        'border border-zinc-700 rounded-lg overflow-hidden',
        colors.background.secondary,
        className
      )}
    >
      {/* File header */}
      {fileName && (
        <div className={clsx(
          'px-4 py-2 border-b border-zinc-700',
          colors.background.tertiary,
          typography.font.mono,
          typography.size.sm,
          colors.text.secondary
        )}>
          {fileName}
        </div>
      )}
      
      {/* Diff content */}
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-sm">
          <tbody>
            {displayLines.map((line, index) => (
              <tr
                key={index}
                className={clsx(
                  'border-l-2',
                  line.type === 'added' && 'bg-emerald-950/20 border-emerald-600',
                  line.type === 'removed' && 'bg-red-950/20 border-red-600',
                  line.type === 'unchanged' && 'border-transparent'
                )}
              >
                {/* Old line number */}
                {showLineNumbers && (
                  <td
                    className={clsx(
                      'w-12 px-2 py-1 text-right border-r border-zinc-700 select-none',
                      colors.text.muted
                    )}
                  >
                    {line.oldLineNumber || ''}
                  </td>
                )}
                
                {/* New line number */}
                {showLineNumbers && (
                  <td
                    className={clsx(
                      'w-12 px-2 py-1 text-right border-r border-zinc-700 select-none',
                      colors.text.muted
                    )}
                  >
                    {line.newLineNumber || ''}
                  </td>
                )}
                
                {/* Diff indicator */}
                <td
                  className={clsx(
                    'w-6 px-2 py-1 text-center border-r border-zinc-700 select-none',
                    line.type === 'added' && 'text-emerald-400',
                    line.type === 'removed' && 'text-red-400',
                    line.type === 'unchanged' && colors.text.muted
                  )}
                >
                  {line.indicator}
                </td>
                
                {/* Content */}
                <td
                  className="px-3 py-1"
                >
                  <span className={clsx(
                    colors.text.primary,
                    'whitespace-pre font-mono'
                  )}>
                    {line.content || '\u00A0'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Visual indicator for hidden changes */}
      {hiddenChangesAfter > 0 && (
        <div className={clsx(
          'px-4 py-2 border-t border-zinc-700',
          colors.background.tertiary,
          typography.font.mono,
          'text-xs',
          colors.text.tertiary,
          'text-center'
        )}>
          ↓ {hiddenChangesAfter} more changed line{hiddenChangesAfter !== 1 ? 's' : ''} below
        </div>
      )}
      
      {/* Expand/collapse button at bottom */}
      {renderExpandButton && (isTruncated || (!maxLines && diffLines.length > 10)) && (
        <div className={clsx(
          'border-t',
          colors.border.subtle,
          'px-4 py-2'
        )}>
          {renderExpandButton(!isTruncated, diffLines.length)}
        </div>
      )}
    </div>
  )
}