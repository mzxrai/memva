import { type ReactNode } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface BaseEventWrapperProps {
  children: ReactNode
  timestamp?: string
  uuid?: string
  eventType?: string
  className?: string
}

export function BaseEventWrapper({ 
  children, 
  timestamp, 
  uuid, 
  eventType,
  className = ""
}: BaseEventWrapperProps) {
  return (
    <div className={`px-4 ${className}`}>
      <div className="container mx-auto max-w-7xl">
        <div className="mb-4 group">
          {/* Optional metadata header */}
          {(timestamp || uuid || eventType) && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {eventType && (
                <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-400 font-mono">
                  {eventType}
                </span>
              )}
              {timestamp && (
                <span className="font-mono">
                  {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                </span>
              )}
              {uuid && (
                <span className="font-mono text-zinc-600 truncate max-w-24">
                  {uuid.slice(0, 8)}...
                </span>
              )}
            </div>
          )}
          
          {/* Event content */}
          {children}
        </div>
      </div>
    </div>
  )
}