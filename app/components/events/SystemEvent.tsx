import { BaseEventWrapper } from './BaseEventWrapper'
import type { AnyEvent } from '../../types/events'

interface SystemEventProps {
  event: AnyEvent
}

export function SystemEvent({ event }: SystemEventProps) {
  // Extract content from various possible structures
  let content = ''
  
  if ('content' in event && typeof event.content === 'string') {
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
    >
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-500"></div>
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            System
          </span>
        </div>
        <div className="text-zinc-300 text-sm leading-relaxed">
          {content}
        </div>
      </div>
    </BaseEventWrapper>
  )
}