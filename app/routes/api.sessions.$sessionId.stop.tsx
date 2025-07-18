import type { ActionFunctionArgs } from "react-router"
import { getActiveJobForSession, cancelJob } from "../db/jobs.service"
import { updateSessionClaudeStatus, getSession } from "../db/sessions.service"
import { createEventFromMessage, storeEvent } from "../db/events.service"

export async function action({ params, request }: ActionFunctionArgs) {
  if (request.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 })
  }
  
  const { sessionId } = params
  
  if (!sessionId) {
    return new Response('Session ID is required', { status: 400 })
  }
  
  // Get session for project path
  const session = await getSession(sessionId)
  
  if (!session) {
    return new Response('Session not found', { status: 404 })
  }
  
  // Create cancellation event immediately
  const cancelEvent = createEventFromMessage({
    message: {
      type: 'user_cancelled',
      content: 'Processing cancelled by user',
      session_id: ''
    },
    memvaSessionId: sessionId,
    projectPath: session.project_path,
    parentUuid: null,
    timestamp: new Date().toISOString()
  })
  
  await storeEvent(cancelEvent)
  console.log(`[Stop API] Created cancellation event for session ${sessionId}`)
  
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