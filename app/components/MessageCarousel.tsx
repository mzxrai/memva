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
  const [animationKey, setAnimationKey] = useState(0)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const previousMessageRef = useRef<string>('')

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    
    const loadMessages = () => {
      try {
        // Demo messages for showcasing the fade animation
        const dummyMessages = [
          {
            uuid: 'dummy-1',
            session_id: 'dummy-session',
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
          },
          {
            uuid: 'dummy-2',
            session_id: 'dummy-session',
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
                content: [{ type: 'text', text: 'The tests are now passing. I fixed the async timing issue in the useEffect hook by properly handling the cleanup function and adding dependency arrays to prevent infinite re-renders.' }]
              }
            }
          },
          {
            uuid: 'dummy-3',
            session_id: 'dummy-session',
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
                content: [{ type: 'text', text: 'Here\'s the updated database schema with proper indexing for better performance. I\'ve added composite indexes on the most frequently queried columns and optimized the foreign key relationships.' }]
              }
            }
          },
          {
            uuid: 'dummy-4',
            session_id: 'dummy-session',
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
                content: [{ type: 'text', text: 'Successfully implemented the new authentication flow using NextAuth.js. The login and logout functionality is working correctly, and I\'ve added proper session management with JWT tokens.' }]
              }
            }
          }
        ]
        
        // Demo mode: cycle through messages with random timing
        let messageIndex = 0
        
        const scheduleNextMessage = () => {
          const randomDelay = Math.floor(Math.random() * 30 + 1) * 1000
          
          timeoutId = setTimeout(() => {
            const currentMsg = dummyMessages[messageIndex]
            const newMessageText = extractTextContent(currentMsg as Event)
            
            if (newMessageText !== previousMessageRef.current) {
              setIsInitialLoad(false)
              setCurrentMessage(currentMsg as Event)
              setAnimationKey(prev => prev + 1)
              previousMessageRef.current = newMessageText
            }
            
            messageIndex = (messageIndex + 1) % dummyMessages.length
            scheduleNextMessage()
          }, randomDelay)
        }
        
        // Set initial message without animation
        const initialMsg = dummyMessages[0]
        setCurrentMessage(initialMsg as Event)
        previousMessageRef.current = extractTextContent(initialMsg as Event)
        messageIndex = 1
        
        scheduleNextMessage()
      } catch (error) {
        console.error('Failed to load messages:', error)
        setCurrentMessage(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
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
        key={animationKey}
        className="absolute inset-0 flex flex-col justify-end"
        style={{
          animation: isInitialLoad ? 'none' : 'gentleFadeIn 3.0s cubic-bezier(0.25, 0.1, 0.25, 1)'
        }}
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
      
      <style>{`
        @keyframes gentleFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}