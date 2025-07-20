import Database from 'better-sqlite3'

interface PermissionRequestData {
  session_id: string
  tool_name: string
  tool_use_id?: string | null
  input: Record<string, unknown>
}

interface PermissionDecision {
  behavior: 'allow' | 'deny'
  updatedInput?: Record<string, unknown>
  message?: string
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export class PermissionPoller {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createPermissionRequest(data: PermissionRequestData): string {
    const id = crypto.randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS)

    this.db.prepare(`
      INSERT INTO permission_requests (
        id, session_id, tool_name, tool_use_id, input, 
        status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.session_id,
      data.tool_name,
      data.tool_use_id || null,
      JSON.stringify(data.input),
      'pending',
      now.toISOString(),
      expiresAt.toISOString()
    )

    return id
  }

  async pollForDecision(requestId: string, maxWaitTime: number): Promise<PermissionDecision> {
    const startTime = Date.now()
    let pollInterval = 100 // Start at 100ms

    while (Date.now() - startTime < maxWaitTime) {
      const decision = this.checkDecision(requestId)
      if (decision) return decision

      // Check if request has expired
      const request = this.db.prepare(
        'SELECT expires_at FROM permission_requests WHERE id = ?'
      ).get(requestId) as { expires_at: string } | undefined

      if (request && new Date(request.expires_at) < new Date()) {
        return {
          behavior: 'deny',
          message: 'Permission request expired'
        }
      }

      await this.sleep(pollInterval)
      // Exponential backoff: 100ms → 200ms → 400ms → ... → 5s (cap)
      pollInterval = Math.min(pollInterval * 2, 5000)
    }

    // Timeout
    return {
      behavior: 'deny',
      message: `Permission request timed out after ${maxWaitTime}ms`
    }
  }

  checkDecision(requestId: string): PermissionDecision | null {
    const request = this.db.prepare(`
      SELECT status, decision, input 
      FROM permission_requests 
      WHERE id = ?
    `).get(requestId) as { 
      status: string
      decision: string | null
      input: string 
    } | undefined

    if (!request || request.status === 'pending') {
      return null
    }

    const input = JSON.parse(request.input)

    if (request.status === 'approved' && request.decision === 'allow') {
      return {
        behavior: 'allow',
        updatedInput: input
      }
    }

    return {
      behavior: 'deny',
      message: 'Permission denied by user'
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}