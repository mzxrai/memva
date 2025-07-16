import type { JobHandler } from '../job-worker'
import { streamClaudeCodeResponse } from '../../services/claude-code.server'
import { getSession } from '../../db/sessions.service'
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
    
    // Execute Claude Code SDK interaction
    try {
      await streamClaudeCodeResponse({
        prompt,
        projectPath: session.project_path,
        memvaSessionId: sessionId,
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
        callback(new Error(`Claude Code SDK error: ${errorMessage}`))
        return
      }
      
      // Job completed successfully
      callback(null, {
        success: true,
        sessionId,
        messagesProcessed,
        userId
      })
      
    } catch (sdkError) {
      callback(new Error(`Claude Code SDK error: ${(sdkError as Error).message}`))
    }
    
  } catch (error) {
    callback(new Error(`Session runner handler error: ${(error as Error).message}`))
  }
}