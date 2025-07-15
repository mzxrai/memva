import { BaseEventWrapper } from './BaseEventWrapper'
import { MessageContainer } from './MessageContainer'
import { MessageHeader } from './MessageHeader'
import { RiErrorWarningLine } from 'react-icons/ri'
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
      <MessageContainer>
        <MessageHeader 
          icon={RiErrorWarningLine} 
          title="System"
        />
        <div className={clsx(
          typography.font.mono,
          typography.size.sm,
          'leading-relaxed',
          isUserCancelled ? 'text-orange-400' : 'text-red-400'
        )}>
          {content}
        </div>
      </MessageContainer>
    </BaseEventWrapper>
  )
}