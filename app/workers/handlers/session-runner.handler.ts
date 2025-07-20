import type { JobHandler } from '../job-worker'
import { streamClaudeCodeResponse } from '../../services/claude-code.server'
import { getSession, updateSessionClaudeStatus } from '../../db/sessions.service'
import { getJob } from '../../db/jobs.service'
import type { SessionRunnerJobData } from '../job-types'

export const sessionRunnerHandler: JobHandler = async (job: unknown, callback) => {
  try {
    const jobData = job as { id: string; type: string; data: SessionRunnerJobData }
    
    // Validate required fields
    if (!jobData.data.sessionId || !jobData.data.prompt) {
      callback(new Error('Missing required fields: sessionId and prompt are required'))
      return
    }
    
    const { sessionId, prompt, userId } = jobData.data
    
    console.log(`[Job ${jobData.id}] === SESSION RUNNER START ===`)
    console.log(`[Job ${jobData.id}] Session ID: ${sessionId}`)
    console.log(`[Job ${jobData.id}] Prompt: "${prompt}"`)
    console.log(`[Job ${jobData.id}] User ID: ${userId || 'none'}`)
    
    // Validate session exists
    const session = await getSession(sessionId)
    if (!session) {
      callback(new Error(`Session not found: ${sessionId}`))
      return
    }
    
    // Validate prompt is not empty
    if (prompt.trim().length === 0) {
      callback(new Error('Invalid prompt: prompt cannot be empty'))
      return
    }
    
    let messagesProcessed = 0
    let hasError = false
    let errorMessage = ''
    
    // Check if we need to create a user event
    // If there are no events yet, this is from homepage and we need to create the user event
    const { getEventsForSession } = await import('../../db/event-session.service')
    const existingEvents = await getEventsForSession(sessionId)
    
    if (existingEvents.length === 0) {
      // This is from homepage - create the user event
      const { createEventFromMessage, storeEvent } = await import('../../db/events.service')
      const userEvent = createEventFromMessage({
        message: {
          type: 'user',
          content: prompt.trim(),
          session_id: '' // Will be populated by Claude Code SDK
        },
        memvaSessionId: sessionId,
        projectPath: session.project_path,
        parentUuid: null,
        timestamp: new Date().toISOString()
      })
      
      await storeEvent(userEvent)
      console.log('[SessionRunner] Created user event for homepage submission')
    } else {
      console.log('[SessionRunner] User event already exists, skipping creation')
    }
    
    // Get the latest Claude session ID for resumption
    // IMPORTANT: Only resume if this is NOT a new session from homepage
    let resumeSessionId: string | undefined = undefined
    
    if (existingEvents.length > 0) {
      // Log the last few events to understand the state
      console.log('[SessionRunner] Last 3 events:')
      existingEvents.slice(0, 3).forEach((event, idx) => {
        console.log(`[SessionRunner]   ${idx}: type=${event.event_type}, timestamp=${event.timestamp}`)
      })
      
      // This is an existing conversation - get the Claude session ID to resume
      const { getLatestClaudeSessionId } = await import('../../db/sessions.service')
      const claudeSessionId = await getLatestClaudeSessionId(sessionId)
      console.log(`[SessionRunner] getLatestClaudeSessionId returned: ${claudeSessionId}`)
      
      // Only set resumeSessionId if we actually got a non-null value
      if (claudeSessionId) {
        resumeSessionId = claudeSessionId
        console.log('[SessionRunner] Will resume existing conversation with Claude session ID:', resumeSessionId)
        
        // Check if last event was a cancellation (just for logging)
        const lastEvent = existingEvents[0]
        if (lastEvent.event_type === 'user_cancelled') {
          console.log('[SessionRunner] NOTE: Last event was a cancellation, but still attempting to resume')
        }
      } else {
        console.log('[SessionRunner] No Claude session ID found to resume (this might be the first response still pending)')
      }
    } else {
      console.log('[SessionRunner] New session from homepage - NOT resuming any Claude session')
    }
    
    // Get the latest event to use as parent UUID
    const events = await getEventsForSession(sessionId)
    const lastEvent = events.length > 0 ? events[0] : null
    const initialParentUuid = lastEvent?.uuid || undefined
    
    // Create abort controller for cancellation
    const abortController = new AbortController()
    
    // Set up cancellation polling
    const pollInterval = setInterval(async () => {
      try {
        const currentJob = await getJob(jobData.id)
        if (currentJob?.status === 'cancelled') {
          console.log(`[Job ${jobData.id}] Cancellation detected, aborting...`)
          abortController.abort()
          clearInterval(pollInterval)
        }
      } catch (error) {
        console.error(`[Job ${jobData.id}] Error checking cancellation:`, error)
      }
    }, 100) // Poll every 100ms for near-instant response
    
    // Get session-specific settings (with fallback to global)
    const { getSessionSettings } = await import('../../db/sessions.service')
    const settings = await getSessionSettings(sessionId)
    console.log(`[SessionRunner] Using settings - maxTurns: ${settings.maxTurns}, permissionMode: ${settings.permissionMode}`)
    
    // Execute Claude Code SDK interaction
    try {
      await streamClaudeCodeResponse({
        prompt,
        projectPath: session.project_path,
        memvaSessionId: sessionId,
        resumeSessionId,
        initialParentUuid,
        abortController,
        maxTurns: settings.maxTurns,
        permissionMode: settings.permissionMode,
        onMessage: () => {
          messagesProcessed++
          // Messages are automatically stored by the service
        },
        onError: (error) => {
          hasError = true
          errorMessage = error.message
        },
        onStoredEvent: () => {
          // Event storage tracking if needed
        }
      })
      
      if (hasError) {
        try {
          await updateSessionClaudeStatus(sessionId, 'error')
        } catch (statusError) {
          console.error('Failed to update session status to error:', statusError)
        }
        callback(new Error(`Claude Code SDK error: ${errorMessage}`))
        return
      }
      
      // Job completed successfully
      try {
        await updateSessionClaudeStatus(sessionId, 'completed')
      } catch (statusError) {
        console.error('Failed to update session status to completed:', statusError)
      }
      callback(null, {
        success: true,
        sessionId,
        messagesProcessed,
        userId
      })
      
    } catch (sdkError) {
      // Check if this was a cancellation by checking job status
      const currentJob = await getJob(jobData.id);
      const isCancelled = currentJob?.status === 'cancelled' || abortController.signal.aborted;
      
      if (isCancelled) {
        console.log(`[Job ${jobData.id}] Job cancelled by user`)
        
        // Don't update status here - the stop endpoint already set it to 'completed'
        callback(new Error('Job cancelled by user'))
        return
      }
      
      try {
        await updateSessionClaudeStatus(sessionId, 'error')
      } catch (statusError) {
        console.error('Failed to update session status to error:', statusError)
      }
      callback(new Error(`Claude Code SDK error: ${(sdkError as Error).message}`))
    } finally {
      // Clean up polling
      clearInterval(pollInterval)
    }
    
  } catch (error) {
    callback(new Error(`Session runner handler error: ${(error as Error).message}`))
  }
}