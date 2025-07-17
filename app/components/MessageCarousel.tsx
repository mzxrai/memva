import { useState, useEffect, useRef } from 'react'
import type { Event } from '../db/schema'
import type { AssistantEvent } from '../types/events'

interface MessageCarouselProps {
  sessionId: string
  maxMessages?: number
}

export default function MessageCarousel({ sessionId }: MessageCarouselProps) {
  const [currentMessage, setCurrentMessage] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const previousMessageRef = useRef<string>('')

  useEffect(() => {
    const loadMessages = () => {
      try {
        // Static demo message
        const demoMessage = {
          uuid: 'demo-message',
          session_id: 'demo-session',
          event_type: 'assistant',
          timestamp: new Date().toISOString(),
          is_sidechain: false,
          parent_uuid: null,
          cwd: '/test',
          project_name: 'test-project',
          memva_session_id: sessionId,
          data: {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'I\'ll help you refactor that React component to use modern hooks instead of class components. Let me start by analyzing the current structure and identifying the key state and lifecycle methods that need to be converted.' }]
            }
          }
        }
        
        // Set static message without animation
        setCurrentMessage(demoMessage as Event)
        previousMessageRef.current = extractTextContent(demoMessage as Event)
      } catch (error) {
        console.error('Failed to load messages:', error)
        setCurrentMessage(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
  }, [sessionId])

  const extractTextContent = (event: Event): string => {
    try {
      const assistantEvent = event.data as AssistantEvent
      const textContent = assistantEvent.message.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join(' ')
      
      return textContent
    } catch {
      return 'Message content unavailable'
    }
  }

  const formatTextForDisplay = (text: string): string => {
    return text
  }

  if (isLoading) {
    return (
      <div 
        data-testid="message-carousel" 
        className="h-16 overflow-hidden flex flex-col justify-end space-y-1"
      >
        <div className="h-4 bg-zinc-800/40 rounded-sm animate-pulse" />
        <div className="h-4 bg-zinc-800/40 rounded-sm animate-pulse w-4/5" />
        <div className="h-4 bg-zinc-800/40 rounded-sm animate-pulse w-3/5" />
      </div>
    )
  }

  if (!currentMessage) {
    return (
      <div 
        data-testid="message-carousel" 
        className="h-16 overflow-hidden flex items-center"
      >
        <div className="text-zinc-500 text-sm font-mono">
          No messages yet
        </div>
      </div>
    )
  }

  const displayText = formatTextForDisplay(extractTextContent(currentMessage))

  return (
    <div 
      data-testid="message-carousel" 
      className="relative h-16 overflow-hidden"
    >
      <div 
        className="absolute inset-0 flex flex-col justify-end"
      >
        <div 
          data-testid="message-item"
          className="text-zinc-300 text-sm font-mono leading-5"
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