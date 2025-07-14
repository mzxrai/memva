import { BaseEventWrapper } from './BaseEventWrapper'
import { MessageContainer } from './MessageContainer'
import { MessageHeader } from './MessageHeader'
import { RiQuestionLine } from 'react-icons/ri'
import { colors, typography } from '../../constants/design'
import type { AnyEvent } from '../../types/events'
import clsx from 'clsx'

interface FallbackEventProps {
  event: AnyEvent
}

export function FallbackEvent({ event }: FallbackEventProps) {
  return (
    <BaseEventWrapper
      timestamp={event.timestamp}
      uuid={event.uuid}
      eventType={event.type as string || 'unknown'}
      className="opacity-70"
      rawEvent={event}
    >
      <MessageContainer>
        <MessageHeader icon={RiQuestionLine} title="Unknown Event" />
        <div className={clsx(
          typography.font.mono,
          typography.size.sm,
          colors.text.secondary,
          'leading-relaxed'
        )}>
          This event type is not recognized. Click "View Raw" to see the full event data.
        </div>
      </MessageContainer>
    </BaseEventWrapper>
  )
}