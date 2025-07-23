import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { colors, typography, transition, iconSize } from '../constants/design'
import { RiCheckLine, RiCloseLine, RiSettingsLine } from 'react-icons/ri'
import clsx from 'clsx'
import { type Settings, type PermissionMode } from '../utils/settings'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'global' | 'session'
  sessionId?: string
  onSettingsChange?: (settings: Settings) => void
}

const PERMISSION_MODES: Array<{ value: PermissionMode; label: string; description: string }> = [
  { 
    value: 'default', 
    label: 'Default', 
    description: 'Standard behavior - prompts for permission on first use of each tool' 
  },
  { 
    value: 'acceptEdits', 
    label: 'Accept Edits', 
    description: 'Automatically accept file edits without prompts' 
  },
  { 
    value: 'bypassPermissions', 
    label: 'Bypass Permissions', 
    description: 'Bypass all permission checks (use with caution)' 
  },
  { 
    value: 'plan', 
    label: 'Plan Mode', 
    description: 'Agent plans actions before executing them' 
  }
]

export default function SettingsModal({
  isOpen,
  onClose,
  mode = 'global',
  sessionId,
  onSettingsChange
}: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>({ maxTurns: 200, permissionMode: 'acceptEdits' })
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(false)
  const [maxTurnsInput, setMaxTurnsInput] = useState('200')
  const [maxTurnsError, setMaxTurnsError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setIsInitialLoad(true)
      const endpoint = mode === 'session' && sessionId 
        ? `/api/session/${sessionId}/settings`
        : '/api/settings'
      
      fetch(endpoint)
        .then(res => res.json())
        .then(data => {
          setSettings(data)
          setMaxTurnsInput(data.maxTurns.toString())
          setMaxTurnsError(null)
          setIsSaved(false)
        })
        .catch(err => {
          console.error('Failed to load settings:', err)
        })
        .finally(() => {
          setIsLoading(false)
          setIsInitialLoad(false)
        })
    }
  }, [isOpen, mode, sessionId])

  // Focus modal when it opens
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus()
    }
  }, [isOpen])

  const validateMaxTurns = (value: string): boolean => {
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      setMaxTurnsError('Please enter a valid number')
      return false
    }
    if (num < 1) {
      setMaxTurnsError('Must be at least 1')
      return false
    }
    if (num > 1000) {
      setMaxTurnsError('Must be 1000 or less')
      return false
    }
    setMaxTurnsError(null)
    return true
  }

  const handleMaxTurnsChange = (value: string) => {
    setMaxTurnsInput(value)
    setIsSaved(false)
    
    if (value && validateMaxTurns(value)) {
      setSettings(prev => ({ ...prev, maxTurns: parseInt(value, 10) }))
    }
  }

  const handlePermissionModeChange = (mode: PermissionMode) => {
    setSettings(prev => ({ ...prev, permissionMode: mode }))
    setIsSaved(false)
  }

  const handleSave = async () => {
    if (validateMaxTurns(maxTurnsInput)) {
      setIsLoading(true)
      try {
        const endpoint = mode === 'session' && sessionId 
          ? `/api/session/${sessionId}/settings`
          : '/api/settings'
        
        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        })
        
        if (response.ok) {
          setIsSaved(true)
          // Call the callback if provided
          if (onSettingsChange) {
            onSettingsChange(settings)
          }
          // Auto-close after a short delay
          setTimeout(() => {
            onClose()
          }, 500)
        } else {
          const error = await response.json()
          console.error('Failed to save settings:', error)
        }
      } catch (err) {
        console.error('Failed to save settings:', err)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault()
      handleSave()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        className={clsx(
          'relative z-10 w-full max-w-2xl',
          colors.background.secondary,
          colors.border.default,
          'border rounded-xl shadow-2xl',
          'p-6',
          'outline-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <RiSettingsLine className={clsx(iconSize.md, colors.text.secondary)} />
            <h2 
              id="settings-modal-title"
              className={clsx(typography.size.lg, typography.weight.semibold, colors.text.primary)}
            >
              {mode === 'session' ? 'Session settings' : 'Default settings for new sessions'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              'p-2 rounded-lg',
              colors.text.secondary,
              colors.background.hover,
              transition.fast
            )}
            aria-label="Close dialog"
          >
            <RiCloseLine className={iconSize.md} />
          </button>
        </div>

        {/* Settings Form */}
        {isInitialLoad ? (
          <div className="space-y-6">
            {/* Helper Text Skeleton for Global Mode */}
            {mode === 'global' && (
              <div className="h-5 bg-zinc-800 rounded animate-pulse w-3/4 mb-2" />
            )}
            
            {/* Max Turns Skeleton */}
            <div>
              <div className="h-5 bg-zinc-800 rounded animate-pulse w-20 mb-2" />
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-64 mb-3" />
              <div className="h-10 bg-zinc-800 rounded-lg animate-pulse w-32" />
            </div>
            
            {/* Permission Mode Skeleton */}
            <div>
              <div className="h-5 bg-zinc-800 rounded animate-pulse w-32 mb-2" />
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-80 mb-3" />
              <div className="space-y-2">
                <div className="h-20 bg-zinc-800 rounded-lg animate-pulse" />
                <div className="h-20 bg-zinc-800 rounded-lg animate-pulse" />
                <div className="h-20 bg-zinc-800 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Helper Text */}
          {mode === 'session' && (
            <p className={clsx(typography.size.sm, colors.text.secondary, '-mt-2')}>
              Your settings for this session override any global settings.
            </p>
          )}
          
          {/* Max Turns Setting */}
          <div>
            <label 
              htmlFor="max-turns"
              className={clsx(typography.size.sm, typography.weight.medium, colors.text.primary, 'block mb-2')}
            >
              Max Turns
            </label>
            <p className={clsx(typography.size.xs, colors.text.tertiary, 'mb-3')}>
              Maximum number of conversation turns allowed (1-1000)
            </p>
            <div className="relative">
              <input
                id="max-turns"
                type="number"
                min="1"
                max="1000"
                value={maxTurnsInput}
                onChange={(e) => handleMaxTurnsChange(e.target.value)}
                className={clsx(
                  'w-32 px-3 py-2',
                  typography.size.sm,
                  colors.background.tertiary,
                  colors.text.primary,
                  'border rounded-lg',
                  transition.fast,
                  'focus:outline-none focus:ring-2 focus:ring-zinc-500',
                  maxTurnsError ? 'border-orange-500/50' : colors.border.subtle
                )}
              />
              {maxTurnsError && (
                <p className={clsx(typography.size.xs, 'text-orange-400 mt-1')}>
                  {maxTurnsError}
                </p>
              )}
            </div>
          </div>

          {/* Permission Mode Setting */}
          <div>
            <label className={clsx(typography.size.sm, typography.weight.medium, colors.text.primary, 'block mb-2')}>
              Permission Mode
            </label>
            <p className={clsx(typography.size.xs, colors.text.tertiary, 'mb-3')}>
              Controls how the agent handles file operations and permissions
            </p>
            <div className="space-y-2">
              {PERMISSION_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => handlePermissionModeChange(mode.value)}
                  className={clsx(
                    'w-full p-3 text-left rounded-lg border',
                    transition.fast,
                    settings.permissionMode === mode.value
                      ? 'bg-zinc-800 border-zinc-600'
                      : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900/70 hover:border-zinc-700'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className={clsx(
                        typography.size.sm, 
                        typography.weight.medium,
                        mode.value === 'plan' ? 'text-emerald-400' :
                        mode.value === 'bypassPermissions' ? 'text-amber-400' :
                        mode.value === 'acceptEdits' ? 'text-blue-400' :
                        colors.text.primary
                      )}>
                        {mode.label}
                      </div>
                      <div className={clsx(typography.size.xs, colors.text.tertiary, 'mt-1')}>
                        {mode.description}
                      </div>
                    </div>
                    {settings.permissionMode === mode.value && (
                      <RiCheckLine className={clsx(iconSize.sm, 'text-emerald-400 ml-3')} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Footer */}
        <div className={clsx('mt-8 pt-6 border-t', colors.border.subtle, 'flex items-center justify-between')}>
          <p className={clsx(typography.size.xs, colors.text.tertiary)}>
            Tip: Press <span className={typography.font.mono}>⌘+Enter</span> to save
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={clsx(
                'px-4 py-2',
                typography.size.sm,
                colors.text.secondary,
                'rounded-lg',
                colors.background.hover,
                transition.fast
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!!maxTurnsError || isLoading}
              className={clsx(
                'px-4 py-2',
                typography.size.sm,
                typography.weight.medium,
                'rounded-lg',
                transition.fast,
                'flex items-center gap-2',
                maxTurnsError || isLoading
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
              )}
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
              {isSaved && <RiCheckLine className={iconSize.sm} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}