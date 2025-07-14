import { BaseEventWrapper } from './BaseEventWrapper'
import type { AnyEvent } from '../../types/events'

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
    >
      <div className={`border rounded-lg p-3 ${
        isUserCancelled 
          ? 'bg-orange-950/30 border-orange-900/50' 
          : 'bg-red-950/30 border-red-900/50'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-1.5 h-1.5 rounded-full ${
            isUserCancelled ? 'bg-orange-400' : 'bg-red-400'
          }`}></div>
          <span className={`text-xs font-medium uppercase tracking-wide ${
            isUserCancelled ? 'text-orange-200' : 'text-red-200'
          }`}>
            {isUserCancelled ? 'Cancelled' : 'Error'}
          </span>
        </div>
        <div className={`text-sm leading-relaxed ${
          isUserCancelled ? 'text-orange-100' : 'text-red-100'
        }`}>
          {content}
        </div>
      </div>
    </BaseEventWrapper>
  )
}