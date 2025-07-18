import type { ActionFunctionArgs } from "react-router"
import { getActiveJobForSession, cancelJob } from "../db/jobs.service"
import { updateSessionClaudeStatus } from "../db/sessions.service"

export async function action({ params, request }: ActionFunctionArgs) {
  if (request.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 })
  }
  
  const { sessionId } = params
  
  if (!sessionId) {
    return new Response('Session ID is required', { status: 400 })
  }
  
  // Find active job for this session
  const activeJob = await getActiveJobForSession(sessionId)
  
  if (activeJob) {
    // Cancel the job - this triggers the polling in handler
    await cancelJob(activeJob.id)
    console.log(`[Stop API] Cancelled job ${activeJob.id} for session ${sessionId}`)
  }
  
  // Update session status immediately so UI reflects stopped state
  await updateSessionClaudeStatus(sessionId, 'completed')
  
  return Response.json({ 
    success: true,
    jobCancelled: !!activeJob 
  })
}