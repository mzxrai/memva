import { BaseEventWrapper } from './BaseEventWrapper'
import { MessageContainer } from './MessageContainer'
import type { AnyEvent } from '../../types/events'
import { RiFileTextLine, RiLoader4Line, RiCheckboxCircleLine } from 'react-icons/ri'
import { typography } from '../../constants/design'
import clsx from 'clsx'
import { useState, useEffect } from 'react'

interface ContextLimitNotificationProps {
  event: AnyEvent
  status: 'warning' | 'summarizing' | 'complete'
  summaryContent?: string
  summarizedEventCount?: number
}

export function ContextLimitNotification({ event, status, summaryContent, summarizedEventCount }: ContextLimitNotificationProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Auto-expand when summary is complete
  useEffect(() => {
    if (status === 'complete' && summaryContent) {
      setIsExpanded(true)
    }
  }, [status, summaryContent])

  const getStatusIcon = () => {
    switch (status) {
      case 'warning':
        return <RiFileTextLine className="w-5 h-5 text-amber-500" />
      case 'summarizing':
        return <RiLoader4Line className="w-5 h-5 text-blue-400 animate-spin" />
      case 'complete':
        return <RiCheckboxCircleLine className="w-5 h-5 text-emerald-400" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'warning':
        return 'Context limit reached'
      case 'summarizing':
        return 'Creating conversation summary...'
      case 'complete':
        return 'Summary created'
    }
  }

  const getStatusSubtext = () => {
    switch (status) {
      case 'warning':
        return 'This conversation has reached Claude\'s context window limit. We\'ll automatically create a summary to continue.'
      case 'summarizing':
        return 'Please wait while we compress your conversation history...'
      case 'complete':
        return summarizedEventCount ? `Successfully summarized ${summarizedEventCount} messages` : 'Your conversation can now continue'
    }
  }

  const getBgColor = () => {
    switch (status) {
      case 'warning':
        return 'bg-amber-900/10'
      case 'summarizing':
        return 'bg-blue-900/10'
      case 'complete':
        return 'bg-emerald-900/10'
    }
  }

  const getBorderColor = () => {
    switch (status) {
      case 'warning':
        return 'border-amber-800/30'
      case 'summarizing':
        return 'border-blue-800/30'
      case 'complete':
        return 'border-emerald-800/30'
    }
  }

  return (
    <BaseEventWrapper
      timestamp={event.timestamp}
      uuid={event.uuid}
      eventType="system"
      rawEvent={event}
    >
      <MessageContainer>
        <div className={clsx(
          'rounded-lg transition-all duration-300',
          getBgColor(),
          'border',
          getBorderColor(),
          'overflow-hidden'
        )}>
          {/* Header */}
          <div className="px-4 py-3">
            <div className="flex items-start gap-3">
              {getStatusIcon()}
              <div className="flex-1">
                <h3 className={clsx(typography.size.sm, 'font-medium text-zinc-100 mb-0.5')}>
                  {getStatusText()}
                </h3>
                <p className={clsx(typography.size.xs, 'text-zinc-400')}>
                  {getStatusSubtext()}
                </p>
              </div>
            </div>
          </div>

          {/* Summary content (only when complete) */}
          {status === 'complete' && summaryContent && (
            <>
              <div className="border-t border-zinc-800/50 px-4 py-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={clsx(
                    typography.size.xs,
                    'text-zinc-400 hover:text-zinc-300 transition-colors',
                    'flex items-center gap-1'
                  )}
                >
                  {isExpanded ? 'Hide' : 'Show'} summary
                  <span className="text-zinc-600">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-zinc-800/50 px-4 py-3">
                  <div className={clsx(
                    'bg-zinc-900/50',
                    'rounded-md',
                    'p-3',
                    'border border-zinc-800'
                  )}>
                    <p className={clsx(
                      typography.font.mono,
                      typography.size.xs,
                      'text-zinc-300 whitespace-pre-wrap leading-relaxed'
                    )}>
                      {summaryContent}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </MessageContainer>
    </BaseEventWrapper>
  )
}