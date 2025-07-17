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
  const [showAllLinks, setShowAllLinks] = useState(false)

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
  const firstLine = contentLines[0] || ''
  const hasMoreContent = contentLines.length > 1

  // Display links (3 or all)
  const displayLinks = showAllLinks ? links : links.slice(0, 3)
  const hasMoreLinks = links.length > 3

  return (
    <div className="py-2">
      <div className={clsx(
        typography.font.mono,
        typography.size.sm,
        colors.text.secondary
      )}>
        {/* Links section */}
        {displayLinks.length > 0 && (
          <div className="mb-2">
            {displayLinks.map((link, index) => (
              <div key={index}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clsx(
                    colors.accent.blue.text,
                    'hover:underline',
                    'break-words',
                    'block'
                  )}
                >
                  {link.title}
                </a>
              </div>
            ))}
            {hasMoreLinks && !showAllLinks && (
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => setShowAllLinks(true)}
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
                  aria-label="Show all links"
                >
                  <RiArrowDownSLine className={clsx(
                    'w-3 h-3',
                    colors.text.tertiary,
                    transition.fast
                  )} />
                </button>
                <span className={clsx(typography.size.xs, colors.text.tertiary)}>
                  +{links.length - 3} more links
                </span>
              </div>
            )}
            {hasMoreLinks && showAllLinks && (
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => setShowAllLinks(false)}
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
                  aria-label="Show fewer links"
                >
                  <RiArrowDownSLine className={clsx(
                    'w-3 h-3',
                    colors.text.tertiary,
                    transition.fast,
                    'rotate-180'
                  )} />
                </button>
                <span className={clsx(typography.size.xs, colors.text.tertiary)}>
                  Show less
                </span>
              </div>
            )}
          </div>
        )}

        {/* Content section - show only first line or full content */}
        {firstLine && (
          <div>
            {showFullContent ? (
              <MarkdownRenderer content={mainContent} />
            ) : (
              <MarkdownRenderer content={firstLine} />
            )}
            {hasMoreContent && !showFullContent && (
              <div className="mt-1 flex items-center gap-2">
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
                  aria-label="Show full content"
                >
                  <RiArrowDownSLine className={clsx(
                    'w-3 h-3',
                    colors.text.tertiary,
                    transition.fast
                  )} />
                </button>
                <span className={clsx(typography.size.xs, colors.text.tertiary)}>
                  +{contentLines.length - 1} more lines
                </span>
              </div>
            )}
            {hasMoreContent && showFullContent && (
              <div className="mt-1 flex items-center gap-2">
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
                  aria-label="Show less content"
                >
                  <RiArrowDownSLine className={clsx(
                    'w-3 h-3',
                    colors.text.tertiary,
                    transition.fast,
                    'rotate-180'
                  )} />
                </button>
                <span className={clsx(typography.size.xs, colors.text.tertiary)}>
                  Show less
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

WebSearchToolDisplay.displayName = 'WebSearchToolDisplay'