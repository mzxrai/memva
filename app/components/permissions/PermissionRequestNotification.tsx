import type { PermissionRequest } from '../../db/schema'

interface PermissionRequestNotificationProps {
  request: PermissionRequest
  onApprove: (requestId: string) => void
  onDeny: (requestId: string) => void
}

export default function PermissionRequestNotification({ 
  request, 
  onApprove, 
  onDeny 
}: PermissionRequestNotificationProps) {
  const isPending = request.status === 'pending'
  const isApproved = request.status === 'approved'
  const isDenied = request.status === 'denied'
  const isTimeout = request.status === 'timeout'

  const getTimeRemaining = () => {
    if (!isPending) return null
    
    const now = new Date()
    const expires = new Date(request.expires_at)
    const diff = expires.getTime() - now.getTime()
    
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `Expires in ${hours}h ${minutes}m`
    }
    return `Expires in ${minutes}m`
  }

  const formatToolInput = () => {
    const input = request.input as Record<string, unknown>
    if (!input || Object.keys(input).length === 0) return null
    
    // For file operations, show the file path prominently
    if (input.file_path) {
      return <span className="text-zinc-600">{String(input.file_path)}</span>
    }
    
    // For bash commands, show the command
    if (input.command) {
      return <code className="text-xs bg-zinc-100 px-1 py-0.5 rounded font-mono">{String(input.command)}</code>
    }
    
    // For other inputs, show first few key-value pairs
    const entries = Object.entries(input).slice(0, 2)
    return (
      <span className="text-zinc-600 text-xs">
        {entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ')}
      </span>
    )
  }

  return (
    <div className="border border-zinc-200 rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-zinc-900">Permission Request</h3>
          <div className="mt-1 text-sm text-zinc-600">
            <span className="font-medium">{request.tool_name}</span>
            {formatToolInput() && (
              <>
                <span className="mx-2">•</span>
                {formatToolInput()}
              </>
            )}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Session: {request.session_id}
            {isPending && getTimeRemaining() && (
              <>
                <span className="mx-2">•</span>
                {getTimeRemaining()}
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {isPending && (
            <>
              <button
                onClick={() => onDeny(request.id)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors"
              >
                Deny
              </button>
              <button
                onClick={() => onApprove(request.id)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-md transition-colors"
              >
                Approve
              </button>
            </>
          )}
          
          {isApproved && (
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
              Approved
            </span>
          )}
          
          {isDenied && (
            <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded">
              Denied
            </span>
          )}
          
          {isTimeout && (
            <span className="text-xs font-medium text-zinc-500 bg-zinc-50 px-2 py-1 rounded">
              Timed out
            </span>
          )}
        </div>
      </div>
    </div>
  )
}