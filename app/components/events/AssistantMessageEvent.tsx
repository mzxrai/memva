import { type ReactNode } from 'react'
import { RiSparklingLine, RiBrainLine } from 'react-icons/ri'
import { BaseEventWrapper } from './BaseEventWrapper'
import { MessageContainer } from './MessageContainer'
import { MessageHeader } from './MessageHeader'
import { ToolCallDisplay } from './ToolCallDisplay'
import { CodeBlock } from './CodeBlock'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { colors, typography, radius, iconSize } from '../../constants/design'
import type { AnyEvent, AssistantMessageContent } from '../../types/events'
import clsx from 'clsx'

interface AssistantMessageEventProps {
  event: AnyEvent
  toolResults?: Map<string, { result: unknown; isError?: boolean }>
  isStreaming?: boolean
}

function renderContent(content: AssistantMessageContent, toolResults?: Map<string, { result: unknown; isError?: boolean }>, isStreaming?: boolean): ReactNode {
  switch (content.type) {
    case 'text':
      return <MarkdownRenderer content={content.text || ''} />
    
    case 'tool_use': {
      const toolResult = toolResults?.get(content.id);
      return <ToolCallDisplay 
        toolCall={content} 
        result={toolResult?.result} 
        hasResult={!!toolResult}
        isError={toolResult?.isError}
        isStreaming={isStreaming} 
      />
    }
    
    case 'thinking':
      return (
        <details className={clsx(
          colors.background.tertiary,
          colors.border.subtle,
          'border',
          radius.lg,
          'p-3 mt-2'
        )}>
          <summary className={clsx(
            'flex items-center gap-2',
            typography.size.sm,
            colors.text.secondary,
            'cursor-pointer select-none'
          )}>
            <RiBrainLine className={clsx(iconSize.sm, colors.text.tertiary)} />
            <span>Thinking process</span>
          </summary>
          <div className={clsx(
            'mt-3',
            '[&_p]:text-zinc-400',
            '[&_code]:text-zinc-300'
          )}>
            <MarkdownRenderer content={content.text || ''} />
          </div>
        </details>
      )
    
    default:
      return (
        <CodeBlock 
          code={JSON.stringify(content, null, 2)}
          language="json"
          className="text-xs"
        />
      )
  }
}

export function AssistantMessageEvent({ event, toolResults, isStreaming = false }: AssistantMessageEventProps) {
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
      rawEvent={event}
    >
      <MessageContainer>
        <MessageHeader icon={RiSparklingLine} title="Claude" />
        
        {messageContent.length > 0 ? (
          <div className="space-y-2">
            {messageContent.map((content, index) => (
              <div key={index}>
                {renderContent(content, toolResults, isStreaming)}
              </div>
            ))}
          </div>
        ) : (
          <div className={clsx(colors.text.tertiary, typography.size.sm)}>
            No content available
          </div>
        )}
      </MessageContainer>
    </BaseEventWrapper>
  )
}