import { useEffect, useState, useCallback } from 'react'

type NewMessageData = {
  messageId: string
  timestamp: number
}

const STORAGE_KEY = 'memva_new_messages'
const EXPIRY_TIME = 5 * 60 * 1000 // 5 minutes in milliseconds

export function useNewMessageTracking(sessionId: string, latestMessageId?: string) {
  // Initialize state from localStorage
  const [hasNewMessage, setHasNewMessage] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return false
      
      const newMessages: Record<string, NewMessageData> = JSON.parse(stored)
      const sessionData = newMessages[sessionId]
      
      if (sessionData && latestMessageId && sessionData.messageId === latestMessageId) {
        // Check if not expired
        const now = Date.now()
        return now - sessionData.timestamp <= EXPIRY_TIME
      }
      return false
    } catch {
      return false
    }
  })
  
  // Sync with localStorage changes and check expiry
  useEffect(() => {
    const checkNewMessageStatus = () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        setHasNewMessage(false)
        return
      }
      
      try {
        const newMessages: Record<string, NewMessageData> = JSON.parse(stored)
        const sessionData = newMessages[sessionId]
        
        if (sessionData) {
          // Check if expired
          const now = Date.now()
          const age = now - sessionData.timestamp
          const isExpired = age > EXPIRY_TIME
          
          console.log(`[NewMessage] Session ${sessionId}: age=${Math.floor(age/1000)}s, expired=${isExpired}, messageId=${sessionData.messageId}, latestMessageId=${latestMessageId}`)
          
          if (isExpired) {
            // Expired, remove it
            delete newMessages[sessionId]
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages))
            setHasNewMessage(false)
          } else if (latestMessageId && sessionData.messageId === latestMessageId) {
            // Still valid and matches current message
            setHasNewMessage(true)
          } else {
            // Message ID doesn't match anymore
            setHasNewMessage(false)
          }
        } else {
          setHasNewMessage(false)
        }
      } catch (error) {
        console.error('Error reading new messages from localStorage:', error)
        setHasNewMessage(false)
      }
    }
    
    // Check immediately
    checkNewMessageStatus()
    
    // Re-check every 30 seconds to catch expirations
    const interval = setInterval(checkNewMessageStatus, 30 * 1000)
    
    // Listen for storage events (changes from other tabs or cleanup)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        checkNewMessageStatus()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [sessionId, latestMessageId])
  
  // Mark message as new
  const markAsNew = useCallback((messageId: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const newMessages: Record<string, NewMessageData> = stored ? JSON.parse(stored) : {}
      
      newMessages[sessionId] = {
        messageId,
        timestamp: Date.now()
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages))
      setHasNewMessage(true)
    } catch (error) {
      console.error('Error saving new message to localStorage:', error)
    }
  }, [sessionId])
  
  // Clear new message indicator
  const clearNewMessage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      
      const newMessages: Record<string, NewMessageData> = JSON.parse(stored)
      delete newMessages[sessionId]
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages))
      setHasNewMessage(false)
    } catch (error) {
      console.error('Error clearing new message from localStorage:', error)
    }
  }, [sessionId])
  
  // Clean up expired entries periodically
  useEffect(() => {
    const cleanupExpired = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return
        
        const newMessages: Record<string, NewMessageData> = JSON.parse(stored)
        const now = Date.now()
        let hasChanges = false
        
        Object.entries(newMessages).forEach(([id, data]) => {
          if (now - data.timestamp > EXPIRY_TIME) {
            delete newMessages[id]
            hasChanges = true
          }
        })
        
        if (hasChanges) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages))
        }
      } catch (error) {
        console.error('Error cleaning up expired messages:', error)
      }
    }
    
    // Run cleanup on mount and every 1 minute
    cleanupExpired()
    const interval = setInterval(cleanupExpired, 1 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  return {
    hasNewMessage,
    markAsNew,
    clearNewMessage
  }
}