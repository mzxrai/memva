import type { Route } from "./+types/api.jobs.$jobId"
import { getJob, cancelJob, updateJob } from "../db/jobs.service"

export async function loader({ params }: Route.LoaderArgs) {
  const { jobId } = params
  
  try {
    const job = await getJob(jobId)
    
    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 })
    }

    return Response.json({ 
      success: true, 
      job 
    })
  } catch (error) {
    console.error('[Jobs API] Error getting job:', error)
    return Response.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { jobId } = params
  const method = request.method
  
  switch (method) {
    case "PUT":
      return handleUpdateJob(request, jobId)
    case "DELETE":
      return handleCancelJob(jobId)
    default:
      return new Response("Method not allowed", { status: 405 })
  }
}

async function handleUpdateJob(request: Request, jobId: string) {
  try {
    const formData = await request.formData()
    const status = formData.get("status") as any
    const error = formData.get("error") as string | null
    const resultJson = formData.get("result") as string | null

    let result: Record<string, unknown> | undefined
    if (resultJson) {
      try {
        result = JSON.parse(resultJson)
      } catch (parseError) {
        return Response.json({ error: "Invalid result JSON" }, { status: 400 })
      }
    }

    const updateData = {
      status,
      error: error || undefined,
      result
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData]
      }
    })

    const job = await updateJob(jobId, updateData)
    
    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 })
    }

    return Response.json({ 
      success: true, 
      job 
    })
  } catch (error) {
    console.error('[Jobs API] Error updating job:', error)
    return Response.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}

async function handleCancelJob(jobId: string) {
  try {
    const job = await cancelJob(jobId)
    
    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 })
    }

    return Response.json({ 
      success: true, 
      job 
    })
  } catch (error) {
    console.error('[Jobs API] Error canceling job:', error)
    return Response.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}