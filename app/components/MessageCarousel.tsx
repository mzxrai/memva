import { useState, useEffect, useRef } from 'react'
import type { AssistantEvent } from '../types/events'
import clsx from 'clsx'
import { useGreenLineIndicator } from '../hooks/useGreenLineIndicator'

interface MessageCarouselProps {
  sessionId: string
  latestMessage?: {
    uuid: string
    timestamp: string
    data: unknown
  } | null
}

export default function MessageCarousel({ sessionId, latestMessage }: MessageCarouselProps) {
  // Simple state for animation
  const [shouldAnimate, setShouldAnimate] = useState(false)
  
  // Track the previous message ID to detect changes
  const previousMessageId = useRef<string | undefined>(undefined)
  
  // Track which messages we've seen for this session
  const seenMessagesKey = `seenMessages-${sessionId}`
  
  // Use the new green line indicator hook
  const { isGreen, markAsGreen } = useGreenLineIndicator(sessionId, latestMessage?.uuid)
  
  // Handle new messages
  useEffect(() => {
    if (!latestMessage?.uuid) return
    
    // Check if this is a different message than before
    if (latestMessage.uuid !== previousMessageId.current) {
      // Get our list of seen messages with timestamps
      const storedData = localStorage.getItem(seenMessagesKey)
      const seenMessagesData: Array<{ uuid: string; timestamp: number }> = storedData 
        ? JSON.parse(storedData) 
        : []
      const seenMessages = new Set(seenMessagesData.map(item => item.uuid))
      
      // If we haven't seen this message before, handle it appropriately
      if (!seenMessages.has(latestMessage.uuid)) {
        console.log(`[MessageCarousel] New message detected: ${latestMessage.uuid}`)
        
        // Check if user is currently viewing this session
        const activeSession = localStorage.getItem('activeSession');
        const isUserViewingSession = activeSession === sessionId;
        
        // Only mark as green if user is NOT currently viewing this session
        if (!isUserViewingSession) {
          markAsGreen(latestMessage.uuid)
        }
        
        setShouldAnimate(true)
        setTimeout(() => setShouldAnimate(false), 300)
        
        // Add to seen messages with timestamp
        const updatedSeenMessages = [
          ...seenMessagesData.filter(item => item.uuid !== latestMessage.uuid),
          { uuid: latestMessage.uuid, timestamp: Date.now() }
        ]
        localStorage.setItem(seenMessagesKey, JSON.stringify(updatedSeenMessages))
      }
      
      previousMessageId.current = latestMessage.uuid
    }
  }, [latestMessage?.uuid, sessionId, markAsGreen, seenMessagesKey])
  
  // Cleanup old seen messages (older than 7 days)
  useEffect(() => {
    const cleanup = () => {
      try {
        const stored = localStorage.getItem(seenMessagesKey)
        if (!stored) return
        
        const seenMessagesData: Array<{ uuid: string; timestamp: number }> = JSON.parse(stored)
        const now = Date.now()
        const ONE_DAY = 24 * 60 * 60 * 1000
        
        // Filter out messages older than 24 hours
        const filtered = seenMessagesData.filter(item => 
          (now - item.timestamp) < ONE_DAY
        )
        
        // Only update localStorage if something was removed
        if (filtered.length !== seenMessagesData.length) {
          localStorage.setItem(seenMessagesKey, JSON.stringify(filtered))
          console.log(`[MessageCarousel] Cleaned up ${seenMessagesData.length - filtered.length} old messages`)
        }
      } catch (error) {
        console.error('[MessageCarousel] Error during cleanup:', error)
      }
    }
    
    // Run cleanup on mount and every minute
    cleanup()
    const interval = setInterval(cleanup, 60 * 1000)
    
    return () => clearInterval(interval)
  }, [seenMessagesKey])
  
  // Extract and format text content
  const extractTextContent = (data: unknown): string => {
    try {
      // Handle current data structure from Claude Code SDK
      if (typeof data === 'object' && data !== null && 'message' in data) {
        const dataWithMessage = data as { message: { type: string; role: string; content: Array<{ type: string; text: string }> } }
        if (dataWithMessage.message.type === 'message' && 
            dataWithMessage.message.role === 'assistant' && 
            dataWithMessage.message.content) {
          return dataWithMessage.message.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join(' ')
        }
      }
      
      // Legacy format for backwards compatibility
      const assistantData = data as AssistantEvent
      if (assistantData.type === 'assistant' && assistantData.message?.content) {
        return assistantData.message.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join(' ')
      }
      return ''
    } catch {
      return ''
    }
  }

  const formatTextForPreview = (text: string): string => {
    return text
      .replace(/```[\s\S]*?```/g, '[code block]')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image]')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      .replace(/\n{2,}/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  // Get text to display
  const rawText = latestMessage ? extractTextContent(latestMessage.data) : ''
  
  // Show placeholder if no text
  if (!rawText) {
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

  const displayText = formatTextForPreview(rawText)

  return (
    <div 
      data-testid="message-carousel" 
      className="relative h-16 overflow-hidden"
    >
      {/* Green indicator bar for new messages */}
      <div 
        className={clsx(
          "absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 transition-opacity duration-1000",
          isGreen ? "opacity-100" : "opacity-0"
        )}
      />
      
      <div 
        className={clsx(
          "absolute inset-0 flex flex-col justify-start transition-all duration-300",
          isGreen ? "pl-4" : "pl-0"
        )}
      >
        <div 
          key={latestMessage?.uuid}
          data-testid="message-item"
          className={clsx(
            "text-zinc-300 text-sm font-mono leading-5",
            shouldAnimate && "animate-fade-in"
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