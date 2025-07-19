import { useEffect, useState, useCallback } from 'react'

type NewMessageData = {
  messageId: string
  timestamp: number
}

type ClearedMessageData = {
  messageId: string
  clearedAt: number
}


const STORAGE_KEY = 'memva_new_messages'
const CLEARED_KEY = 'memva_cleared_messages'
const EXPIRY_TIME = 5 * 60 * 1000 // 5 minutes in milliseconds

// Global cleanup to prevent running it multiple times per component
let globalCleanupInterval: ReturnType<typeof setInterval> | null = null
let cleanupInstanceCount = 0

const startGlobalCleanup = () => {
  cleanupInstanceCount++
  
  if (globalCleanupInterval) return // Already running
  
  const cleanupExpired = () => {
    console.log('🧹 Running global cleanup...')
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const newMessages: Record<string, NewMessageData> = JSON.parse(stored)
        const now = Date.now()
        let hasChanges = false
        
        Object.entries(newMessages).forEach(([id, data]) => {
          if (now - data.timestamp > EXPIRY_TIME) {
            console.log(`🧹 Removing expired new message: ${id}`)
            delete newMessages[id]
            hasChanges = true
          }
        })
        
        if (hasChanges) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages))
        }
      }
      
      // Also clean up expired cleared messages
      const clearedStored = localStorage.getItem(CLEARED_KEY)
      if (clearedStored) {
        const clearedMessages = JSON.parse(clearedStored) as ClearedMessageData[]
        const beforeCount = clearedMessages.length
        const now = Date.now()
        const unexpiredCleared = clearedMessages.filter(item => 
          (now - item.clearedAt) <= EXPIRY_TIME
        )
        
        if (unexpiredCleared.length !== clearedMessages.length) {
          console.log(`🧹 Removing ${beforeCount - unexpiredCleared.length} expired cleared messages`)
          localStorage.setItem(CLEARED_KEY, JSON.stringify(unexpiredCleared))
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired messages:', error)
    }
  }
  
  // Run cleanup immediately and every 1 minute
  cleanupExpired()
  globalCleanupInterval = setInterval(cleanupExpired, 1 * 60 * 1000)
}

const stopGlobalCleanup = () => {
  cleanupInstanceCount--
  
  if (cleanupInstanceCount <= 0 && globalCleanupInterval) {
    clearInterval(globalCleanupInterval)
    globalCleanupInterval = null
    cleanupInstanceCount = 0
  }
}

export function useNewMessageTracking(sessionId: string, latestMessageId?: string) {
  // Initialize state from localStorage
  const [hasNewMessage, setHasNewMessage] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return false
      
      const newMessages: Record<string, NewMessageData> = JSON.parse(stored)
      const sessionData = newMessages[sessionId]
      
      if (sessionData) {
        // Check if not expired
        const now = Date.now()
        const notExpired = now - sessionData.timestamp <= EXPIRY_TIME
        
        // Only show as new if we have a latestMessageId AND it matches the stored one
        return notExpired && latestMessageId && sessionData.messageId === latestMessageId
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
          
          
          if (isExpired) {
            // Expired, remove it
            delete newMessages[sessionId]
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages))
            setHasNewMessage(false)
          } else {
            // Only show as new if we have a latestMessageId AND it matches the stored one
            const shouldShowAsNew = latestMessageId && sessionData.messageId === latestMessageId
            setHasNewMessage(shouldShowAsNew)
          }
        } else {
          // No session data in localStorage means no new message
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
      // Check if this message was already cleared (and not expired)
      const clearedData = JSON.parse(localStorage.getItem(CLEARED_KEY) || '[]') as ClearedMessageData[]
      const now = Date.now()
      const wasRecentlyCleared = clearedData.some(item => 
        item.messageId === messageId && (now - item.clearedAt) <= EXPIRY_TIME
      )
      
      if (wasRecentlyCleared) {
        return
      }
      
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
      const messageData = newMessages[sessionId]
      
      delete newMessages[sessionId]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages))
      
      // Also add to cleared list to prevent re-marking
      if (messageData) {
        const cleared = JSON.parse(localStorage.getItem(CLEARED_KEY) || '[]') as ClearedMessageData[]
        cleared.push({
          messageId: messageData.messageId,
          clearedAt: Date.now()
        })
        localStorage.setItem(CLEARED_KEY, JSON.stringify(cleared))
      }
      
      setHasNewMessage(false)
    } catch (error) {
      console.error('Error clearing new message from localStorage:', error)
    }
  }, [sessionId])
  
  // Start global cleanup when hook is used
  useEffect(() => {
    startGlobalCleanup()
    return () => stopGlobalCleanup()
  }, [])
  
  return {
    hasNewMessage,
    markAsNew,
    clearNewMessage
  }
}