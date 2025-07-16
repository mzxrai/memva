import { db, jobs, type Job, type NewJob } from './index'
import { eq, desc, and, or, isNull, lt } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

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
  let query = db.select().from(jobs)
  
  // Apply filters
  const filters = []
  if (options.status) {
    filters.push(eq(jobs.status, options.status))
  }
  if (options.type) {
    filters.push(eq(jobs.type, options.type))
  }
  
  if (filters.length > 0) {
    query = query.where(and(...filters))
  }
  
  // Order by priority (descending) then creation time (ascending)
  query = query.orderBy(desc(jobs.priority), jobs.created_at)
  
  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit)
  }
  
  return query.execute()
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
    attempts: availableJob.attempts + 1
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
  
  const canRetry = shouldRetry && job.attempts < job.max_attempts
  const finalStatus = canRetry ? 'pending' : 'failed'
  
  return updateJob(id, {
    status: finalStatus,
    error,
    completed_at: canRetry ? null : new Date().toISOString()
  })
}

export async function cancelJob(id: string): Promise<Job | null> {
  return updateJob(id, {
    status: 'cancelled',
    completed_at: new Date().toISOString()
  })
}