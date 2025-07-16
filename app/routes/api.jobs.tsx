import type { Route } from "./+types/api.jobs"
import { createJob, listJobs, updateJob, type CreateJobInput } from '../db/jobs.service'
import { getSession } from '../db/sessions.service'
import { JOB_TYPES, ALL_JOB_TYPES } from '../workers/job-types'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function action({ request }: Route.ActionArgs) {
  const method = request.method

  if (method === 'POST') {
    return handleCreateJob(request)
  }

  if (method === 'DELETE') {
    return handleCancelJobs(request)
  }

  return jsonResponse({
    success: false,
    error: `Method ${method} not allowed`
  }, 405)
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  if (action === 'stats') {
    return handleGetStats()
  }

  return handleListJobs(request)
}

async function handleCreateJob(request: Request) {
  try {
    // Validate Content-Type
    const contentType = request.headers.get('Content-Type')
    if (contentType !== 'application/json') {
      return jsonResponse({
        success: false,
        error: 'Content-Type must be application/json'
      }, 400)
    }

    // Parse JSON body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonResponse({
        success: false,
        error: 'Invalid JSON in request body'
      }, 400)
    }

    // Validate required fields
    if (typeof body !== 'object' || body === null) {
      return jsonResponse({
        success: false,
        error: 'Request body must be an object'
      }, 400)
    }

    const jobRequest = body as Record<string, unknown>

    if (!jobRequest.type) {
      return jsonResponse({
        success: false,
        error: 'Missing required field: type'
      }, 400)
    }

    if (!jobRequest.data) {
      return jsonResponse({
        success: false,
        error: 'Missing required field: data'
      }, 400)
    }

    // Validate job type
    if (!ALL_JOB_TYPES.includes(jobRequest.type as string)) {
      return jsonResponse({
        success: false,
        error: `Unknown job type: ${jobRequest.type}`
      }, 400)
    }

    // Additional validation for session-runner jobs
    if (jobRequest.type === JOB_TYPES.SESSION_RUNNER) {
      const data = jobRequest.data as Record<string, unknown>
      if (!data.sessionId) {
        return jsonResponse({
          success: false,
          error: 'Missing required field: sessionId'
        }, 400)
      }

      // Verify session exists
      const session = await getSession(data.sessionId as string)
      if (!session) {
        return jsonResponse({
          success: false,
          error: `Session not found: ${data.sessionId}`
        }, 404)
      }
    }

    // Create the job
    const createJobInput: CreateJobInput = {
      type: jobRequest.type as string,
      data: jobRequest.data as Record<string, unknown>,
      priority: (jobRequest.priority as number) || 0
    }

    const job = await createJob(createJobInput)

    return jsonResponse({
      success: true,
      jobId: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.created_at
    }, 201)

  } catch (error) {
    console.error('Error creating job:', error)
    return jsonResponse({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
}

async function handleListJobs(request: Request) {
  try {
    const url = new URL(request.url)
    
    // Parse query parameters
    const type = url.searchParams.get('type') || undefined
    const status = url.searchParams.get('status') || undefined
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)

    // Validate pagination parameters
    const validatedPage = Math.max(1, page)
    const validatedLimit = Math.min(100, Math.max(1, limit))

    // Calculate offset for pagination
    const offset = (validatedPage - 1) * validatedLimit

    // Get jobs with filters
    const jobs = await listJobs({
      type,
      status: status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | undefined,
      limit: validatedLimit
    })

    // Get total count for pagination (simplified - in real implementation would be more efficient)
    const allJobs = await listJobs({ type, status: status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | undefined })
    const total = allJobs.length
    const totalPages = Math.ceil(total / validatedLimit)

    // Apply pagination (simplified - in real implementation would use SQL OFFSET)
    const paginatedJobs = jobs.slice(offset, offset + validatedLimit)

    return jsonResponse({
      success: true,
      jobs: paginatedJobs,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total,
        totalPages
      }
    })

  } catch (error) {
    console.error('Error listing jobs:', error)
    return jsonResponse({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
}

async function handleGetStats() {
  try {
    // Get all jobs for statistics
    const allJobs = await listJobs({})

    // Calculate statistics
    const stats = {
      total: allJobs.length,
      pending: allJobs.filter(job => job.status === 'pending').length,
      running: allJobs.filter(job => job.status === 'running').length,
      completed: allJobs.filter(job => job.status === 'completed').length,
      failed: allJobs.filter(job => job.status === 'failed').length,
      byType: {} as Record<string, number>
    }

    // Calculate by-type statistics
    for (const job of allJobs) {
      stats.byType[job.type] = (stats.byType[job.type] || 0) + 1
    }

    return jsonResponse({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Error getting job stats:', error)
    return jsonResponse({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
}

async function handleCancelJobs(request: Request) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || undefined

    // Get pending jobs to cancel
    const pendingJobs = await listJobs({
      status: 'pending',
      type
    })

    // Cancel all pending jobs by updating their status
    let cancelledCount = 0
    for (const job of pendingJobs) {
      await updateJob(job.id, { status: 'cancelled' })
      cancelledCount++
    }

    const message = type 
      ? `Jobs cancelled for type: ${type}`
      : 'All pending jobs cancelled'

    return jsonResponse({
      success: true,
      cancelledCount,
      message
    })

  } catch (error) {
    console.error('Error cancelling jobs:', error)
    return jsonResponse({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
}