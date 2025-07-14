import { BaseEventWrapper } from './BaseEventWrapper'
import { MessageContainer } from './MessageContainer'
import { MessageHeader } from './MessageHeader'
import { RiErrorWarningLine, RiStopCircleLine } from 'react-icons/ri'
import { typography } from '../../constants/design'
import type { AnyEvent } from '../../types/events'
import clsx from 'clsx'

interface ErrorEventProps {
  event: AnyEvent
}

export function ErrorEvent({ event }: ErrorEventProps) {
  // Extract content and determine error type
  let content = ''
  let errorType = 'error'
  
  if ('content' in event && typeof event.content === 'string') {
    content = event.content
  } else if ('data' in event && typeof event.data === 'object' && event.data && 'content' in event.data) {
    const data = event.data as Record<string, unknown>
    content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
  } else if ('message' in event && typeof event.message === 'string') {
    content = event.message
  } else {
    content = 'An error occurred'
  }

  if ('type' in event && event.type === 'user_cancelled') {
    errorType = 'cancelled'
  }

  const isUserCancelled = errorType === 'cancelled'

  return (
    <BaseEventWrapper
      timestamp={event.timestamp}
      uuid={event.uuid}
      eventType={errorType}
      rawEvent={event}
    >
      <MessageContainer className={clsx(
        isUserCancelled 
          ? 'bg-orange-950/30 border-orange-900/50' 
          : 'bg-red-950/30 border-red-900/50'
      )}>
        <MessageHeader 
          icon={isUserCancelled ? RiStopCircleLine : RiErrorWarningLine} 
          title={isUserCancelled ? 'Cancelled' : 'Error'}
          className={clsx(
            isUserCancelled ? '[&_svg]:text-orange-400 [&_span]:text-orange-400' : '[&_svg]:text-red-400 [&_span]:text-red-400'
          )}
        />
        <div className={clsx(
          typography.font.mono,
          typography.size.sm,
          'leading-relaxed',
          isUserCancelled ? 'text-orange-100' : 'text-red-100'
        )}>
          {content}
        </div>
      </MessageContainer>
    </BaseEventWrapper>
  )
}