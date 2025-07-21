import type { PermissionRequest } from '../../db/schema'
import PermissionRequestNotification from './PermissionRequestNotification'

interface PermissionQueueProps {
  requests: PermissionRequest[]
  onApprove: (requestId: string) => void
  onDeny: (requestId: string) => void
}

export default function PermissionQueue({ 
  requests, 
  onApprove, 
  onDeny 
}: PermissionQueueProps) {
  // Sort requests: pending first, then by created_at
  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Group by session
  const groupedBySession = sortedRequests.reduce((acc, request) => {
    if (!acc[request.session_id]) {
      acc[request.session_id] = []
    }
    acc[request.session_id].push(request)
    return acc
  }, {} as Record<string, PermissionRequest[]>)

  const pendingCount = requests.filter(r => r.status === 'pending').length

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <p>No pending permission requests</p>
      </div>
    )
  }

  return (
    <div data-testid="permission-queue" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Permission Requests</h2>
        {pendingCount > 0 && (
          <span className="text-sm text-zinc-600">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="space-y-6">
        {Object.entries(groupedBySession).map(([sessionId, sessionRequests]) => (
          <div key={sessionId} className="space-y-2">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Session: {sessionId}
            </div>
            <div className="space-y-2">
              {sessionRequests.map(request => (
                <PermissionRequestNotification
                  key={request.id}
                  request={request}
                  onApprove={onApprove}
                  onDeny={onDeny}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}