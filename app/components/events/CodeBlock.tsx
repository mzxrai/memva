import { useState, memo } from 'react'
import { RiCheckLine, RiFileCopyLine } from 'react-icons/ri'
import { colors, typography, spacing, radius, transition } from '../../constants/design'
import clsx from 'clsx'

interface CodeBlockProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  className?: string
}

export const CodeBlock = memo(({ code, language, showLineNumbers = true, className }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  const isDiff = language === 'diff'
  const lines = code.split('\n')
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }
  
  const renderLine = (line: string, index: number) => {
    const lineNumber = index + 1
    let lineType: 'added' | 'removed' | 'normal' = 'normal'
    let indicator = ' '
    let processedLine = line
    
    if (isDiff) {
      if (line.startsWith('+')) {
        lineType = 'added'
        indicator = '+'
        processedLine = line.substring(1)
      } else if (line.startsWith('-')) {
        lineType = 'removed'
        indicator = '-'
        processedLine = line.substring(1)
      }
    }
    
    return (
      <div
        key={index}
        className={clsx(
          'code-line flex',
          lineType === 'added' && 'bg-emerald-950/20 border-l-2 border-emerald-600',
          lineType === 'removed' && 'bg-red-950/20 border-l-2 border-red-600',
          lineType === 'normal' && 'border-l-2 border-transparent'
        )}
      >
        {/* Line number gutter */}
        {showLineNumbers && (
          <div className={clsx(
            'line-number select-none px-3 text-right',
            typography.font.mono,
            typography.size.xs,
            colors.text.muted,
            'w-12 flex-shrink-0'
          )}>
            {lineNumber}
          </div>
        )}
        
        {/* Diff indicator */}
        {isDiff && (
          <div className={clsx(
            'line-indicator select-none px-2',
            typography.font.mono,
            typography.size.sm,
            lineType === 'added' && 'text-emerald-500',
            lineType === 'removed' && 'text-red-500',
            lineType === 'normal' && colors.text.muted
          )}>
            {indicator}
          </div>
        )}
        
        {/* Code content */}
        <div className={clsx(
          'flex-1 pr-12',
          typography.font.mono,
          typography.size.sm,
          colors.text.primary,
          'whitespace-pre',
          'leading-relaxed'
        )}>
          {processedLine || '\u00A0'}
        </div>
      </div>
    )
  }
  
  return (
    <div
      className={clsx(
        'group relative',
        colors.background.secondary,
        colors.border.subtle,
        'border',
        radius.lg,
        'overflow-hidden',
        transition.normal,
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label="code block"
    >
      {/* Language indicator */}
      {language && (
        <div className={clsx(
          'absolute top-2 right-4 z-10',
          'px-2 py-1',
          colors.background.tertiary,
          colors.border.subtle,
          'border',
          radius.sm,
          typography.font.mono,
          typography.size.xs,
          colors.text.secondary,
          'select-none',
          transition.fast,
          isHovered ? 'opacity-100' : 'opacity-60'
        )}>
          {language}
        </div>
      )}
      
      {/* Copy button */}
      {isHovered && (
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className={clsx(
            'absolute top-2 z-20',
            language ? 'right-18' : 'right-4',
            'p-2',
            colors.background.secondary,
            colors.border.default,
            'border',
            radius.md,
            transition.fast,
            'hover:bg-zinc-800',
            'active:scale-95',
            'group/copy'
          )}
        >
          {copied ? (
            <>
              <RiCheckLine className="w-4 h-4 text-emerald-500" />
              <span className={clsx(
                'absolute -bottom-6 right-0',
                'px-2 py-1',
                colors.background.active,
                radius.sm,
                typography.size.xs,
                'text-emerald-400',
                'whitespace-nowrap'
              )}>
                Copied!
              </span>
            </>
          ) : (
            <RiFileCopyLine className={clsx(
              'w-4 h-4',
              colors.text.tertiary,
              'group-hover/copy:text-zinc-300'
            )} />
          )}
        </button>
      )}
      
      {/* Code content */}
      <pre className={clsx(
        'overflow-x-auto overflow-y-auto',
        'max-h-[600px]',
        spacing.md,
        !showLineNumbers && !isDiff && spacing.lg
      )}>
        <code>
          {lines.map((line, index) => renderLine(line, index))}
        </code>
      </pre>
    </div>
  )
})

CodeBlock.displayName = 'CodeBlock'