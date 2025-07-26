import { type ReactNode } from 'react'
import { RiSparklingLine } from 'react-icons/ri'
import { BaseEventWrapper } from './BaseEventWrapper'
import { MessageContainer } from './MessageContainer'
import { MessageHeader } from './MessageHeader'
import { ToolCallDisplay } from './ToolCallDisplay'
import { CodeBlock } from './CodeBlock'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { ThinkingDisplay } from './tools/ThinkingDisplay'
import { colors, typography } from '../../constants/design'
import type { AnyEvent, AssistantMessageContent } from '../../types/events'
import type { PermissionRequest } from '../../db/schema'
import clsx from 'clsx'

interface AssistantMessageEventProps {
  event: AnyEvent
  toolResults?: Map<string, { result: unknown; isError?: boolean }>
  permissions?: Map<string, PermissionRequest>
  onApprovePermission?: (id: string) => void
  onDenyPermission?: (id: string) => void
  onApprovePermissionWithSettings?: (id: string, permissionMode: 'default' | 'acceptEdits') => void
  isProcessingPermission?: boolean
  isStreaming?: boolean
}

function renderContent(
  content: AssistantMessageContent, 
  toolResults?: Map<string, { result: unknown; isError?: boolean }>, 
  permissions?: Map<string, PermissionRequest>,
  onApprovePermission?: (id: string) => void,
  onDenyPermission?: (id: string) => void,
  onApprovePermissionWithSettings?: (id: string, permissionMode: 'default' | 'acceptEdits') => void,
  isProcessingPermission?: boolean,
  isStreaming?: boolean
): ReactNode {
  switch (content.type) {
    case 'text':
      return <MarkdownRenderer content={content.text || ''} />
    
    case 'tool_use': {
      const toolResult = toolResults?.get(content.id);
      const permission = permissions?.get(content.id);
      return <ToolCallDisplay 
        toolCall={content} 
        result={toolResult?.result} 
        hasResult={!!toolResult}
        isError={toolResult?.isError}
        permission={permission}
        onApprovePermission={onApprovePermission}
        onDenyPermission={onDenyPermission}
        onApprovePermissionWithSettings={onApprovePermissionWithSettings}
        isProcessingPermission={isProcessingPermission}
        isStreaming={isStreaming} 
      />
    }
    
    case 'thinking':
      return <ThinkingDisplay content={content} />
    
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

export function AssistantMessageEvent({ 
  event, 
  toolResults, 
  permissions, 
  onApprovePermission,
  onDenyPermission,
  onApprovePermissionWithSettings,
  isProcessingPermission = false,
  isStreaming = false 
}: AssistantMessageEventProps) {
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
                {renderContent(content, toolResults, permissions, onApprovePermission, onDenyPermission, onApprovePermissionWithSettings, isProcessingPermission, isStreaming)}
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