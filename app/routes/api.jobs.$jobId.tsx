import type { Route } from "./+types/api.jobs.$jobId"
import { getJob, cancelJob, updateJob } from "../db/jobs.service"

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function loader({ params }: Route.LoaderArgs) {
  const { jobId } = params
  
  try {
    const job = await getJob(jobId)
    
    if (!job) {
      return jsonResponse({
        success: false,
        error: `Job not found: ${jobId}`
      }, 404)
    }

    return jsonResponse({
      success: true,
      job
    })
  } catch (error) {
    console.error('[Jobs API] Error getting job:', error)
    return jsonResponse({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { jobId } = params
  const method = request.method
  
  if (method === 'PUT') {
    return handleUpdateJob(request, jobId)
  }

  if (method === 'DELETE') {
    return handleCancelJob(jobId)
  }

  return jsonResponse({
    success: false,
    error: `Method ${method} not allowed`
  }, 405)
}

async function handleUpdateJob(request: Request, jobId: string) {
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

    // Validate request body
    if (typeof body !== 'object' || body === null) {
      return jsonResponse({
        success: false,
        error: 'Request body must be an object'
      }, 400)
    }

    const updateRequest = body as Record<string, unknown>

    // Build update data from valid fields
    const updateData: Record<string, unknown> = {}
    
    if (updateRequest.priority !== undefined) {
      if (typeof updateRequest.priority === 'number') {
        updateData.priority = updateRequest.priority
      }
    }
    
    if (updateRequest.scheduled_at !== undefined) {
      if (typeof updateRequest.scheduled_at === 'string') {
        updateData.scheduled_at = updateRequest.scheduled_at
      }
    }

    // Check if any valid fields were provided
    if (Object.keys(updateData).length === 0) {
      return jsonResponse({
        success: false,
        error: 'No valid update fields provided'
      }, 400)
    }

    // Check if job exists first
    const existingJob = await getJob(jobId)
    if (!existingJob) {
      return jsonResponse({
        success: false,
        error: `Job not found: ${jobId}`
      }, 404)
    }

    // Update the job
    const updatedJob = await updateJob(jobId, updateData)
    
    if (!updatedJob) {
      return jsonResponse({
        success: false,
        error: `Job not found: ${jobId}`
      }, 404)
    }

    return jsonResponse({
      success: true,
      job: updatedJob
    })

  } catch (error) {
    console.error('[Jobs API] Error updating job:', error)
    return jsonResponse({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
}

async function handleCancelJob(jobId: string) {
  try {
    // Check if job exists first
    const existingJob = await getJob(jobId)
    if (!existingJob) {
      return jsonResponse({
        success: false,
        error: `Job not found: ${jobId}`
      }, 404)
    }

    // Cancel the job
    const cancelledJob = await cancelJob(jobId)
    
    if (!cancelledJob) {
      return jsonResponse({
        success: false,
        error: `Job not found: ${jobId}`
      }, 404)
    }

    return jsonResponse({
      success: true,
      message: `Job ${jobId} cancelled`,
      job: cancelledJob
    })

  } catch (error) {
    console.error('[Jobs API] Error canceling job:', error)
    return jsonResponse({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
}