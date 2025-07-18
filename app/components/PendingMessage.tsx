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
        <div className="inline-grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 text-sm text-zinc-400 font-mono" style={{ gridTemplateColumns: 'auto clamp(5rem, 15vw, 8rem) auto auto auto auto' }}>
          {/* Spinner */}
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          
          {/* Action verb with ellipsis - responsive fixed width */}
          <div className="overflow-hidden flex items-center">
            <span className="animate-pulse truncate">{currentVerb}...</span>
          </div>
          
          {/* Separator */}
          <span className="text-zinc-500">
            {tokenCount > 0 ? '•' : ''}
          </span>
          
          {/* Token count */}
          <span className="whitespace-nowrap">
            {tokenCount > 0 ? `${formatTokenCount(displayedTokenCount)} tokens` : ''}
          </span>
          
          {/* Separator */}
          <span className="text-zinc-500">
            {startTime ? '•' : ''}
          </span>
          
          {/* Elapsed time */}
          <span className="whitespace-nowrap">
            {startTime ? elapsedTime : ''}
          </span>
        </div>
      </MessageContainer>
    </BaseEventWrapper>
  )
}