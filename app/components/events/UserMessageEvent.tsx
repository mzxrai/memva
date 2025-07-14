import { BaseEventWrapper } from './BaseEventWrapper'
import type { AnyEvent } from '../../types/events'

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
    >
      <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
          <span className="text-sm font-medium text-blue-200">You</span>
        </div>
        <div className="text-zinc-100 leading-relaxed">
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
      </div>
    </BaseEventWrapper>
  )
}