import { type ReactNode } from 'react'
import { BaseEventWrapper } from './BaseEventWrapper'
import type { AnyEvent, AssistantMessageContent } from '../../types/events'

interface AssistantMessageEventProps {
  event: AnyEvent
}

function renderContent(content: AssistantMessageContent): ReactNode {
  switch (content.type) {
    case 'text':
      return (
        <div className="text-zinc-100 leading-relaxed whitespace-pre-wrap">
          {content.text}
        </div>
      )
    
    case 'tool_use':
      return (
        <div className="bg-zinc-800 border border-zinc-700 rounded p-3 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-400">Tool:</span>
            <span className="text-sm font-mono text-amber-400">{content.name}</span>
          </div>
          <pre className="text-xs text-zinc-300 font-mono overflow-x-auto">
            {JSON.stringify(content.input, null, 2)}
          </pre>
        </div>
      )
    
    case 'thinking':
      return (
        <details className="bg-zinc-900/50 border border-zinc-700 rounded p-3 mt-2">
          <summary className="text-sm text-zinc-400 cursor-pointer">
            🤔 Thinking...
          </summary>
          <div className="mt-2 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
            {content.text}
          </div>
        </details>
      )
    
    default:
      return (
        <div className="text-zinc-400 text-sm">
          Unknown content type: {JSON.stringify(content)}
        </div>
      )
  }
}

export function AssistantMessageEvent({ event }: AssistantMessageEventProps) {
  // Handle different event structures
  let messageContent: AssistantMessageContent[] = []
  
  if ('message' in event && event.message && typeof event.message === 'object' && 'content' in event.message && Array.isArray(event.message.content)) {
    messageContent = event.message.content as AssistantMessageContent[]
  } else if ('content' in event && typeof event.content === 'string') {
    // Simple text content
    messageContent = [{ type: 'text', text: event.content }]
  } else if ('data' in event && typeof event.data === 'object' && event.data) {
    // Try to extract from data field
    const data = event.data as Record<string, unknown>
    if ('message' in data && typeof data.message === 'object' && data.message) {
      const message = data.message as Record<string, unknown>
      if ('content' in message && Array.isArray(message.content)) {
        messageContent = message.content as AssistantMessageContent[]
      }
    }
  }

  return (
    <BaseEventWrapper
      timestamp={event.timestamp}
      uuid={event.uuid}
      eventType="assistant"
    >
      <div className="bg-purple-950/30 border border-purple-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-purple-400"></div>
          <span className="text-sm font-medium text-purple-200">Claude</span>
        </div>
        
        {messageContent.length > 0 ? (
          <div className="space-y-2">
            {messageContent.map((content, index) => (
              <div key={index}>
                {renderContent(content)}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-400 text-sm">
            No content available
          </div>
        )}
      </div>
    </BaseEventWrapper>
  )
}