import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'memvaSessionActivity'
const ACTIVITY_UPDATE_INTERVAL = 1000 // Update activity every second
const OLD_MESSAGE_THRESHOLD = 24 * 60 * 60 * 1000 // 24 hours

interface SessionActivity {
  [sessionId: string]: number // timestamp of last activity
}

function getActivity(): SessionActivity {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function setActivity(activity: SessionActivity) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activity))
  } catch (error) {
    console.error('[SessionActivity] Error saving to localStorage:', error)
  }
}

// Hook for message carousel to check if messages should be green
export function useMessageTracking(sessionId: string, messageId?: string, messageTimestamp?: string) {
  const [isGreen, setIsGreen] = useState(false)
  
  // Check if message should be green based on session activity
  useEffect(() => {
    if (!messageId || !messageTimestamp) {
      setIsGreen(false)
      return
    }
    
    const activity = getActivity()
    const lastActivity = activity[sessionId]
    const messageTime = new Date(messageTimestamp).getTime()
    const now = Date.now()
    
    // Message is green if:
    // 1. We have no activity record for this session (never visited)
    // 2. OR message is newer than last activity
    // AND message is not older than 24 hours
    const isNewer = !lastActivity || messageTime > lastActivity
    const isRecent = (now - messageTime) < OLD_MESSAGE_THRESHOLD
    
    setIsGreen(isNewer && isRecent)
  }, [sessionId, messageId, messageTimestamp])
  
  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && messageId && messageTimestamp) {
        // Re-evaluate green status
        const activity = getActivity()
        const lastActivity = activity[sessionId]
        const messageTime = new Date(messageTimestamp).getTime()
        const now = Date.now()
        
        const isNewer = !lastActivity || messageTime > lastActivity
        const isRecent = (now - messageTime) < OLD_MESSAGE_THRESHOLD
        
        setIsGreen(isNewer && isRecent)
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [sessionId, messageId, messageTimestamp])
  
  return { isGreen }
}

// Hook for session detail page to track user activity
export function useSessionActivity(sessionId: string) {
  const lastUpdateRef = useRef<number>(0)
  const lastInteractionRef = useRef<number>(Date.now())
  
  // Update activity timestamp periodically while user is active
  useEffect(() => {
    if (!sessionId) return
    
    // Update activity timestamp
    const updateActivity = () => {
      const now = Date.now()
      
      // Only update if tab is visible (not hidden)
      const isTabVisible = !document.hidden
      
      if (!isTabVisible) {
        return
      }
      
      // Throttle updates to avoid hammering localStorage
      if (now - lastUpdateRef.current < ACTIVITY_UPDATE_INTERVAL) return
      
      const activity = getActivity()
      activity[sessionId] = now
      setActivity(activity)
      lastUpdateRef.current = now
    }
    
    // Initial update
    updateActivity()
    
    // Track user interactions
    const handleInteraction = () => {
      lastInteractionRef.current = Date.now()
      updateActivity()
    }
    
    // Update periodically while tab is visible
    const interval = setInterval(() => {
      updateActivity()
    }, ACTIVITY_UPDATE_INTERVAL)
    
    // Listen for interaction events
    document.addEventListener('mousemove', handleInteraction)
    document.addEventListener('keypress', handleInteraction)
    document.addEventListener('click', handleInteraction)
    document.addEventListener('scroll', handleInteraction)
    document.addEventListener('touchstart', handleInteraction)
    
    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab just became visible, update activity
        lastInteractionRef.current = Date.now() // Reset interaction time
        updateActivity()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Handle focus events (user switching between windows)
    const handleFocus = () => {
      lastInteractionRef.current = Date.now()
      updateActivity()
    }
    window.addEventListener('focus', handleFocus)
    
    // Cleanup
    return () => {
      clearInterval(interval)
      document.removeEventListener('mousemove', handleInteraction)
      document.removeEventListener('keypress', handleInteraction)
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('scroll', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [sessionId])
}