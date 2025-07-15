import clsx from 'clsx'
import { useState, useEffect } from 'react'
import { RiSparklingLine } from 'react-icons/ri'
import { BaseEventWrapper } from './events/BaseEventWrapper'
import { MessageContainer } from './events/MessageContainer'
import { MessageHeader } from './events/MessageHeader'

interface PendingMessageProps {
  tokenCount?: number
  startTime?: number
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
  if (count < 1000) {
    return count.toString()
  }
  
  const k = count / 1000
  return `${k.toFixed(1)}k`
}

export function PendingMessage({ tokenCount = 0, startTime }: PendingMessageProps) {
  const [currentVerb, setCurrentVerb] = useState(() => 
    actionVerbs[Math.floor(Math.random() * actionVerbs.length)]
  )
  const [elapsedTime, setElapsedTime] = useState('0s')
  const [displayedTokenCount, setDisplayedTokenCount] = useState(0)

  // Animate token count smoothly
  useEffect(() => {
    const difference = tokenCount - displayedTokenCount
    if (difference === 0) return
    
    const stepDuration = Math.max(10, Math.min(50, 1000 / Math.abs(difference)))
    
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
  }, [tokenCount])

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
    <BaseEventWrapper>
      <MessageContainer>
        <MessageHeader icon={RiSparklingLine} title="Claude" />
        
        {/* Loading indicator content */}
        <div className="flex items-center text-sm text-zinc-400 font-mono">
          {/* Spinner */}
          <div className="w-4 h-4 mr-3 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          
          {/* Action verb */}
          <span className="mr-3 animate-pulse">
            {currentVerb.length > 15 ? currentVerb.substring(0, 15) + '...' : currentVerb + '...'}
          </span>
          
          {tokenCount > 0 && (
            <>
              <span className="text-zinc-500 mr-3">•</span>
              <span className="mr-3">
                {formatTokenCount(displayedTokenCount)} tokens
              </span>
            </>
          )}
          
          {startTime && (
            <>
              <span className="text-zinc-500 mr-3">•</span>
              <span>{elapsedTime}</span>
            </>
          )}
        </div>
      </MessageContainer>
    </BaseEventWrapper>
  )
}