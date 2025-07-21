import type { PermissionRequest } from '../../db/schema'
import { typography } from '../../constants/design'
import { RiCheckLine, RiCloseLine } from 'react-icons/ri'
import clsx from 'clsx'

interface CompactInlinePermissionProps {
  request: PermissionRequest
  onApprove: (requestId: string) => void
  onDeny: (requestId: string) => void
  isProcessing?: boolean
  isExitPlanMode?: boolean
}

export default function CompactInlinePermission({ 
  request, 
  onApprove, 
  onDeny,
  isProcessing = false,
  isExitPlanMode = false
}: CompactInlinePermissionProps) {
  const isPending = request.status === 'pending'
  
  if (!isPending) return null

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