import { eq, and, lt, gt } from 'drizzle-orm'
import { permissionRequests, type PermissionRequest, type NewPermissionRequest } from './schema'
import { db } from './index'
import { PermissionStatus, isPermissionActive } from '../types/permissions'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export interface CreatePermissionRequestData {
  session_id: string
  tool_name: string
  tool_use_id?: string | null
  input: Record<string, unknown>
}

export interface UpdatePermissionDecisionData {
  decision: 'allow' | 'deny'
}

export interface GetPermissionRequestsFilters {
  id?: string
  session_id?: string
  status?: string
}

const generateId = () => crypto.randomUUID()
const generateTimestamp = () => new Date().toISOString()

export async function createPermissionRequest(data: CreatePermissionRequestData): Promise<PermissionRequest> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS)
  
  // Use a transaction to ensure only one active permission per session
  const result = db.transaction((tx) => {
    // First, supersede any existing pending permissions for this session
    tx.update(permissionRequests)
      .set({ status: PermissionStatus.SUPERSEDED })
      .where(
        and(
          eq(permissionRequests.session_id, data.session_id),
          eq(permissionRequests.status, PermissionStatus.PENDING)
        )
      )
      .run()
    
    // Then create the new permission request
    const newRequest: NewPermissionRequest = {
      id: generateId(),
      session_id: data.session_id,
      tool_name: data.tool_name,
      tool_use_id: data.tool_use_id ?? null,
      input: data.input,
      status: PermissionStatus.PENDING,
      decision: null,
      decided_at: null,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    }

    const created = tx.insert(permissionRequests).values(newRequest).returning().get()
    
    if (!created) {
      throw new Error('Failed to create permission request')
    }
    
    return created
  })

  return result
}

export async function getPermissionRequests(filters?: GetPermissionRequestsFilters): Promise<PermissionRequest[]> {
  const conditions = []

  if (filters?.id) {
    conditions.push(eq(permissionRequests.id, filters.id))
  }

  if (filters?.session_id) {
    conditions.push(eq(permissionRequests.session_id, filters.session_id))
  }

  if (filters?.status) {
    conditions.push(eq(permissionRequests.status, filters.status))
  }

  const query = conditions.length > 0 
    ? db.select().from(permissionRequests).where(and(...conditions))
    : db.select().from(permissionRequests)

  return query.all()
}

export async function getPendingPermissionRequests(sessionId?: string): Promise<PermissionRequest[]> {
  const now = new Date().toISOString()
  
  const conditions = [
    eq(permissionRequests.status, PermissionStatus.PENDING),
    gt(permissionRequests.expires_at, now)
  ]
  
  if (sessionId) {
    conditions.push(eq(permissionRequests.session_id, sessionId))
  }
  
  return db
    .select()
    .from(permissionRequests)
    .where(and(...conditions))
    .all()
}

export async function updatePermissionDecision(
  requestId: string, 
  data: UpdatePermissionDecisionData
): Promise<PermissionRequest> {
  // First, check if the request exists and is still pending
  const existingRequest = db
    .select()
    .from(permissionRequests)
    .where(eq(permissionRequests.id, requestId))
    .get()

  if (!existingRequest) {
    throw new Error('Permission request not found')
  }

  if (existingRequest.status !== PermissionStatus.PENDING) {
    throw new Error('Permission request already decided')
  }

  const updatedStatus = data.decision === 'allow' ? PermissionStatus.APPROVED : PermissionStatus.DENIED
  const decidedAt = generateTimestamp()

  const result = db
    .update(permissionRequests)
    .set({
      status: updatedStatus,
      decision: data.decision,
      decided_at: decidedAt
    })
    .where(eq(permissionRequests.id, requestId))
    .returning()
    .get()

  if (!result) {
    throw new Error('Failed to update permission request')
  }

  return result
}

export async function getPendingPermissionsCountBatch(sessionIds: string[]): Promise<Map<string, number>> {
  if (sessionIds.length === 0) {
    return new Map()
  }
  
  const now = new Date().toISOString()
  
  // Get all pending permissions for the given sessions
  const pendingPermissions = db
    .select()
    .from(permissionRequests)
    .where(
      and(
        eq(permissionRequests.status, PermissionStatus.PENDING),
        gt(permissionRequests.expires_at, now)
      )
    )
    .all()
  
  // Count permissions per session
  const countMap = new Map<string, number>()
  
  // Initialize all sessions with 0
  sessionIds.forEach(id => countMap.set(id, 0))
  
  // Count pending permissions for each session
  pendingPermissions.forEach(permission => {
    if (sessionIds.includes(permission.session_id)) {
      const currentCount = countMap.get(permission.session_id) || 0
      countMap.set(permission.session_id, currentCount + 1)
    }
  })
  
  return countMap
}

export async function expireOldRequests(): Promise<number> {
  const now = new Date().toISOString()

  const expiredRequests = db
    .select()
    .from(permissionRequests)
    .where(
      and(
        eq(permissionRequests.status, PermissionStatus.PENDING),
        lt(permissionRequests.expires_at, now)
      )
    )
    .all()

  if (expiredRequests.length === 0) {
    return 0
  }

  // Update all expired requests to expired status
  db.update(permissionRequests)
    .set({ status: PermissionStatus.EXPIRED })
    .where(
      and(
        eq(permissionRequests.status, PermissionStatus.PENDING),
        lt(permissionRequests.expires_at, now)
      )
    )
    .run()

  return expiredRequests.length
}

// Expire permissions for a session when a new user message is sent
export async function expirePermissionsAfterUserMessage(sessionId: string, messageTimestamp: string): Promise<void> {
  db.update(permissionRequests)
    .set({ status: PermissionStatus.SUPERSEDED })
    .where(
      and(
        eq(permissionRequests.session_id, sessionId),
        eq(permissionRequests.status, PermissionStatus.PENDING),
        lt(permissionRequests.created_at, messageTimestamp)
      )
    )
    .run()
}


// Mark all pending permissions as expired (for graceful shutdown)
export async function expireAllPendingPermissions(): Promise<void> {
  db.update(permissionRequests)
    .set({ status: PermissionStatus.EXPIRED })
    .where(eq(permissionRequests.status, PermissionStatus.PENDING))
    .run()
}

// Check if a permission can be answered
export async function canAnswerPermission(permissionId: string): Promise<boolean> {
  const permission = db
    .select()
    .from(permissionRequests)
    .where(eq(permissionRequests.id, permissionId))
    .get()
    
  if (!permission || !isPermissionActive(permission.status)) {
    return false
  }
  
  // Check if permission has expired
  const now = new Date().toISOString()
  if (permission.expires_at < now) {
    return false
  }
  
  // Check if there's an active job for this session
  const { getActiveJobForSession } = await import('./jobs.service')
  const activeJob = await getActiveJobForSession(permission.session_id)
  if (!activeJob) {
    return false
  }
  
  // Check if there are any user messages after this permission
  const { events } = await import('./schema')
  const laterUserMessages = db
    .select()
    .from(events)
    .where(
      and(
        eq(events.memva_session_id, permission.session_id),
        eq(events.event_type, 'user'),
        gt(events.timestamp, permission.created_at)
      )
    )
    .limit(1)
    .all()
    
  return laterUserMessages.length === 0
}