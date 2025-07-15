import { RiUser3Line } from 'react-icons/ri'
import { BaseEventWrapper } from './BaseEventWrapper'
import { MessageContainer } from './MessageContainer'
import { MessageHeader } from './MessageHeader'
import { CodeBlock } from './CodeBlock'
import { colors, typography } from '../../constants/design'
import type { AnyEvent } from '../../types/events'
import clsx from 'clsx'

interface UserMessageEventProps {
  event: AnyEvent
}

export function UserMessageEvent({ event }: UserMessageEventProps) {
  // Extract content from the event structure
  const content = event.content || 
                 (event.message && typeof event.message === 'object' && 'content' in event.message ? event.message.content : undefined) || 
                 (typeof event.data === 'object' && event.data && 'content' in event.data ? event.data.content : undefined) ||
                 'No content'

  return (
    <BaseEventWrapper
      timestamp={event.timestamp}
      uuid={event.uuid}
      eventType="user"
      rawEvent={event}
    >
      <MessageContainer>
        <MessageHeader icon={RiUser3Line} title="You" />
        <div className={clsx(
          typography.font.mono,
          typography.size.sm,
          colors.text.secondary,
          'leading-relaxed',
          'flex items-start gap-2'
        )}>
          <span className={colors.text.tertiary}>{'>'}</span>
          <div className="flex-1">
            {typeof content === 'string' ? (
              content
            ) : (
              <CodeBlock 
                code={JSON.stringify(content, null, 2)}
                language="json"
                className="text-xs"
              />
            )}
          </div>
        </div>
      </MessageContainer>
    </BaseEventWrapper>
  )
}