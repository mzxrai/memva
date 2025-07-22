import { eq, and, lt, gt } from 'drizzle-orm'
import { permissionRequests, type PermissionRequest, type NewPermissionRequest } from './schema'
import { db } from './index'

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
  
  const newRequest: NewPermissionRequest = {
    id: generateId(),
    session_id: data.session_id,
    tool_name: data.tool_name,
    tool_use_id: data.tool_use_id ?? null,
    input: data.input,
    status: 'pending',
    decision: null,
    decided_at: null,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  }

  const result = db.insert(permissionRequests).values(newRequest).returning().get()
  
  if (!result) {
    throw new Error('Failed to create permission request')
  }

  return result
}

export async function getPermissionRequests(filters?: GetPermissionRequestsFilters): Promise<PermissionRequest[]> {
  let query = db.select().from(permissionRequests)

  if (filters?.id) {
    query = query.where(eq(permissionRequests.id, filters.id)) as typeof query
  }

  if (filters?.session_id) {
    query = query.where(eq(permissionRequests.session_id, filters.session_id)) as typeof query
  }

  if (filters?.status) {
    query = query.where(eq(permissionRequests.status, filters.status)) as typeof query
  }

  return query.all()
}

export async function getPendingPermissionRequests(sessionId?: string): Promise<PermissionRequest[]> {
  const now = new Date().toISOString()
  
  const conditions = [
    eq(permissionRequests.status, 'pending'),
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

  if (existingRequest.status !== 'pending') {
    throw new Error('Permission request already decided')
  }

  const updatedStatus = data.decision === 'allow' ? 'approved' : 'denied'
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
        eq(permissionRequests.status, 'pending'),
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
        eq(permissionRequests.status, 'pending'),
        lt(permissionRequests.expires_at, now)
      )
    )
    .all()

  if (expiredRequests.length === 0) {
    return 0
  }

  // Update all expired requests to timeout status
  db.update(permissionRequests)
    .set({ status: 'timeout' })
    .where(
      and(
        eq(permissionRequests.status, 'pending'),
        lt(permissionRequests.expires_at, now)
      )
    )
    .run()

  return expiredRequests.length
}