import { BaseEventWrapper } from './BaseEventWrapper'
import { MessageContainer } from './MessageContainer'
import { MessageHeader } from './MessageHeader'
import type { AnyEvent } from '../../types/events'
import { RiSettingsLine } from 'react-icons/ri'
import { colors, typography } from '../../constants/design'
import clsx from 'clsx'

interface SystemEventProps {
  event: AnyEvent
}

export function SystemEvent({ event }: SystemEventProps) {
  // Check if this is an init subtype - if so, don't render
  if ('subtype' in event && event.subtype === 'init') {
    return null
  }

  // Extract content from various possible structures
  let content = ''
  
  // Check if this is a success subtype - show the result
  if ('subtype' in event && event.subtype === 'success' && 'result' in event) {
    content = typeof event.result === 'string' ? event.result : JSON.stringify(event.result)
  } else if ('content' in event && typeof event.content === 'string') {
    content = event.content
  } else if ('data' in event && typeof event.data === 'object' && event.data && 'content' in event.data) {
    const data = event.data as Record<string, unknown>
    content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
  } else if ('message' in event && typeof event.message === 'string') {
    content = event.message
  } else {
    content = 'System message'
  }

  return (
    <BaseEventWrapper
      timestamp={event.timestamp}
      uuid={event.uuid}
      eventType={event.type as string || 'system'}
      rawEvent={event}
    >
      <MessageContainer>
        <MessageHeader icon={RiSettingsLine} title="System" />
        <div className={clsx(
          typography.font.mono,
          typography.size.sm,
          colors.text.primary,
          'leading-relaxed'
        )}>
          {content}
        </div>
      </MessageContainer>
    </BaseEventWrapper>
  )
}