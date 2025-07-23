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
    let isExitPlanModeTransition = false
    
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
    }
    
    // Get the latest Claude session ID for resumption
    // IMPORTANT: Only resume if this is NOT a new session from homepage
    let resumeSessionId: string | undefined = undefined
    
    if (existingEvents.length > 0) {
      // This is an existing conversation - get the Claude session ID to resume
      const { getLatestClaudeSessionId } = await import('../../db/sessions.service')
      const claudeSessionId = await getLatestClaudeSessionId(sessionId)
      
      // Only set resumeSessionId if we actually got a non-null value
      if (claudeSessionId) {
        resumeSessionId = claudeSessionId
      }
    }
    
    // Get the latest event to use as parent UUID
    const events = await getEventsForSession(sessionId)
    const lastEvent = events.length > 0 ? events[0] : null
    const initialParentUuid = lastEvent?.uuid || undefined
    
    // Create abort controller for cancellation
    const abortController = new AbortController()
    console.log(`[SESSION RUNNER DEBUG] Job ${jobData.id} started for session ${sessionId}`)
    
    // Set up cancellation polling
    let pollCount = 0
    const pollInterval = setInterval(async () => {
      pollCount++
      try {
        const currentJob = await getJob(jobData.id)
        if (currentJob?.status === 'cancelled') {
          console.log(`[SESSION RUNNER DEBUG] Job ${jobData.id} detected as cancelled after ${pollCount} polls (${pollCount * 100}ms)`)
          abortController.abort()
          console.log(`[SESSION RUNNER DEBUG] AbortController.abort() called for job ${jobData.id}`)
          clearInterval(pollInterval)
        }
      } catch (error) {
        console.error(`[Job ${jobData.id}] Error checking cancellation:`, error)
      }
    }, 100) // Poll every 100ms for near-instant response
    
    // Get session-specific settings (with fallback to global)
    const { getSessionSettings } = await import('../../db/sessions.service')
    const settings = await getSessionSettings(sessionId)
    
    // Execute Claude Code SDK interaction
    try {
      console.log(`[SESSION RUNNER DEBUG] Starting streamClaudeCodeResponse for job ${jobData.id}`)
      await streamClaudeCodeResponse({
        prompt,
        projectPath: session.project_path,
        memvaSessionId: sessionId,
        resumeSessionId,
        initialParentUuid,
        abortController,
        maxTurns: settings.maxTurns,
        permissionMode: settings.permissionMode,
        onMessage: (message) => {
          messagesProcessed++
          console.log(`[SESSION RUNNER DEBUG] Job ${jobData.id} received message ${messagesProcessed}: type=${message.type}`)
          // Messages are automatically stored by the service
        },
        onError: (error) => {
          hasError = true
          errorMessage = error.message
          console.log(`[SESSION RUNNER DEBUG] Job ${jobData.id} error: ${error.message}`)
        },
        onStoredEvent: async (event) => {
          console.log(`[SESSION RUNNER DEBUG] Job ${jobData.id} stored event: type=${event.event_type}, uuid=${event.uuid}`)
          
          // Check if this is a tool_result event for exit_plan_mode
          if (event.event_type === 'user' && event.data && typeof event.data === 'object') {
            const data = event.data as {
              type: string
              message?: {
                role: string
                content?: Array<{
                  type: string
                  tool_use_id?: string
                  content?: unknown
                  is_error?: boolean
                }>
              }
              parent_tool_use_id?: string | null
              session_id?: string
            }
            
            if (data.message?.content && Array.isArray(data.message.content)) {
              for (const content of data.message.content) {
                if (content.type === 'tool_result' && content.tool_use_id) {
                  // Check if this tool_result corresponds to an exit_plan_mode tool use
                  // We need to find the parent assistant event that contains the tool_use with this ID
                  const { findAssistantEventWithToolUseId } = await import('../../db/event-session.service')
                  const parentEvent = await findAssistantEventWithToolUseId(sessionId, content.tool_use_id)
                  
                  if (parentEvent && parentEvent.data && typeof parentEvent.data === 'object') {
                    const parentData = parentEvent.data as {
                      type: string
                      message?: {
                        role: string
                        content?: Array<{
                          type: string
                          id?: string
                          name?: string
                        }>
                      }
                    }
                    
                    if (parentData.message?.content && Array.isArray(parentData.message.content)) {
                      const toolUse = parentData.message.content.find(c => 
                        c.type === 'tool_use' && c.id === content.tool_use_id && c.name === 'exit_plan_mode'
                      )
                      
                      if (toolUse && !content.is_error) {
                        console.log(`[SESSION RUNNER DEBUG] Detected successful exit_plan_mode tool_result, scheduling session restart`)
                        
                        // Signal that we should gracefully complete this session
                        hasError = false
                        isExitPlanModeTransition = true
                        
                        // Abort the current session to stop processing
                        abortController.abort()
                        
                        // Schedule the creation of a new job with continuation message
                        // We do this asynchronously to avoid blocking the current event processing
                        setTimeout(async () => {
                          try {
                            console.log(`[SESSION RUNNER DEBUG] Creating continuation job for session ${sessionId}`)
                            
                            // Create a hidden user event for the continuation message
                            const continuationMessage = 'Continue with your plan.'
                            const { createEventFromMessage, storeEvent } = await import('../../db/events.service')
                            const { createJob } = await import('../../db/jobs.service')
                            
                            // Get the latest event to use as parent
                            const { getEventsForSession } = await import('../../db/event-session.service')
                            const latestEvents = await getEventsForSession(sessionId)
                            const latestEvent = latestEvents[latestEvents.length - 1]
                            
                            // Create the continuation event (marked as not visible)
                            const continuationEvent = createEventFromMessage({
                              message: {
                                type: 'user',
                                content: continuationMessage,
                                session_id: ''
                              },
                              memvaSessionId: sessionId,
                              projectPath: session.project_path,
                              parentUuid: latestEvent?.uuid || null,
                              visible: false // Hidden from UI
                            })
                            
                            await storeEvent(continuationEvent)
                            
                            // Create a new job to continue the conversation
                            const { createSessionRunnerJob } = await import('../../workers/job-types')
                            
                            const jobInput = createSessionRunnerJob({
                              sessionId,
                              prompt: continuationMessage
                            })
                            
                            await createJob(jobInput)
                            
                            console.log(`[SESSION RUNNER DEBUG] Continuation job created for session ${sessionId}`)
                          } catch (error) {
                            console.error(`[SESSION RUNNER DEBUG] Error creating continuation job:`, error)
                          }
                        }, 100) // Small delay to ensure current session completes
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })
      console.log(`[SESSION RUNNER DEBUG] streamClaudeCodeResponse completed for job ${jobData.id}`)
      
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
        // Check if this is an exit_plan_mode transition
        if (isExitPlanModeTransition) {
          // This is expected - complete the job successfully
          try {
            await updateSessionClaudeStatus(sessionId, 'completed')
          } catch (statusError) {
            console.error('Failed to update session status to completed:', statusError)
          }
          callback(null, {
            success: true,
            sessionId,
            messagesProcessed,
            userId,
            exitPlanModeTransition: true
          })
          return
        }
        
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