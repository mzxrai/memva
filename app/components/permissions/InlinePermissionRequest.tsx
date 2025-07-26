import type { PermissionRequest } from '../../db/schema'
import { colors, typography, iconSize } from '../../constants/design'
import { RiShieldLine, RiCheckLine, RiCloseLine, RiTimeLine } from 'react-icons/ri'
import clsx from 'clsx'
import { PermissionStatus } from '../../types/permissions'

interface InlinePermissionRequestProps {
  request: PermissionRequest
  onApprove: (requestId: string) => void
  onDeny: (requestId: string) => void
  isProcessing?: boolean
  canAnswer?: boolean
}

export default function InlinePermissionRequest({ 
  request, 
  onApprove, 
  onDeny,
  isProcessing = false,
  canAnswer = true
}: InlinePermissionRequestProps) {
  const isPending = request.status === PermissionStatus.PENDING
  const isApproved = request.status === PermissionStatus.APPROVED
  const isDenied = request.status === PermissionStatus.DENIED
  const isTimeout = request.status === PermissionStatus.TIMEOUT
  const isExpired = request.status === PermissionStatus.EXPIRED
  const isSuperseded = request.status === PermissionStatus.SUPERSEDED
  const isCancelled = request.status === PermissionStatus.CANCELLED

  const formatToolInput = () => {
    const input = request.input as Record<string, unknown>
    if (!input || Object.keys(input).length === 0) return null
    
    // For file operations, show the file path prominently
    if (input.file_path) {
      return <span className={typography.font.mono}>{String(input.file_path)}</span>
    }
    
    // For bash commands, show the command
    if (input.command) {
      return <code className={clsx(typography.font.mono, "text-amber-400")}>{String(input.command)}</code>
    }
    
    // For other inputs, show as JSON
    return (
      <code className={clsx(typography.font.mono, "text-zinc-400 text-xs")}>
        {JSON.stringify(input, null, 2)}
      </code>
    )
  }

  const getToolDescription = () => {
    const input = request.input as Record<string, unknown>
    
    switch (request.tool_name) {
      case 'Bash':
        return `Execute command: ${input.command || 'unknown'}`
      case 'Read':
        return `Read file: ${input.file_path || 'unknown'}`
      case 'Write':
        return `Write to file: ${input.file_path || 'unknown'}`
      case 'Edit':
        return `Edit file: ${input.file_path || 'unknown'}`
      case 'MultiEdit':
        return `Edit multiple sections in: ${input.file_path || 'unknown'}`
      case 'exit_plan_mode':
        return `Execute the plan shown below`
      default:
        return `Use ${request.tool_name} tool`
    }
  }

  return (
    <div 
      className={clsx(
        "p-4 rounded-lg border",
        "bg-amber-900/90 border-amber-800/50",
        "transition-all duration-200"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <RiShieldLine className={clsx(iconSize.md, "text-amber-600")} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={clsx(typography.size.sm, "text-amber-200 font-medium mb-1")}>
            Permission Required
          </div>
          
          <div className={clsx(typography.size.sm, colors.text.secondary, "mb-2")}>
            {getToolDescription()}
          </div>
          
          {formatToolInput() && request.tool_name !== 'Bash' && request.tool_name !== 'Read' && request.tool_name !== 'exit_plan_mode' && (
            <pre className={clsx(
              "mt-2 p-2 rounded bg-black/30 overflow-x-auto",
              typography.size.xs,
              colors.text.tertiary
            )}>
              {formatToolInput()}
            </pre>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {isPending && canAnswer && (
            <>
              <button
                onClick={() => onDeny(request.id)}
                disabled={isProcessing}
                className={clsx(
                  "px-3 py-1.5 rounded-md",
                  "text-xs font-medium",
                  "bg-zinc-800 text-zinc-300",
                  "hover:bg-zinc-700 hover:text-zinc-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-all duration-150",
                  "flex items-center gap-1.5"
                )}
                aria-label="Deny permission"
              >
                Deny
              </button>
              <button
                onClick={() => onApprove(request.id)}
                disabled={isProcessing}
                className={clsx(
                  "px-3 py-1.5 rounded-md",
                  "text-xs font-medium",
                  "bg-amber-700 text-amber-100",
                  "hover:bg-amber-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-all duration-150",
                  "flex items-center gap-1.5"
                )}
                aria-label="Approve permission"
              >
                Approve
              </button>
            </>
          )}
          
          {isPending && !canAnswer && (
            <span className={clsx(
              "text-xs font-medium px-2.5 py-1 rounded",
              "bg-zinc-800 text-zinc-500"
            )}>
              No longer answerable
            </span>
          )}
          
          {isApproved && (
            <span className={clsx(
              "text-xs font-medium px-2.5 py-1 rounded",
              "bg-green-900/20 text-green-400",
              "flex items-center gap-1"
            )}>
              <RiCheckLine className="w-3.5 h-3.5" />
              Approved
            </span>
          )}
          
          {isDenied && (
            <span className={clsx(
              "text-xs font-medium px-2.5 py-1 rounded",
              "bg-red-900/20 text-red-400",
              "flex items-center gap-1"
            )}>
              <RiCloseLine className="w-3.5 h-3.5" />
              Denied
            </span>
          )}
          
          {isTimeout && (
            <span className={clsx(
              "text-xs font-medium px-2.5 py-1 rounded",
              "bg-zinc-800 text-zinc-500"
            )}>
              Timed out
            </span>
          )}
          
          {isExpired && (
            <span className={clsx(
              "text-xs font-medium px-2.5 py-1 rounded",
              "bg-zinc-800 text-zinc-500",
              "flex items-center gap-1"
            )}>
              <RiTimeLine className="w-3.5 h-3.5" />
              Expired
            </span>
          )}
          
          {isSuperseded && (
            <span className={clsx(
              "text-xs font-medium px-2.5 py-1 rounded",
              "bg-zinc-800 text-zinc-500"
            )}>
              Superseded
            </span>
          )}
          
          {isCancelled && (
            <span className={clsx(
              "text-xs font-medium px-2.5 py-1 rounded",
              "bg-zinc-800 text-zinc-500"
            )}>
              Cancelled
            </span>
          )}
        </div>
      </div>
    </div>
  )
}