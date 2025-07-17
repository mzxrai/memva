import { memo, useState } from 'react'
import type { ToolUseContent } from '../../../types/events'
import { RiArrowDownSLine } from 'react-icons/ri'
import { MarkdownRenderer } from '../../MarkdownRenderer'
import { colors, typography, transition } from '../../../constants/design'
import clsx from 'clsx'

interface WebSearchToolDisplayProps {
  toolCall: ToolUseContent
  hasResult: boolean
  result?: unknown
}

interface WebSearchLink {
  title: string
  url: string
}

export const WebSearchToolDisplay = memo(({ toolCall, hasResult, result }: WebSearchToolDisplayProps) => {
  const [showFullContent, setShowFullContent] = useState(false)

  if (toolCall.name !== 'WebSearch' || !hasResult || !result) {
    return null
  }

  if (typeof result !== 'object' || result === null) {
    return null
  }

  const sdkResult = result as { content?: string; is_error?: boolean }

  // Handle errors
  if (sdkResult.is_error === true) {
    const errorContent = sdkResult.content || 'Unknown error occurred'
    const errorLines = errorContent.split('\n').filter(line => line.trim())
    const isLongError = errorLines.length > 3

    return (
      <div className="py-2">
        <div className={clsx(
          typography.font.mono,
          typography.size.sm,
          colors.accent.red.text
        )}>
          {isLongError && !showFullContent ? (
            <div>
              <pre className="whitespace-pre-wrap leading-relaxed">
                {errorLines.slice(0, 3).join('\n')}
              </pre>
              <div className={clsx(typography.size.xs, colors.text.tertiary)}>
                (+{errorLines.length - 3} more lines)
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setShowFullContent(true)}
                  className={clsx(
                    'flex items-center justify-center',
                    'w-5 h-5',
                    'border border-zinc-700',
                    'bg-zinc-800/50',
                    'hover:bg-zinc-700/50',
                    'rounded',
                    'flex-shrink-0',
                    transition.fast
                  )}
                  aria-label="Expand"
                >
                  <RiArrowDownSLine className={clsx(
                    'w-3 h-3',
                    colors.text.tertiary,
                    transition.fast
                  )} />
                </button>
                <span className={clsx(
                  typography.size.sm,
                  colors.text.tertiary
                )}>
                  Show full error
                </span>
              </div>
            </div>
          ) : (
            <div>
              <pre className="whitespace-pre-wrap leading-relaxed">
                {errorContent}
              </pre>
              {isLongError && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setShowFullContent(false)}
                    className={clsx(
                      'flex items-center justify-center',
                      'w-5 h-5',
                      'border border-zinc-700',
                      'bg-zinc-800/50',
                      'hover:bg-zinc-700/50',
                      'rounded',
                      'flex-shrink-0',
                      transition.fast
                    )}
                    aria-label="Collapse"
                  >
                    <RiArrowDownSLine className={clsx(
                      'w-3 h-3',
                      colors.text.tertiary,
                      transition.fast,
                      'rotate-180'
                    )} />
                  </button>
                  <span className={clsx(
                    typography.size.sm,
                    colors.text.tertiary
                  )}>
                    Show less
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Extract content from result
  const content = sdkResult.content || ''
  if (!content) {
    return null
  }

  // Parse the content to extract links
  const lines = content.split('\n')
  const linksLine = lines.find(line => line.startsWith('Links:'))
  let links: WebSearchLink[] = []

  if (linksLine) {
    try {
      const linksJson = linksLine.substring('Links:'.length).trim()
      links = JSON.parse(linksJson) as WebSearchLink[]
    } catch {
      // Failed to parse links, continue without them
    }
  }

  // Extract the main content (everything after the links)
  const contentStartIndex = lines.findIndex(line => line.includes('Based on the search results'))
  const mainContent = contentStartIndex !== -1 
    ? lines.slice(contentStartIndex).join('\n')
    : content

  // Prepare content for display
  const contentLines = mainContent.split('\n').filter(line => line.trim())
  const previewLines = contentLines.slice(0, 3)
  const hasMoreContent = contentLines.length > 3

  // Prepare a unified display with links embedded
  const previewWithLinks = () => {
    const linkElements = links.slice(0, 3).map((link) => (
      `[${link.title}](${link.url})`
    )).join('\n')
    
    if (linkElements && previewLines.length > 0) {
      return `${linkElements}\n\n${previewLines.join('\n')}`
    } else if (linkElements) {
      return linkElements
    } else {
      return previewLines.join('\n')
    }
  }

  const fullContentWithLinks = () => {
    const allLinkElements = links.map((link) => (
      `[${link.title}](${link.url})`
    )).join('\n')
    
    if (allLinkElements && mainContent) {
      return `${allLinkElements}\n\n${mainContent}`
    } else if (allLinkElements) {
      return allLinkElements
    } else {
      return mainContent
    }
  }

  return (
    <div className="py-2">
      <div className={clsx(
        typography.font.mono,
        typography.size.sm,
        colors.text.secondary
      )}>
        {showFullContent ? (
          <div>
            <MarkdownRenderer content={fullContentWithLinks()} />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setShowFullContent(false)}
                className={clsx(
                  'flex items-center justify-center',
                  'w-5 h-5',
                  'border border-zinc-700',
                  'bg-zinc-800/50',
                  'hover:bg-zinc-700/50',
                  'rounded',
                  'flex-shrink-0',
                  transition.fast
                )}
                aria-label="Collapse"
              >
                <RiArrowDownSLine className={clsx(
                  'w-3 h-3',
                  colors.text.tertiary,
                  transition.fast,
                  'rotate-180'
                )} />
              </button>
              <span className={clsx(
                typography.size.sm,
                colors.text.tertiary
              )}>
                Show less
              </span>
            </div>
          </div>
        ) : (
          <div>
            <MarkdownRenderer content={previewWithLinks()} />
            {(hasMoreContent || links.length > 3) && (
              <>
                <div className={clsx(typography.size.xs, colors.text.tertiary, 'mt-1')}>
                  {links.length > 3 && `(+${links.length - 3} more links) `}
                  {hasMoreContent && `(+${contentLines.length - 3} more lines)`}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setShowFullContent(true)}
                    className={clsx(
                      'flex items-center justify-center',
                      'w-5 h-5',
                      'border border-zinc-700',
                      'bg-zinc-800/50',
                      'hover:bg-zinc-700/50',
                      'rounded',
                      'flex-shrink-0',
                      transition.fast
                    )}
                    aria-label="Expand"
                  >
                    <RiArrowDownSLine className={clsx(
                      'w-3 h-3',
                      colors.text.tertiary,
                      transition.fast
                    )} />
                  </button>
                  <span className={clsx(
                    typography.size.sm,
                    colors.text.tertiary
                  )}>
                    Show full content
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

WebSearchToolDisplay.displayName = 'WebSearchToolDisplay'