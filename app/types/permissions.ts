export const PermissionStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  TIMEOUT: 'timeout',
  EXPIRED: 'expired',
  SUPERSEDED: 'superseded',
  CANCELLED: 'cancelled'
} as const

export type PermissionStatusType = typeof PermissionStatus[keyof typeof PermissionStatus]

// Permission states that mean the request is no longer actionable
export const INACTIVE_PERMISSION_STATUSES: PermissionStatusType[] = [
  PermissionStatus.APPROVED,
  PermissionStatus.DENIED,
  PermissionStatus.TIMEOUT,
  PermissionStatus.EXPIRED,
  PermissionStatus.SUPERSEDED,
  PermissionStatus.CANCELLED
]

export function isPermissionActive(status: string): boolean {
  return status === PermissionStatus.PENDING
}