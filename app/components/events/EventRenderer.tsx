import { memo } from 'react'
import { UserMessageEvent } from './UserMessageEvent'
import { AssistantMessageEvent } from './AssistantMessageEvent'
import { SystemEvent } from './SystemEvent'
import { ErrorEvent } from './ErrorEvent'
import { FallbackEvent } from './FallbackEvent'
import type { AnyEvent } from '../../types/events'

interface EventRendererProps {
  event: AnyEvent
  toolResults?: Map<string, { result: unknown; isError?: boolean }>
  isStreaming?: boolean
}

export const EventRenderer = memo(({ event, toolResults, isStreaming = false }: EventRendererProps) => {
  // Determine event type from the event data
  const eventType = ('type' in event ? event.type : undefined) || ('event_type' in event ? event.event_type : undefined)
  
  switch (eventType) {
    case 'user':
      return <UserMessageEvent event={event} />
    
    case 'assistant':
      return <AssistantMessageEvent event={event} toolResults={toolResults} isStreaming={isStreaming} />
    
    case 'system':
      return <SystemEvent event={event} />
    
    case 'error':
    case 'user_cancelled':
      return <ErrorEvent event={event} />
    
    case 'result':
      // For now, treat result messages as system messages
      // Later we can create a dedicated ResultEvent component
      return <SystemEvent event={event} />
    
    default:
      // Unknown event type - fall back to JSON display
      return <FallbackEvent event={event} />
  }
})

EventRenderer.displayName = 'EventRenderer'