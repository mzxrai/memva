import type { JobHandler } from '../job-worker'
import { streamClaudeCodeResponse } from '../../services/claude-code.server'
import { getSession, updateSessionClaudeStatus } from '../../db/sessions.service'
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
    
    // Create initial user event for the prompt
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
    
    // Execute Claude Code SDK interaction
    try {
      await streamClaudeCodeResponse({
        prompt,
        projectPath: session.project_path,
        memvaSessionId: sessionId,
        initialParentUuid: userEvent.uuid,
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
      try {
        await updateSessionClaudeStatus(sessionId, 'error')
      } catch (statusError) {
        console.error('Failed to update session status to error:', statusError)
      }
      callback(new Error(`Claude Code SDK error: ${(sdkError as Error).message}`))
    }
    
  } catch (error) {
    callback(new Error(`Session runner handler error: ${(error as Error).message}`))
  }
}