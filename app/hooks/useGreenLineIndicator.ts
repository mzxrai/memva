import { useState, useEffect, useCallback } from 'react'

type GreenMessage = {
  expiresAt: number
  sessionId: string
}

type GreenMessages = Record<string, GreenMessage>

const STORAGE_KEY = 'memva_green_messages'
const EXPIRY_TIME = 30 * 60 * 1000 // 30 minutes in milliseconds

// Simple hook for managing green line indicators on new messages
export function useGreenLineIndicator(sessionId: string, messageId?: string) {
  const [isGreen, setIsGreen] = useState(false)
  
  // Check if the current message should be green
  useEffect(() => {
    if (!messageId) {
      setIsGreen(false)
      return
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        setIsGreen(false)
        return
      }
      
      const greenMessages: GreenMessages = JSON.parse(stored)
      const messageData = greenMessages[messageId]
      
      if (!messageData || messageData.sessionId !== sessionId) {
        setIsGreen(false)
        return
      }
      
      // Check if expired
      const now = Date.now()
      if (now > messageData.expiresAt) {
        // Clean up expired entry
        delete greenMessages[messageId]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(greenMessages))
        setIsGreen(false)
      } else {
        setIsGreen(true)
      }
    } catch (error) {
      console.error('[useGreenLineIndicator] Error reading from localStorage:', error)
      setIsGreen(false)
    }
  }, [messageId, sessionId])
  
  // Mark a message as green (new)
  const markAsGreen = useCallback((newMessageId: string) => {
    if (!newMessageId) return
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const greenMessages: GreenMessages = stored ? JSON.parse(stored) : {}
      
      // Add the new message with expiry
      greenMessages[newMessageId] = {
        expiresAt: Date.now() + EXPIRY_TIME,
        sessionId
      }
      
      // Clean up any expired entries while we're at it
      const now = Date.now()
      Object.entries(greenMessages).forEach(([id, data]) => {
        if (now > data.expiresAt) {
          delete greenMessages[id]
        }
      })
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(greenMessages))
      
      // Update state if this is our current message
      if (newMessageId === messageId) {
        setIsGreen(true)
      }
    } catch (error) {
      console.error('[useGreenLineIndicator] Error writing to localStorage:', error)
    }
  }, [sessionId, messageId])
  
  // Run cleanup periodically (every minute)
  useEffect(() => {
    const cleanup = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return
        
        const greenMessages: GreenMessages = JSON.parse(stored)
        const now = Date.now()
        let hasChanges = false
        
        Object.entries(greenMessages).forEach(([id, data]) => {
          if (now > data.expiresAt) {
            delete greenMessages[id]
            hasChanges = true
          }
        })
        
        if (hasChanges) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(greenMessages))
        }
      } catch (error) {
        console.error('[useGreenLineIndicator] Error during cleanup:', error)
      }
    }
    
    // Run cleanup on mount and every minute
    cleanup()
    const interval = setInterval(cleanup, 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Listen for storage changes (from other tabs/windows)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && messageId) {
        // Re-check if our message is green
        try {
          const newValue = e.newValue
          if (!newValue) {
            setIsGreen(false)
            return
          }
          
          const greenMessages: GreenMessages = JSON.parse(newValue)
          const messageData = greenMessages[messageId]
          
          if (!messageData || messageData.sessionId !== sessionId) {
            setIsGreen(false)
          } else if (Date.now() > messageData.expiresAt) {
            setIsGreen(false)
          } else {
            setIsGreen(true)
          }
        } catch {
          setIsGreen(false)
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [messageId, sessionId])
  
  // Clear all green messages for a specific session
  const clearGreenForSession = useCallback((sessionToClear: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      
      const greenMessages: GreenMessages = JSON.parse(stored)
      let hasChanges = false
      
      // Remove all messages for this session
      Object.entries(greenMessages).forEach(([id, data]) => {
        if (data.sessionId === sessionToClear) {
          delete greenMessages[id]
          hasChanges = true
          
          // Update state if we cleared our current message
          if (id === messageId) {
            setIsGreen(false)
          }
        }
      })
      
      if (hasChanges) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(greenMessages))
      }
    } catch (error) {
      console.error('[useGreenLineIndicator] Error clearing green messages:', error)
    }
  }, [messageId])
  
  return {
    isGreen,
    markAsGreen,
    clearGreenForSession
  }
}