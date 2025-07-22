import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FloatingPendingIndicatorProps {
  startTime?: number | null
  isVisible: boolean
}

const actionVerbs = [
  'Thinking',
  'Processing',
  'Analyzing',
  'Working',
  'Computing',
  'Crafting',
  'Building',
  'Pondering'
]

function formatElapsedTime(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  
  if (elapsed < 60) {
    return `${elapsed}s`
  }
  
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  return `${minutes}m ${seconds}s`
}

export function FloatingPendingIndicator({ startTime, isVisible }: FloatingPendingIndicatorProps) {
  const [currentVerb, setCurrentVerb] = useState(() => 
    actionVerbs[Math.floor(Math.random() * actionVerbs.length)]
  )
  const [elapsedTime, setElapsedTime] = useState('0s')

  // Update elapsed time every second
  useEffect(() => {
    if (!startTime) return

    const updateTime = () => {
      setElapsedTime(formatElapsedTime(startTime))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  // Change verb every 2-3 seconds
  useEffect(() => {
    const changeVerb = () => {
      setCurrentVerb(prev => {
        let newVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)]
        while (newVerb === prev && actionVerbs.length > 1) {
          newVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)]
        }
        return newVerb
      })
    }

    const getRandomInterval = () => 2000 + Math.random() * 1000

    const timeout = setTimeout(() => {
      changeVerb()
      const interval = setInterval(changeVerb, getRandomInterval())
      return () => clearInterval(interval)
    }, getRandomInterval())

    return () => clearTimeout(timeout)
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3"
        >
          <div className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/50 rounded-full px-4 py-2 flex items-center gap-3 shadow-lg">
            {/* Spinner */}
            <div className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            
            {/* Status text */}
            <div className="flex items-center gap-2 text-sm text-zinc-300 font-medium">
              <span className="animate-pulse">{currentVerb}...</span>
              {startTime && (
                <>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-400 font-mono text-xs">{elapsedTime}</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}