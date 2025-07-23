import type { PermissionRequest } from '../../db/schema'
import { typography } from '../../constants/design'
import { RiCheckLine, RiCloseLine } from 'react-icons/ri'
import clsx from 'clsx'
import { PermissionStatus } from '../../types/permissions'

interface CompactInlinePermissionProps {
  request: PermissionRequest
  onApprove: (requestId: string) => void
  onDeny: (requestId: string) => void
  isProcessing?: boolean
  isExitPlanMode?: boolean
  onApproveWithSettings?: (requestId: string, permissionMode: 'default' | 'acceptEdits') => void
  canAnswer?: boolean
}

export default function CompactInlinePermission({ 
  request, 
  onApprove, 
  onDeny,
  isProcessing = false,
  isExitPlanMode = false,
  onApproveWithSettings,
  canAnswer = true
}: CompactInlinePermissionProps) {
  const isPending = request.status === PermissionStatus.PENDING
  const isApproved = request.status === PermissionStatus.APPROVED
  const isDenied = request.status === PermissionStatus.DENIED
  
  if (!isPending && !isApproved && !isDenied) return null

  // Show status for non-pending requests
  if (!isPending) {
    return (
      <div className={clsx(
        "flex items-center justify-center gap-2 px-3 py-2 rounded-lg border",
        "transition-all duration-200",
        isApproved && "bg-green-900/20 border-green-800/30",
        isDenied && "bg-red-900/20 border-red-800/30"
      )}>
        <div className={clsx(
          typography.size.sm,
          "flex items-center gap-1.5",
          isApproved && "text-green-400",
          isDenied && "text-red-400"
        )}>
          {isApproved && (
            <>
              <RiCheckLine className="w-3.5 h-3.5" />
              <span>Approved</span>
            </>
          )}
          {isDenied && (
            <>
              <RiCloseLine className="w-3.5 h-3.5" />
              <span>Denied</span>
            </>
          )}
        </div>
      </div>
    )
  }
  
  // If can't answer, show disabled state
  if (!canAnswer) {
    return (
      <div className={clsx(
        "flex items-center justify-center gap-2 px-3 py-2 rounded-lg border",
        "bg-zinc-800/50 border-zinc-700/30",
        "transition-all duration-200"
      )}>
        <div className={clsx(typography.size.sm, "text-zinc-500")}>
          No longer answerable
        </div>
      </div>
    )
  }

  // For exit_plan_mode with onApproveWithSettings, show three options
  if (isExitPlanMode && onApproveWithSettings) {
    return (
      <div 
        className={clsx(
          "flex items-center justify-between gap-3 px-3 py-2 rounded-lg border",
          "bg-amber-900/50 border-amber-800/30",
          "transition-all duration-200"
        )}
      >
        <div className={clsx(typography.size.sm, "text-amber-200")}>
          Would you like to proceed?
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDeny(request.id)}
            disabled={isProcessing}
            className={clsx(
              "px-3 py-1 rounded-md",
              "text-xs font-medium",
              "bg-zinc-800 text-zinc-300",
              "hover:bg-zinc-700 hover:text-zinc-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all duration-150",
              "flex items-center gap-1.5"
            )}
            aria-label="No, keep planning"
          >
            <RiCloseLine className="w-3.5 h-3.5" />
            <span>No</span>
          </button>
          
          <button
            onClick={() => onApproveWithSettings(request.id, 'default')}
            disabled={isProcessing}
            className={clsx(
              "px-3 py-1 rounded-md",
              "text-xs font-medium",
              "bg-amber-700/40 text-amber-200",
              "hover:bg-amber-600/40",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all duration-150",
              "flex items-center gap-1.5"
            )}
            aria-label="Yes & manually approve edits"
          >
            <RiCheckLine className="w-3.5 h-3.5" />
            <span>Yes, manually approve edits</span>
          </button>
          
          <button
            onClick={() => onApproveWithSettings(request.id, 'acceptEdits')}
            disabled={isProcessing}
            className={clsx(
              "px-3 py-1 rounded-md",
              "text-xs font-medium",
              "bg-amber-700 text-amber-100",
              "hover:bg-amber-600",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all duration-150",
              "flex items-center gap-1.5"
            )}
            aria-label="Yes & auto-approve edits"
          >
            <RiCheckLine className="w-3.5 h-3.5" />
            <span>Yes, auto-accept edits</span>
          </button>
        </div>
      </div>
    )
  }

  // Regular two-option display for other tools or when onApproveWithSettings is not provided
  return (
    <div 
      className={clsx(
        "flex items-center justify-between gap-3 px-3 py-2 rounded-lg border",
        "bg-amber-900/50 border-amber-800/30",
        "transition-all duration-200"
      )}
    >
      <div className={clsx(typography.size.sm, "text-amber-200")}>
        {isExitPlanMode ? (
          <>Would you like to proceed with this plan?</>
        ) : (
          <>Do you approve this action?</>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onDeny(request.id)}
          disabled={isProcessing}
          className={clsx(
            "px-3 py-1 rounded-md",
            "text-xs font-medium",
            "bg-zinc-800 text-zinc-300",
            "hover:bg-zinc-700 hover:text-zinc-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-150",
            "flex items-center gap-1.5"
          )}
          aria-label={isExitPlanMode ? "No, keep planning" : "Deny permission"}
        >
          <RiCloseLine className="w-3.5 h-3.5" />
          {isExitPlanMode ? "No, keep planning" : "Deny"}
        </button>
        <button
          onClick={() => onApprove(request.id)}
          disabled={isProcessing}
          className={clsx(
            "px-3 py-1 rounded-md",
            "text-xs font-medium",
            "bg-amber-700 text-amber-100",
            "hover:bg-amber-600",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-150",
            "flex items-center gap-1.5"
          )}
          aria-label={isExitPlanMode ? "Looks great" : "Approve permission"}
        >
          <RiCheckLine className="w-3.5 h-3.5" />
          {isExitPlanMode ? "Looks great" : "Approve"}
        </button>
      </div>
    </div>
  )
}