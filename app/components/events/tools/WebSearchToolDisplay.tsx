import { memo, useState } from 'react'
import type { ToolUseContent } from '../../../types/events'
import { RiArrowDownSLine } from 'react-icons/ri'
import { MarkdownRenderer } from '../../MarkdownRenderer'
import { colors, typography, radius, transition, spacing } from '../../../constants/design'
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
    const isLongError = errorContent.length > 200

    return (
      <div className="py-2">
        <div className={clsx(
          colors.background.secondary,
          colors.border.subtle,
          'border',
          radius.md,
          'p-3'
        )}>
          <div className={clsx(
            typography.font.mono,
            typography.size.sm,
            colors.accent.red.text,
            'whitespace-pre-wrap'
          )}>
            {isLongError && !showFullContent ? (
              <>
                {errorContent.slice(0, 200)}...
                <div className="mt-2">
                  <button
                    onClick={() => setShowFullContent(true)}
                    className={clsx(
                      'flex items-center gap-1',
                      typography.size.xs,
                      colors.accent.blue.text,
                      'hover:underline'
                    )}
                  >
                    Show full error
                    <RiArrowDownSLine className="w-3 h-3" />
                  </button>
                </div>
              </>
            ) : (
              <>
                {errorContent}
                {isLongError && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowFullContent(false)}
                      className={clsx(
                        'flex items-center gap-1',
                        typography.size.xs,
                        colors.accent.blue.text,
                        'hover:underline'
                      )}
                    >
                      Show less
                      <RiArrowDownSLine className="w-3 h-3 rotate-180" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
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

  // Get the search query from the tool input
  const query = (toolCall.input as { query?: string })?.query || 'web search'

  // Extract the main content (everything after the links)
  const contentStartIndex = lines.findIndex(line => line.includes('Based on the search results'))
  const mainContent = contentStartIndex !== -1 
    ? lines.slice(contentStartIndex).join('\n')
    : content

  // Show first 3 links
  const displayLinks = links.slice(0, 3)

  // Get preview of main content - approximately 3 lines worth
  const contentLines = mainContent.split('\n').filter(line => line.trim())
  const previewContent = contentLines.slice(0, 3).join('\n')
  const hasMoreContent = contentLines.length > 3

  return (
    <div className="py-2">
      {/* Search results header and links */}
      {displayLinks.length > 0 && (
        <div className={clsx(
          'mb-3',
          typography.font.mono
        )}>
          <div className={clsx(
            typography.size.xs,
            colors.text.tertiary,
            'mb-2'
          )}>
            Search results for: <span className={colors.text.secondary}>{query}</span>
          </div>
          
          <div className="space-y-2">
            {displayLinks.map((link, index) => (
              <div key={index} className="group">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clsx(
                    'block',
                    typography.size.sm,
                    colors.accent.blue.text,
                    'hover:underline',
                    'break-words'
                  )}
                >
                  {link.title}
                </a>
                <div className={clsx(
                  typography.size.xs,
                  colors.text.tertiary,
                  'break-all',
                  'mt-0.5'
                )}>
                  {link.url}
                </div>
              </div>
            ))}
          </div>
          
          {links.length > 3 && (
            <div className={clsx(
              typography.size.xs,
              colors.text.tertiary,
              'mt-2'
            )}>
              ...and {links.length - 3} more results
            </div>
          )}
        </div>
      )}

      {/* Main content preview/full */}
      <div className={clsx(
        colors.background.secondary,
        colors.border.subtle,
        'border',
        radius.lg,
        'overflow-hidden'
      )}>
        <div className={spacing.md}>
          {showFullContent ? (
            <MarkdownRenderer content={mainContent} />
          ) : (
            <MarkdownRenderer content={previewContent} />
          )}
        </div>

        {/* Show more/less button */}
        {hasMoreContent && (
          <div className={clsx(
            'flex items-center justify-between px-3 py-2',
            colors.border.subtle,
            'border-t',
            colors.background.tertiary
          )}>
            <span className={clsx(
              typography.size.xs,
              colors.text.tertiary
            )}>
              {showFullContent ? 'Showing full content' : `${contentLines.length} total lines`}
            </span>
            
            <button
              onClick={() => setShowFullContent(!showFullContent)}
              className={clsx(
                'flex items-center justify-center',
                'w-5 h-5',
                'border border-zinc-700',
                'bg-zinc-800/50',
                'hover:bg-zinc-700/50',
                'rounded',
                transition.fast
              )}
              aria-label={showFullContent ? 'Collapse' : 'Expand'}
            >
              <RiArrowDownSLine className={clsx(
                'w-3 h-3',
                colors.text.tertiary,
                transition.fast,
                showFullContent && 'rotate-180'
              )} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

WebSearchToolDisplay.displayName = 'WebSearchToolDisplay'