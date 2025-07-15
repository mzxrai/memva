import { type ReactNode, useState } from 'react'
import { CodeBlock } from './CodeBlock'
import { transition } from '../../constants/design'
import clsx from 'clsx'

interface BaseEventWrapperProps {
  children: ReactNode
  timestamp?: string
  uuid?: string
  eventType?: string
  className?: string
  rawEvent?: unknown
}

export function BaseEventWrapper({ 
  children, 
  className = "",
  rawEvent
}: BaseEventWrapperProps) {
  const [showRaw, setShowRaw] = useState(false)
  
  return (
    <div className={className}>
      <div className="px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-2 relative">
          {rawEvent !== undefined && (
            <button
              onClick={() => setShowRaw(!showRaw)}
              className={clsx(
                'absolute bottom-2 right-2 z-50',
                'p-1.5',
                showRaw ? 'text-zinc-300 hover:text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
                'hover:bg-zinc-800/50',
                'rounded',
                transition.fast
              )}
              aria-label={showRaw ? "Show rendered" : "Show raw JSON"}
              title={showRaw ? "Show rendered" : "Show raw JSON"}
            >
              {showRaw ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              )}
            </button>
          )}
          
          {showRaw ? (
            <CodeBlock
              code={JSON.stringify(rawEvent, null, 2)}
              language="json"
            />
          ) : (
            children
          )}
          </div>
        </div>
      </div>
    </div>
  )
}