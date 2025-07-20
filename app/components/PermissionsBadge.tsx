import { type PermissionMode } from '../types/settings'
import clsx from 'clsx'
import { typography } from '../constants/design'

interface PermissionsBadgeProps {
  mode: PermissionMode
  isUpdating?: boolean
}

const MODE_CONFIG = {
  plan: {
    label: 'Plan',
    color: 'text-emerald-400',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-700/50',
    description: 'Claude plans actions before executing'
  },
  acceptEdits: {
    label: 'Accept Edits',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-700/50',
    description: 'Automatically accept file edits'
  },
  bypassPermissions: {
    label: 'Bypass Perms',
    color: 'text-amber-400',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-700/50',
    description: 'Bypass all permission checks'
  }
}

export default function PermissionsBadge({ mode, isUpdating = false }: PermissionsBadgeProps) {
  const config = MODE_CONFIG[mode]
  
  const getAriaLabel = () => {
    const modeText = mode === 'acceptEdits' ? 'Accept Edits' : 
                     mode === 'bypassPermissions' ? 'Bypass Permissions' : 
                     'Plan'
    return `Permissions mode: ${modeText}`
  }
  
  return (
    <div 
      role="status"
      aria-label={getAriaLabel()}
      aria-live="polite"
      className={clsx(
        'flex items-center gap-2',
        'px-2.5 py-1',
        'rounded-md border',
        'transition-all duration-200',
        config.bgColor,
        config.borderColor,
        isUpdating && 'opacity-50'
      )}
    >
      <span className={clsx(
        'text-[11px]',
        typography.weight.normal,
        config.color,
        'tracking-wide',
        isUpdating && 'animate-pulse'
      )}>
        {config.label}
      </span>
      
      {isUpdating && (
        <span className={clsx('text-[11px]', 'text-zinc-600')}>
          Updating...
        </span>
      )}
      
      <span className={clsx(
        'text-[10px]',
        'text-zinc-600',
        'ml-0.5'
      )}>
        ⇧TAB
      </span>
    </div>
  )
}