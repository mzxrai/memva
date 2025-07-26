import { type PermissionMode } from '../types/settings'
import clsx from 'clsx'
import { typography, iconSize } from '../constants/design'
import { RiCheckLine } from 'react-icons/ri'

interface PermissionsBadgeProps {
  mode: PermissionMode
  isUpdating?: boolean
  isUpdated?: boolean
  isDisabled?: boolean
}

const MODE_CONFIG = {
  default: {
    label: 'Default',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-700/50',
    description: 'Standard behavior - prompts for permissions'
  },
  plan: {
    label: 'Plan',
    color: 'text-emerald-400',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-700/50',
    description: 'Agent plans actions before executing'
  },
  acceptEdits: {
    label: 'Accept Edits',
    color: 'text-blue-400',
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

export default function PermissionsBadge({ mode, isUpdating = false, isUpdated = false, isDisabled = false }: PermissionsBadgeProps) {
  const config = MODE_CONFIG[mode]
  
  const getAriaLabel = () => {
    const modeText = mode === 'default' ? 'Default' :
                     mode === 'acceptEdits' ? 'Accept Edits' : 
                     mode === 'bypassPermissions' ? 'Bypass Permissions' : 
                     'Plan'
    const disabledText = isDisabled ? ' (changes disabled during processing)' : ''
    return `Permissions mode: ${modeText}${disabledText}`
  }
  
  const getTooltip = () => {
    if (isDisabled) {
      return 'Cannot change permissions during active processing'
    }
    return config.description
  }
  
  return (
    <div 
      role="status"
      aria-label={getAriaLabel()}
      aria-live="polite"
      title={getTooltip()}
      className={clsx(
        'flex items-center gap-2',
        'px-2.5 py-1',
        'rounded-md border',
        'transition-all duration-200',
        config.bgColor,
        config.borderColor,
        isDisabled && 'cursor-not-allowed'
      )}
    >
      {isUpdating && (
        <div className={clsx(
          "w-2.5 h-2.5 border-2 rounded-full animate-spin",
          "border-zinc-600 border-t-zinc-400"
        )} />
      )}
      
      {!isUpdating && isUpdated && (
        <div className="text-emerald-400">
          <RiCheckLine className={iconSize.xs} />
        </div>
      )}
      
      <span className={clsx(
        'text-[11px]',
        typography.weight.normal,
        config.color,
        'tracking-wide',
        isDisabled && 'opacity-60'
      )}>
        {config.label}
      </span>
      
      <span className={clsx(
        'text-[10px]',
        'text-zinc-600',
        'ml-0.5',
        isDisabled && 'opacity-60'
      )}>
        ⇧TAB
      </span>
    </div>
  )
}