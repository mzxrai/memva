import { useState, useEffect } from 'react'
import { getRecentAssistantMessages } from '../db/event-session.service'
import type { Event } from '../db/schema'
import type { AssistantEvent } from '../types/events'

interface MessageCarouselProps {
  sessionId: string
  maxMessages?: number
}

export default function MessageCarousel({ sessionId, maxMessages = 3 }: MessageCarouselProps) {
  const [messages, setMessages] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const recentMessages = await getRecentAssistantMessages(sessionId, maxMessages)
        setMessages(recentMessages)
      } catch (error) {
        console.error('Failed to load messages:', error)
        setMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
  }, [sessionId, maxMessages])

  const extractTextContent = (event: Event): string => {
    try {
      const assistantEvent = event.data as AssistantEvent
      const textContent = assistantEvent.message.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join(' ')
      
      // Truncate to fit one line (approximately 60 characters for terminal style)
      return textContent.length > 60 
        ? textContent.substring(0, 60) + '...'
        : textContent
    } catch {
      return 'Message content unavailable'
    }
  }

  if (isLoading) {
    return (
      <div 
        data-testid="message-carousel" 
        className="h-16 overflow-hidden flex flex-col justify-end space-y-1"
      >
        <div className="h-4 bg-zinc-900/30 rounded animate-pulse" />
        <div className="h-4 bg-zinc-900/30 rounded animate-pulse" />
        <div className="h-4 bg-zinc-900/30 rounded animate-pulse" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div 
        data-testid="message-carousel" 
        className="h-16 overflow-hidden flex items-center justify-center text-zinc-500 text-sm"
      >
        No assistant messages yet
      </div>
    )
  }

  return (
    <div 
      data-testid="message-carousel" 
      className="h-16 overflow-hidden flex flex-col justify-end space-y-1"
    >
      {messages.slice(0, 3).map((message, index) => (
        <div
          key={message.uuid}
          data-testid="message-item"
          className="text-zinc-300 text-sm leading-relaxed animate-in slide-in-from-bottom-2 duration-300"
          style={{
            animationDelay: `${index * 100}ms`
          }}
        >
          {extractTextContent(message)}
        </div>
      ))}
    </div>
  )
}