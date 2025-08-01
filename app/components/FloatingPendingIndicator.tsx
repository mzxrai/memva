import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { typography } from '../constants/design'

interface FloatingPendingIndicatorProps {
  startTime?: number | null
  isVisible: boolean
  isTransitioning?: boolean
  isContextLimit?: boolean
}

const actionVerbs = [
  'Thinking',
  'Noodling',
  'Crafting',
  'Building',
  'Pondering',
  'Computing',
  'Analyzing',
  'Crunching',
  'Reasoning',
  'Wrangling',
  'Churning',
  'Processing',
  'Cogitating',
  'Ruminating',
  'Unraveling',
  'Dissecting',
  'Untangling',
  'Evaluating',
  'Calculating',
  'Percolating',
  'Deciphering',
  'Considering',
  'Formulating',
  'Synthesizing'
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

export function FloatingPendingIndicator({ startTime, isVisible, isTransitioning, isContextLimit }: FloatingPendingIndicatorProps) {
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
          className="absolute bottom-full left-0 mb-3"
        >
          <div className={clsx(
            'flex items-center gap-2',
            'px-2.5 py-1',
            'rounded-md border',
            isContextLimit ? 'bg-amber-900/30' : isTransitioning ? 'bg-amber-900/30' : 'bg-zinc-800/50',
            isContextLimit ? 'border-amber-700/50' : isTransitioning ? 'border-amber-700/50' : 'border-zinc-700/50',
            'backdrop-blur-sm',
            'transition-all duration-300 ease-in-out'
          )}>
            {/* Spinner */}
            <div className={clsx(
              "w-2.5 h-2.5 border-2 rounded-full animate-spin",
              isContextLimit || isTransitioning 
                ? "border-amber-600 border-t-amber-400" 
                : "border-zinc-600 border-t-zinc-400"
            )} />
            
            {/* Status text */}
            <span className={clsx(
              'text-[11px]',
              typography.weight.normal,
              isContextLimit ? 'text-amber-400' : 'text-zinc-400',
              'tracking-wide',
              'animate-pulse',
              'inline-block',
              isContextLimit ? 'w-48' : isTransitioning ? 'w-60' : 'w-24', // Different widths for different states
              'truncate'
            )}>
              {isContextLimit 
                ? 'Handling context limit...' 
                : isTransitioning 
                  ? 'Updating current session with new mode' 
                  : `${currentVerb}...`}
            </span>
            
            {startTime && (
              <span className={clsx(
                'text-[10px]',
                'text-zinc-600',
                'whitespace-nowrap'
              )}>
                {elapsedTime}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}