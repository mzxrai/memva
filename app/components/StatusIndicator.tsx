import type { Session } from '../db/schema'
import clsx from 'clsx'

interface StatusIndicatorProps {
  session: Session & { pendingPermissionsCount?: number }
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
    dotColor: 'bg-emerald-500',
    pulse: true,
    dotClass: 'bg-emerald-500 animate-pulse',
  },
  approval_requested: {
    displayText: 'Approval Requested',
    dotColor: 'bg-amber-500',
    pulse: true,
    dotClass: 'bg-amber-500 animate-pulse',
  },
  waiting_for_input: {
    displayText: '',
    dotColor: '',
    dotClass: '',
  },
  completed: {
    displayText: '',
    dotColor: '',
    dotClass: '',
  },
  error: {
    displayText: 'Error',
    dotColor: 'bg-red-500',
    dotClass: 'bg-red-500',
  },
}

export default function StatusIndicator({ session }: StatusIndicatorProps) {
  let status = session.claude_status || 'not_started'
  
  // Override status to approval_requested if processing and has pending permissions
  if (status === 'processing' && session.pendingPermissionsCount && session.pendingPermissionsCount > 0) {
    status = 'approval_requested'
  }
  
  const config = STATUS_CONFIG[status] || {
    displayText: 'Unknown',
    dotColor: 'bg-zinc-400',
    dotClass: 'bg-zinc-400',
  }

  // Don't render anything for statuses without visual indicators
  if (!config.dotClass && !config.displayText && !config.badgeText) {
    return null
  }

  return (
    <div 
      role="status" 
      aria-label="Session status"
      aria-live="polite"
      className="flex items-center gap-2 text-sm"
    >
      {config.dotClass && (
        <div
          data-testid="status-dot"
          data-status={status === 'unknown_status' ? 'unknown' : status}
          data-pulse={config.pulse ? 'true' : 'false'}
          className={clsx(
            'w-2 h-2 rounded-full',
            config.dotClass
          )}
        />
      )}
      {(config.badgeText || config.displayText) && (
        <span className={clsx(
          'font-medium',
          status === 'error' ? 'text-red-500' : 
          status === 'processing' ? 'text-emerald-500' :
          status === 'approval_requested' ? 'text-amber-500' :
          'text-zinc-500'
        )}>
          {config.badgeText || config.displayText}
        </span>
      )}
    </div>
  )
}