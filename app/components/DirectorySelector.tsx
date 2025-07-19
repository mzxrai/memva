import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react'
import { colors, typography, transition, iconSize } from '../constants/design'
import { RiFolder3Line, RiCheckLine, RiCloseLine } from 'react-icons/ri'
import clsx from 'clsx'

interface DirectorySelectorProps {
  isOpen: boolean
  currentDirectory: string
  onSelect: (directory: string) => void
  onClose: () => void
}

const RECENT_DIRS_KEY = 'memva-recent-directories'
const MAX_RECENT_DIRS = 10

export default function DirectorySelector({
  isOpen,
  currentDirectory,
  onSelect,
  onClose
}: DirectorySelectorProps) {
  const [inputValue, setInputValue] = useState(currentDirectory)
  const [expandedPath, setExpandedPath] = useState('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [recentDirs, setRecentDirs] = useState<string[]>([])
  const [isSaved, setIsSaved] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showError, setShowError] = useState(false)
  const [isPendingValidation, setIsPendingValidation] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load recent directories from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_DIRS_KEY)
      if (stored) {
        const dirs = JSON.parse(stored)
        setRecentDirs(dirs.slice(0, MAX_RECENT_DIRS))
      }
    } catch (error) {
      console.error('Failed to load recent directories:', error)
    }
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isOpen])

  // Initialize input value when currentDirectory changes or on first open
  useEffect(() => {
    if (isOpen && !inputValue) {
      if (currentDirectory) {
        setInputValue(currentDirectory)
      } else {
        // Fetch current directory
        fetch('/api/filesystem?action=current')
          .then(res => res.json())
          .then(data => {
            if (data.currentDirectory) {
              setInputValue(data.currentDirectory)
            }
          })
          .catch(err => console.error('Failed to get current directory:', err))
      }
    }
  }, [isOpen, currentDirectory])
  
  // Reset validation state when modal opens
  useEffect(() => {
    if (isOpen) {
      setExpandedPath('')
      setIsValid(null)
      setIsSaved(false)
      setIsDirty(false)
      setShowError(false)
      setIsPendingValidation(false)
      // Expand the current input value
      if (inputValue) {
        expandPath(inputValue).then(setExpandedPath)
      }
    }
  }, [isOpen])

  const expandPath = useCallback(async (path: string) => {
    try {
      const response = await fetch(`/api/filesystem?action=expand&path=${encodeURIComponent(path)}`)
      const data = await response.json()
      return data.expandedPath
    } catch (error) {
      console.error('Failed to expand path:', error)
      return path
    }
  }, [])

  const validateDirectory = useCallback(async (path: string, autoSave = true) => {
    setIsValidating(true)
    try {
      const response = await fetch(`/api/filesystem?action=validate&path=${encodeURIComponent(path)}`)
      const data = await response.json()
      setIsValid(data.valid)
      
      // Auto-save if valid and autoSave is true
      if (data.valid && autoSave) {
        // Update recent directories - use lowercase comparison for deduplication on case-insensitive filesystems
        // but preserve the actual resolved path
        const isWindows = navigator.platform.toLowerCase().includes('win')
        const isMac = navigator.platform.toLowerCase().includes('mac')
        const isCaseInsensitive = isWindows || isMac
        
        const newRecent = [
          data.resolvedPath,
          ...recentDirs.filter(d => {
            if (isCaseInsensitive) {
              // Case-insensitive comparison for Windows/Mac
              return d.toLowerCase() !== data.resolvedPath.toLowerCase()
            } else {
              // Case-sensitive comparison for Linux
              return d !== data.resolvedPath
            }
          })
        ].slice(0, MAX_RECENT_DIRS)
        
        setRecentDirs(newRecent)
        localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(newRecent))
        
        // Also update last used directory
        localStorage.setItem('memva-last-directory', data.resolvedPath)
        
        // DON'T call onSelect during auto-save - just update the state
        // onSelect should only be called when explicitly closing the modal
        setIsSaved(true)
        setIsDirty(false)
        
        // Update the input value to the resolved path to show the correct case
        setInputValue(data.resolvedPath)
      }
      
      return data
    } catch (error) {
      console.error('Failed to validate directory:', error)
      setIsValid(false)
      return { valid: false, resolvedPath: path }
    } finally {
      setIsValidating(false)
    }
  }, [recentDirs])

  const handleInputChange = async (value: string) => {
    // Don't reset saved state if the value hasn't actually changed
    if (value === inputValue) return
    
    setInputValue(value)
    setIsValid(null)
    setIsSaved(false)
    setIsDirty(value !== currentDirectory)
    setShowError(false) // Reset error display when typing

    // Clear existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    // Expand path immediately for user feedback
    const expanded = await expandPath(value)
    setExpandedPath(expanded)

    // Validate after 1 second of no typing
    if (value && value !== currentDirectory) {
      setIsPendingValidation(true) // Show spinner while waiting
      debounceTimer.current = setTimeout(() => {
        setIsPendingValidation(false)
        validateDirectory(value, true) // true = auto-save if valid
      }, 1000)
    } else {
      setIsPendingValidation(false)
    }
  }

  const handleSelect = async (path: string) => {
    // For recent directories, they're already validated, so just select and close
    const validation = await validateDirectory(path, false) // false = don't auto-save
    if (validation.valid) {
      onSelect(validation.resolvedPath)
      onClose()
    }
  }

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inputValue) {
        if (!isSaved) {
          // Validate first if not already saved
          const result = await validateDirectory(inputValue)
          if (result.valid) {
            onSelect(result.resolvedPath)
            onClose()
          }
        } else {
          // Already validated and saved, just close
          onSelect(inputValue)
          onClose()
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      // If we have a saved directory, notify parent on close
      if (isSaved && inputValue) {
        onSelect(inputValue)
      }
      onClose()
    }
  }


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={() => {
          // If we have a saved directory, notify parent on close
          if (isSaved && inputValue) {
            onSelect(inputValue)
          }
          onClose()
        }}
      />

      {/* Modal */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-selector-title"
        className={clsx(
          'relative z-10 w-full max-w-2xl',
          colors.background.secondary,
          colors.border.default,
          'border rounded-xl shadow-2xl',
          'p-6'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 
            id="directory-selector-title"
            className={clsx(typography.size.lg, typography.weight.semibold, colors.text.primary)}
          >
            Select Directory
          </h2>
          <button
            onClick={() => {
              // If we have a saved directory, notify parent on close
              if (isSaved && inputValue) {
                onSelect(inputValue)
              }
              onClose()
            }}
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

        {/* Directory Input */}
        <div className="space-y-2 mb-6">
          <label 
            htmlFor="directory-input"
            className={clsx(typography.size.sm, colors.text.secondary)}
          >
            Directory path
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="directory-input"
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={() => {
                setShowError(true)
                validateDirectory(inputValue)
              }}
              onKeyDown={handleKeyDown}
              className={clsx(
                'w-full px-4 py-3 pr-10',
                typography.font.mono,
                typography.size.sm,
                colors.background.tertiary,
                colors.text.primary,
                'border rounded-lg',
                transition.fast,
                'focus:outline-none focus:ring-2 focus:ring-zinc-500',
                isValid === false ? colors.border.subtle + ' border-orange-500/50' : colors.border.subtle
              )}
              placeholder="~/projects/myapp or /absolute/path"
              autoComplete="off"
              spellCheck={false}
            />
            {/* Show status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {(isValidating || isPendingValidation) && (
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
              )}
              {!isValidating && !isPendingValidation && isSaved && (
                <div className="text-emerald-400">
                  <RiCheckLine className={iconSize.sm} title="Saved" />
                </div>
              )}
              {!isValidating && !isPendingValidation && !isSaved && isDirty && (
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" title="Unsaved changes" />
              )}
            </div>
          </div>
          
          {/* Expanded Path Display or Error Message */}
          {isValid === false && showError ? (
            <p className={clsx(typography.size.xs, 'text-orange-400')}>
              This directory couldn't be found. Please check the path and try again.
            </p>
          ) : expandedPath ? (
            <p className={clsx(typography.size.xs, colors.text.tertiary, typography.font.mono)}>
              → {expandedPath}
            </p>
          ) : (
            <p className={clsx(typography.size.xs, colors.text.tertiary, typography.font.mono)}>
              → {inputValue}
            </p>
          )}
        </div>


        {/* Recent Directories */}
        {recentDirs.length > 0 && (
          <div>
            <h3 className={clsx(typography.size.sm, typography.weight.medium, colors.text.secondary, 'mb-3')}>
              Recent Directories
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {recentDirs.map((dir) => (
                <button
                  key={dir}
                  onClick={() => handleSelect(dir)}
                  className={clsx(
                    'w-full px-3 py-2 flex items-center gap-2',
                    typography.size.sm,
                    typography.font.mono,
                    colors.text.secondary,
                    colors.background.tertiary,
                    'rounded-lg',
                    colors.background.hover,
                    transition.fast,
                    'text-left'
                  )}
                >
                  <RiFolder3Line className={clsx(iconSize.sm, 'flex-shrink-0')} />
                  <span className="truncate">{dir}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer Help Text */}
        <div className={clsx('mt-6 pt-4 border-t', colors.border.subtle)}>
          <p className={clsx(typography.size.xs, colors.text.tertiary)}>
            Tips: Use <span className={typography.font.mono}>~</span> for home directory, 
            <span className={typography.font.mono}> .</span> for current directory, 
            or <span className={typography.font.mono}> ..</span> for parent directory
          </p>
        </div>
      </div>
    </div>
  )
}