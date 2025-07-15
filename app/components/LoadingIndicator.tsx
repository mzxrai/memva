import { useState, useEffect } from 'react'
import { colors, typography, transition } from '../constants/design'
import clsx from 'clsx'

interface LoadingIndicatorProps {
  tokenCount: number
  startTime: number
  isLoading?: boolean
}

const actionVerbs = [
  'Crunching',
  'Pondering',
  'Contemplating',
  'Cogitating',
  'Ruminating',
  'Deliberating',
  'Noodling',
  'Percolating',
  'Brewing',
  'Vibing',
  'Processing',
  'Computing',
  'Calculating',
  'Analyzing',
  'Synthesizing',
  'Fibberglibbiting',
  'Mulling over',
  'Puzzling through',
  'Deciphering',
  'Unraveling',
  'Dissecting',
  'Churning through',
  'Sifting through',
  'Wrangling',
  'Untangling'
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

function formatTokenCount(count: number): string {
  return count.toLocaleString()
}

export function LoadingIndicator({ tokenCount, startTime, isLoading = true }: LoadingIndicatorProps) {
  const [currentVerb, setCurrentVerb] = useState(() => 
    actionVerbs[Math.floor(Math.random() * actionVerbs.length)]
  )
  const [elapsedTime, setElapsedTime] = useState('0s')
  const [displayedTokenCount, setDisplayedTokenCount] = useState(0)

  // Animate token count smoothly
  useEffect(() => {
    if (!isLoading) return

    const difference = tokenCount - displayedTokenCount
    if (difference === 0) return
    
    // Animate by incrementing 1 token at a time
    const stepDuration = Math.max(10, Math.min(50, 1000 / Math.abs(difference))) // Between 10ms and 50ms per step
    
    const interval = setInterval(() => {
      setDisplayedTokenCount(prev => {
        if (prev === tokenCount) {
          clearInterval(interval)
          return prev
        }
        
        if (prev < tokenCount) {
          return prev + 1
        } else {
          return prev - 1
        }
      })
    }, stepDuration)
    
    return () => clearInterval(interval)
  }, [tokenCount, isLoading])

  // Update elapsed time every second
  useEffect(() => {
    if (!isLoading) return

    const updateTime = () => {
      setElapsedTime(formatElapsedTime(startTime))
    }

    updateTime() // Initial update
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [startTime, isLoading])

  // Change verb every 2-3 seconds
  useEffect(() => {
    if (!isLoading) return

    const changeVerb = () => {
      setCurrentVerb(prev => {
        let newVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)]
        // Make sure we don't get the same verb twice in a row
        while (newVerb === prev && actionVerbs.length > 1) {
          newVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)]
        }
        return newVerb
      })
    }

    // Change after 2-3 seconds randomly
    const getRandomInterval = () => 2000 + Math.random() * 1000

    const timeout = setTimeout(() => {
      changeVerb()
      // Set up recurring changes
      const interval = setInterval(changeVerb, getRandomInterval())
      
      // Store interval ID for cleanup
      return () => clearInterval(interval)
    }, getRandomInterval())

    return () => clearTimeout(timeout)
  }, [isLoading])

  if (!isLoading) return null

  return (
    <div
      data-testid="loading-indicator"
      className={clsx(
        'inline-flex items-center',
        'text-sm',
        transition.normal,
        'animate-fade-in'
      )}
    >
      {/* Pulsating star */}
      <span className={clsx(
        'text-zinc-400',
        'inline-block',
        'animate-smooth-pulse',
        'mr-3'
      )}>
        ✧
      </span>

      {/* Action verb - fixed width container */}
      <div className="w-36 mr-3">
        <span className={clsx(
          colors.text.secondary,
          typography.font.mono,
          typography.size.sm,
          'block whitespace-nowrap overflow-hidden',
          'animate-pulse'
        )}>
          {currentVerb.length > 15 ? currentVerb.substring(0, 15) + '...' : currentVerb + '...'}
        </span>
      </div>

      {/* Separator */}
      <span className={clsx(
        colors.text.tertiary,
        typography.size.sm,
        'mr-3'
      )}>
        •
      </span>

      {/* Token count - fixed width container */}
      <div className="w-24 mr-3 text-center">
        <span className={clsx(
          typography.font.mono,
          typography.size.sm,
          colors.text.secondary,
          'block'
        )}>
          {formatTokenCount(displayedTokenCount)} tokens
        </span>
      </div>

      {/* Separator */}
      <span className={clsx(
        colors.text.tertiary,
        typography.size.sm,
        'mr-3'
      )}>
        •
      </span>

      {/* Elapsed time */}
      <span className={clsx(
        typography.font.mono,
        typography.size.sm,
        colors.text.secondary
      )}>
        {elapsedTime}
      </span>
    </div>
  )
}