import { colors, typography } from '../../constants/design'
import clsx from 'clsx'
import * as Diff from 'diff'

interface DiffViewerProps {
  oldString: string
  newString: string
  fileName?: string
  className?: string
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
function createUnifiedDiff(oldString: string, newString: string): DiffLine[] {
  const changes = Diff.diffLines(oldString, newString)
  const diffLines: DiffLine[] = []
  
  let oldLineNumber = 1
  let newLineNumber = 1
  
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

export function DiffViewer({ oldString, newString, fileName, className }: DiffViewerProps) {
  const diffLines = createUnifiedDiff(oldString, newString)
  
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
            {diffLines.map((line, index) => (
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
                <td
                  className={clsx(
                    'w-12 px-2 py-1 text-right border-r border-zinc-700 select-none',
                    colors.text.muted
                  )}
                >
                  {line.oldLineNumber || ''}
                </td>
                
                {/* New line number */}
                <td
                  className={clsx(
                    'w-12 px-2 py-1 text-right border-r border-zinc-700 select-none',
                    colors.text.muted
                  )}
                >
                  {line.newLineNumber || ''}
                </td>
                
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
    </div>
  )
}