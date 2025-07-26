import { useState, useEffect, useRef } from 'react'
import { RiLoader4Line, RiCheckboxCircleLine, RiArrowDownSLine } from 'react-icons/ri'
import clsx from 'clsx'
import { typography } from '../constants/design'
import { useEventStore } from '../stores/event-store'

interface ContextSummarizationSheetProps {
  isVisible: boolean
  onMinimize?: () => void
  onCancel?: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function getStatusMessage(elapsedSeconds: number): string {
  if (elapsedSeconds < 5) return 'Analyzing conversation history...'
  if (elapsedSeconds < 10) return 'Identifying key topics and context...'
  if (elapsedSeconds < 15) return 'Creating intelligent summary...'
  if (elapsedSeconds < 20) return 'Preserving important details...'
  if (elapsedSeconds < 25) return 'Finalizing context compression...'
  return 'Almost complete...'
}

export function ContextSummarizationSheet({ 
  isVisible, 
  onMinimize,
  onCancel 
}: ContextSummarizationSheetProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isMinimized, setIsMinimized] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()
  const startTimeRef = useRef<number>()
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  
  // Check if summarization completed
  const isSummarizationComplete = useEventStore(state => {
    const events = Array.from(state.events.values())
    const recentEvents = events.filter(e => 
      new Date(e.timestamp).getTime() > Date.now() - 5000 // Last 5 seconds
    )
    
    return recentEvents.some(e => {
      if (e.event_type !== 'system' || !e.data || typeof e.data !== 'object') return false
      const data = e.data as { subtype?: string }
      return data.subtype === 'context_summary'
    })
  })

  // Handle completion
  useEffect(() => {
    if (isVisible && isSummarizationComplete && !showSuccess) {
      setShowSuccess(true)
      // Hide success after 2 seconds
      successTimeoutRef.current = setTimeout(() => {
        setShowSuccess(false)
      }, 2000)
    }
  }, [isVisible, isSummarizationComplete, showSuccess])

  useEffect(() => {
    if (isVisible && !showSuccess) {
      // Start or resume timer
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now() - (elapsedTime * 1000)
      }
      
      intervalRef.current = setInterval(() => {
        const startTime = startTimeRef.current
        if (startTime) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000)
          setElapsedTime(elapsed)
        }
      }, 100)
    } else {
      // Stop timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (!isVisible) {
        // Reset state when hidden
        setElapsedTime(0)
        setIsMinimized(false)
        setShowSuccess(false)
        startTimeRef.current = undefined
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [isVisible, showSuccess, elapsedTime])

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
    onMinimize?.()
  }

  if (!isVisible) return null

  // Success state
  if (showSuccess) {
    return (
      <div className="fixed bottom-0 left-0 right-0 pb-44 z-40 pointer-events-none animate-in slide-in-from-bottom-10 duration-300">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="pointer-events-auto">
            <div className="bg-emerald-900/20 backdrop-blur-xl border border-emerald-800/30 rounded-2xl shadow-2xl p-4">
              <div className="flex items-center gap-3">
                <RiCheckboxCircleLine className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className={clsx(typography.size.sm, 'font-medium text-emerald-300')}>
                    Context optimized successfully
                  </p>
                  <p className={clsx(typography.size.xs, 'text-emerald-400/70 mt-0.5')}>
                    Your conversation continues below
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Minimized state - just a thin progress bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-0 left-0 right-0 pb-44 z-40 pointer-events-none">
        <div className="container mx-auto max-w-7xl px-4">
          <button
            onClick={handleMinimize}
            className="pointer-events-auto w-full group"
            aria-label="Expand summarization progress"
          >
            <div className="bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 rounded-t-lg shadow-2xl">
              <div className="h-1 bg-zinc-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0 w-1/3 animate-shimmer" />
              </div>
              <div className="px-4 py-2 flex items-center justify-between group-hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-2">
                  <RiLoader4Line className="w-3 h-3 text-amber-500 animate-spin" />
                  <span className={clsx(typography.size.xs, 'text-zinc-400')}>
                    Creating summary... {formatTime(elapsedTime)}
                  </span>
                </div>
                <RiArrowDownSLine className="w-4 h-4 text-zinc-500 rotate-180" />
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // Full state
  return (
    <div className="fixed bottom-0 left-0 right-0 pb-44 z-40 pointer-events-none animate-in slide-in-from-bottom-10 duration-300">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="pointer-events-auto">
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <RiLoader4Line className="w-4 h-4 text-amber-500 animate-spin" />
                  </div>
                  <div>
                    <h3 className={clsx(typography.size.sm, 'font-medium text-zinc-100')}>
                      Optimizing conversation context
                    </h3>
                    <p className={clsx(typography.size.xs, 'text-zinc-500 mt-0.5')}>
                      This typically takes 15-30 seconds
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleMinimize}
                  className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                  aria-label="Minimize"
                >
                  <RiArrowDownSLine className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-4">
              <div className="space-y-3">
                {/* Status message */}
                <p className={clsx(typography.size.sm, 'text-zinc-400')}>
                  {getStatusMessage(elapsedTime)}
                </p>

                {/* Progress visualization */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={clsx(typography.size.xs, 'text-zinc-500')}>
                      Processing
                    </span>
                    <span className={clsx(typography.size.xs, typography.font.mono, 'text-zinc-400')}>
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                  
                  {/* Animated progress bar */}
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0 w-1/3 animate-shimmer" />
                  </div>
                </div>

                {/* Additional info */}
                <div className="pt-2 flex items-center justify-between">
                  <p className={clsx(typography.size.xs, 'text-zinc-600')}>
                    Your conversation exceeded Claude's context limit
                  </p>
                  {onCancel && (
                    <button
                      onClick={onCancel}
                      className={clsx(
                        typography.size.xs,
                        'text-zinc-500 hover:text-zinc-400 transition-colors',
                        'px-2 py-1 rounded hover:bg-zinc-800/50'
                      )}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}