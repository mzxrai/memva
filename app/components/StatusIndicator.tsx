import type { Session } from '../db/schema'
import clsx from 'clsx'

interface StatusIndicatorProps {
  session: Session
}

type StatusConfig = {
  displayText: string
  dotColor: string
  badgeText?: string
  pulse?: boolean
  dotClass: string
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  not_started: {
    displayText: '',
    dotColor: 'bg-zinc-400',
    dotClass: 'bg-zinc-400',
  },
  processing: {
    displayText: 'Working',
    dotColor: 'bg-blue-500',
    pulse: true,
    dotClass: 'bg-blue-500 animate-pulse',
  },
  waiting_for_input: {
    displayText: 'Ready',
    dotColor: 'bg-emerald-500',
    badgeText: 'Ready',
    dotClass: 'bg-emerald-500',
  },
  completed: {
    displayText: 'Ready',
    dotColor: 'bg-emerald-500',
    badgeText: 'Ready',
    dotClass: 'bg-emerald-500',
  },
  error: {
    displayText: 'Error',
    dotColor: 'bg-red-500',
    dotClass: 'bg-red-500',
  },
}

export default function StatusIndicator({ session }: StatusIndicatorProps) {
  const status = session.claude_status || 'not_started'
  const config = STATUS_CONFIG[status] || {
    displayText: 'Unknown',
    dotColor: 'bg-zinc-400',
    dotClass: 'bg-zinc-400',
  }

  return (
    <div 
      role="status" 
      aria-label="Session status"
      aria-live="polite"
      className="flex items-center gap-2 text-sm"
    >
      <div
        data-testid="status-dot"
        data-status={status === 'unknown_status' ? 'unknown' : status}
        data-pulse={config.pulse ? 'true' : 'false'}
        className={clsx(
          'w-2 h-2 rounded-full',
          config.dotClass
        )}
      />
      {(config.badgeText || config.displayText) && (
        <span className={clsx(
          'font-medium',
          status === 'error' ? 'text-red-500' : 
          status === 'processing' ? 'text-blue-500' :
          status === 'waiting_for_input' || status === 'completed' ? 'text-emerald-500' :
          'text-zinc-500'
        )}>
          {config.badgeText || config.displayText}
        </span>
      )}
    </div>
  )
}