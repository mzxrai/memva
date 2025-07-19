import { useState, useEffect, useRef } from 'react'
import type { AssistantEvent } from '../types/events'
import clsx from 'clsx'
import { useNewMessageTracking } from '../hooks/useNewMessageTracking'

interface MessageCarouselProps {
  sessionId: string
  latestMessage?: {
    uuid: string
    timestamp: string
    data: unknown
  } | null
}

export default function MessageCarousel({ sessionId, latestMessage }: MessageCarouselProps) {
  const [messageKey, setMessageKey] = useState<string>('')
  const [lastGoodText, setLastGoodText] = useState<string>('')
  const previousMessageId = useRef<string | undefined>(latestMessage?.uuid)
  
  // Use the new message tracking hook
  const { hasNewMessage, markAsNew } = useNewMessageTracking(
    sessionId, 
    latestMessage?.uuid
  )

  useEffect(() => {
    if (!latestMessage) return
    
    // If this is a different message than what we had before
    if (latestMessage.uuid !== previousMessageId.current) {
      setMessageKey(latestMessage.uuid)
      
      // Check if message is recent (within last 30 seconds)
      const messageTime = new Date(latestMessage.timestamp).getTime()
      const now = Date.now()
      const isRecent = (now - messageTime) < 30000 // 30 seconds
      
      if (isRecent) {
        markAsNew(latestMessage.uuid)
      }
      
      previousMessageId.current = latestMessage.uuid
    }
  }, [latestMessage?.uuid, markAsNew])

  // Update lastGoodText if we have new text content - must be before early returns
  useEffect(() => {
    if (latestMessage) {
      const rawText = extractTextContent(latestMessage.data)
      if (rawText) {
        setLastGoodText(rawText)
      }
    }
  }, [latestMessage])
  
  // Note: We no longer clear the new message indicator on click
  // It will only be cleared when the user visits the session page
  const extractTextContent = (data: unknown): string => {
    try {
      // Handle the actual data structure from the logs
      if (typeof data === 'object' && data !== null && 'message' in data) {
        const dataWithMessage = data as { message: { type: string; role: string; content: Array<{ type: string; text: string }> } }
        if (dataWithMessage.message.type === 'message' && 
            dataWithMessage.message.role === 'assistant' && 
            dataWithMessage.message.content) {
          const textContent = dataWithMessage.message.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join(' ')
          return textContent
        }
      }
      
      // Original check for backwards compatibility
      const assistantData = data as AssistantEvent
      if (assistantData.type === 'assistant' && assistantData.message?.content) {
        const textContent = assistantData.message.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join(' ')
        return textContent
      }
      return ''
    } catch (e) {
      console.error('[MessageCarousel] Error extracting text:', e)
      return ''
    }
  }

  const formatTextForPreview = (text: string): string => {
    // Remove markdown formatting for clean preview
    return text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '[code block]')
      .replace(/`([^`]+)`/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image]')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove bold/italic
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove lists
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Clean up extra whitespace
      .replace(/\n{2,}/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  // Show loading state if no message data yet
  if (!latestMessage) {
    return (
      <div 
        data-testid="message-carousel" 
        className="h-16 overflow-hidden flex items-start"
      >
        <div className="text-zinc-500 text-sm font-mono">
          No assistant message yet
        </div>
      </div>
    )
  }

  const rawText = extractTextContent(latestMessage.data)

  // Use lastGoodText if current message has no text, but never show placeholder if we had text before
  const textToDisplay = rawText || lastGoodText

  // Only show placeholder if we've never had any text content
  if (!textToDisplay) {
    return (
      <div 
        data-testid="message-carousel" 
        className="h-16 overflow-hidden flex items-start"
      >
        <div className="text-zinc-500 text-sm font-mono">
          No assistant message yet
        </div>
      </div>
    )
  }

  const displayText = formatTextForPreview(textToDisplay)

  return (
    <div 
      data-testid="message-carousel" 
      className="relative h-16 overflow-hidden"
    >
      {/* Green indicator bar for new messages */}
      <div 
        className={clsx(
          "absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 transition-opacity duration-1000",
          hasNewMessage ? "opacity-100" : "opacity-0"
        )}
      />
      
      <div 
        className={clsx(
          "absolute inset-0 flex flex-col justify-start transition-all duration-300",
          hasNewMessage ? "pl-4" : "pl-0"
        )}
      >
        <div 
          key={messageKey}
          data-testid="message-item"
          className={clsx(
            "text-zinc-300 text-sm font-mono leading-5",
            hasNewMessage && "animate-fade-in"
          )}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {displayText}
        </div>
      </div>
    </div>
  )
}