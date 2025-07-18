import { db, jobs, type Job, type NewJob } from './index'
import { eq, desc, and, or, isNull, lt, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export type { Job, NewJob }
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type CreateJobInput = {
  type: string
  data: Record<string, unknown>
  priority?: number
  max_attempts?: number
  scheduled_at?: string
}

export type UpdateJobInput = {
  status?: JobStatus
  error?: string
  result?: Record<string, unknown>
  started_at?: string
  completed_at?: string
  attempts?: number
  priority?: number
  scheduled_at?: string
}

export type ListJobsOptions = {
  status?: JobStatus
  type?: string
  limit?: number
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const now = new Date().toISOString()
  const newJob: NewJob = {
    id: uuidv4(),
    type: input.type,
    data: input.data,
    status: 'pending',
    priority: input.priority || 0,
    attempts: 0,
    max_attempts: input.max_attempts || 3,
    error: null,
    result: null,
    scheduled_at: input.scheduled_at || null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now
  }

  await db.insert(jobs).values(newJob).execute()
  
  const [created] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, newJob.id))
    .execute()
    
  return created
}

export async function getJob(id: string): Promise<Job | null> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, id))
    .execute()
    
  return job || null
}

export async function updateJob(id: string, input: UpdateJobInput): Promise<Job | null> {
  const updates: Partial<Job> = {
    updated_at: new Date().toISOString()
  }
  
  if (input.status !== undefined) updates.status = input.status
  if (input.error !== undefined) updates.error = input.error
  if (input.result !== undefined) updates.result = input.result
  if (input.started_at !== undefined) updates.started_at = input.started_at
  if (input.completed_at !== undefined) updates.completed_at = input.completed_at
  if (input.attempts !== undefined) updates.attempts = input.attempts
  if (input.priority !== undefined) updates.priority = input.priority
  if (input.scheduled_at !== undefined) updates.scheduled_at = input.scheduled_at
  
  await db
    .update(jobs)
    .set(updates)
    .where(eq(jobs.id, id))
    .execute()
    
  const [updated] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, id))
    .execute()
    
  return updated || null
}

export async function listJobs(options: ListJobsOptions = {}): Promise<Job[]> {
  // Build filters
  const filters = []
  if (options.status) {
    filters.push(eq(jobs.status, options.status))
  }
  if (options.type) {
    filters.push(eq(jobs.type, options.type))
  }
  
  // Build base query with filters and ordering
  const baseQuery = db.select().from(jobs)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(jobs.priority), jobs.created_at)
  
  // Apply limit if specified
  if (options.limit) {
    return baseQuery.limit(options.limit).execute()
  }
  
  return baseQuery.execute()
}

export async function claimNextJob(): Promise<Job | null> {
  const now = new Date().toISOString()
  
  // Find the next available job
  const [availableJob] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, 'pending'),
        or(
          isNull(jobs.scheduled_at),
          lt(jobs.scheduled_at, now)
        )
      )
    )
    .orderBy(desc(jobs.priority), jobs.created_at)
    .limit(1)
    .execute()
  
  if (!availableJob) {
    return null
  }
  
  // Claim the job by setting it to running
  const claimed = await updateJob(availableJob.id, {
    status: 'running',
    started_at: now,
    attempts: (availableJob.attempts ?? 0) + 1
  })
  
  return claimed
}

export async function completeJob(id: string, result?: Record<string, unknown>): Promise<Job | null> {
  return updateJob(id, {
    status: 'completed',
    result,
    completed_at: new Date().toISOString()
  })
}

export async function failJob(id: string, error: string, shouldRetry = true): Promise<Job | null> {
  const job = await getJob(id)
  if (!job) return null
  
  const canRetry = shouldRetry && (job.attempts ?? 0) < (job.max_attempts ?? 3)
  const finalStatus = canRetry ? 'pending' : 'failed'
  
  return updateJob(id, {
    status: finalStatus,
    error,
    completed_at: canRetry ? undefined : new Date().toISOString()
  })
}

export async function cancelJob(id: string): Promise<Job | null> {
  return updateJob(id, {
    status: 'cancelled',
    completed_at: new Date().toISOString()
  })
}

export async function getActiveJobForSession(sessionId: string): Promise<Job | null> {
  const [activeJob] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.type, 'session-runner'),
        or(eq(jobs.status, 'pending'), eq(jobs.status, 'running')),
        sql`json_extract(${jobs.data}, '$.sessionId') = ${sessionId}`
      )
    )
    .limit(1)
    .execute()
  
  return activeJob || null
}

export async function getJobStats(): Promise<{
  pending: number
  running: number
  completed: number
  failed: number
  cancelled: number
  total: number
}> {
  const allJobs = await db.select({ status: jobs.status }).from(jobs).execute()
  
  const stats = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: allJobs.length
  }
  
  for (const job of allJobs) {
    if (job.status in stats) {
      (stats as Record<string, number>)[job.status]++
    }
  }
  
  return stats
}

export async function cleanupOldJobs(olderThanDays = 30): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
  const cutoffIso = cutoffDate.toISOString()
  
  const jobsToDelete = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        or(
          eq(jobs.status, 'completed'),
          eq(jobs.status, 'failed'),
          eq(jobs.status, 'cancelled')
        ),
        lt(jobs.completed_at, cutoffIso)
      )
    )
    .execute()
  
  if (jobsToDelete.length === 0) {
    return 0
  }
  
  const idsToDelete = jobsToDelete.map(job => job.id)
  
  // Delete jobs one by one to avoid complex SQL
  for (const jobId of idsToDelete) {
    await db
      .delete(jobs)
      .where(eq(jobs.id, jobId))
      .execute()
  }
  
  return idsToDelete.length
}