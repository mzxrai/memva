import type { JobHandler } from '../job-worker'
import { streamClaudeCodeResponse } from '../../services/claude-code.server'
import { getSession, updateSessionClaudeStatus, getLatestClaudeSessionId, getSessionSettings } from '../../db/sessions.service'
import { getJob } from '../../db/jobs.service'
import { createEventFromMessage, storeEvent } from '../../db/events.service'
import { getEventsForSession, findAssistantEventWithToolUseId } from '../../db/event-session.service'
import { createJob } from '../../db/jobs.service'
import { createSessionRunnerJob } from '../job-types'
import type { SessionRunnerJobData } from '../job-types'

// Constants
const CANCELLATION_POLL_INTERVAL_MS = 100
const CONTINUATION_JOB_DELAY_MS = 100
const PERMISSION_TRANSITION_MESSAGE = (mode: string) => 
  `The user has changed your permissions mode to: ${mode}. Please acknowledge this change and let the user know you're now operating in ${mode} mode.`
const EXIT_PLAN_CONTINUATION_MESSAGE = 'Continue with your plan.'

/**
 * Handles Claude Code SDK job execution for a session
 * Manages message streaming, event storage, and job transitions
 */
export const sessionRunnerHandler: JobHandler = async (job: unknown, callback) => {
  try {
    const jobData = job as { id: string; type: string; data: SessionRunnerJobData }
    
    // Validate inputs
    const validationError = validateJobData(jobData)
    if (validationError) {
      callback(validationError)
      return
    }
    
    const { sessionId, prompt, userId } = jobData.data
    const session = await getSession(sessionId)
    
    if (!session) {
      callback(new Error(`Session not found: ${sessionId}`))
      return
    }
    
    // Initialize job state
    const jobState = {
      messagesProcessed: 0,
      hasError: false,
      errorMessage: '',
      isTransitionJob: false // For both exit plan and permission transitions
    }
    
    // Handle initial user event for new sessions
    const existingEvents = await getEventsForSession(sessionId)
    if (existingEvents.length === 0) {
      await createInitialUserEvent(sessionId, prompt, session.project_path)
    }
    
    // Setup session resumption if applicable
    const resumeSessionId = existingEvents.length > 0 
      ? await getLatestClaudeSessionId(sessionId) || undefined
      : undefined
    
    // Get parent UUID for event chaining
    const events = await getEventsForSession(sessionId)
    const initialParentUuid = events[0]?.uuid
    
    // Setup cancellation handling
    const abortController = new AbortController()
    const transitionState = {
      isPermissionTransition: false,
      hasStoredAssistantMessage: false
    }
    
    // Get session settings
    const settings = await getSessionSettings(sessionId)
    
    // Setup cancellation polling
    const pollInterval = setupCancellationPolling({
      jobId: jobData.id,
      sessionId,
      originalPermissionMode: settings.permissionMode,
      abortController,
      transitionState
    })
    
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
          jobState.messagesProcessed++
        },
        onError: (error) => {
          jobState.hasError = true
          jobState.errorMessage = error.message
        },
        onStoredEvent: async (event) => {
          // Handle permission mode transition
          if (await handlePermissionTransition({
            event,
            sessionId,
            projectPath: session.project_path,
            transitionState,
            abortController,
            pollInterval,
            jobState
          })) {
            return
          }
          
          // Handle exit plan mode transition
          await handleExitPlanTransition({
            event,
            sessionId,
            projectPath: session.project_path,
            abortController,
            jobState
          })
        }
      })
      
      // Handle job completion
      await handleJobCompletion({
        jobState,
        sessionId,
        userId,
        callback
      })
      
    } catch (sdkError) {
      await handleJobError({
        error: sdkError as Error,
        jobId: jobData.id,
        sessionId,
        userId,
        jobState,
        abortController,
        callback
      })
    } finally {
      clearInterval(pollInterval)
    }
    
  } catch (error) {
    callback(new Error(`Session runner handler error: ${(error as Error).message}`))
  }
}

// Helper Functions

function validateJobData(jobData: unknown): Error | null {
  const data = jobData as { data?: { sessionId?: string; prompt?: string } }
  if (!data?.data?.sessionId || !data?.data?.prompt) {
    return new Error('Missing required fields: sessionId and prompt are required')
  }
  
  if (data.data.prompt.trim().length === 0) {
    return new Error('Invalid prompt: prompt cannot be empty')
  }
  
  return null
}

async function createInitialUserEvent(
  sessionId: string,
  prompt: string,
  projectPath: string
): Promise<void> {
  const userEvent = createEventFromMessage({
    message: {
      type: 'user',
      content: prompt.trim(),
      session_id: ''
    },
    memvaSessionId: sessionId,
    projectPath,
    parentUuid: null,
    timestamp: new Date().toISOString()
  })
  
  await storeEvent(userEvent)
}

interface CancellationPollingOptions {
  jobId: string
  sessionId: string
  originalPermissionMode: string
  abortController: AbortController
  transitionState: {
    isPermissionTransition: boolean
    hasStoredAssistantMessage: boolean
  }
}

function setupCancellationPolling(options: CancellationPollingOptions): ReturnType<typeof setInterval> {
  const { jobId, sessionId, originalPermissionMode, abortController, transitionState } = options
  
  return setInterval(async () => {
    try {
      const currentJob = await getJob(jobId)
      if (currentJob?.status === 'cancelled') {
        const currentSettings = await getSessionSettings(sessionId)
        
        if (currentSettings.permissionMode !== originalPermissionMode && !transitionState.isPermissionTransition) {
          transitionState.isPermissionTransition = true
          // Wait for assistant message before aborting
        } else if (!transitionState.isPermissionTransition) {
          abortController.abort()
        }
      }
    } catch {
      // Silently handle polling errors
    }
  }, CANCELLATION_POLL_INTERVAL_MS)
}

async function createContinuationJob(
  sessionId: string,
  projectPath: string,
  message: string
): Promise<void> {
  const events = await getEventsForSession(sessionId)
  const latestEvent = events[0]
  
  const continuationEvent = createEventFromMessage({
    message: {
      type: 'user',
      content: message,
      session_id: ''
    },
    memvaSessionId: sessionId,
    projectPath,
    parentUuid: latestEvent?.uuid || null,
    visible: false
  })
  
  await storeEvent(continuationEvent)
  
  const jobInput = createSessionRunnerJob({
    sessionId,
    prompt: message
  })
  
  await createJob(jobInput)
}

interface PermissionTransitionOptions {
  event: Record<string, unknown>
  sessionId: string
  projectPath: string
  transitionState: {
    isPermissionTransition: boolean
    hasStoredAssistantMessage: boolean
  }
  abortController: AbortController
  pollInterval: ReturnType<typeof setInterval>
  jobState: {
    isTransitionJob: boolean
  }
}

async function handlePermissionTransition(options: PermissionTransitionOptions): Promise<boolean> {
  const { event, sessionId, projectPath, transitionState, abortController, pollInterval, jobState } = options
  
  if (event.event_type === 'assistant' && 
      transitionState.isPermissionTransition && 
      !transitionState.hasStoredAssistantMessage) {
    
    transitionState.hasStoredAssistantMessage = true
    abortController.abort()
    clearInterval(pollInterval)
    
    setTimeout(async () => {
      try {
        const currentSettings = await getSessionSettings(sessionId)
        const message = PERMISSION_TRANSITION_MESSAGE(currentSettings.permissionMode)
        await createContinuationJob(sessionId, projectPath, message)
      } catch {
        // Log error but don't fail the transition
      }
    }, CONTINUATION_JOB_DELAY_MS)
    
    jobState.isTransitionJob = true
    return true
  }
  
  return false
}

interface ExitPlanTransitionOptions {
  event: Record<string, unknown>
  sessionId: string
  projectPath: string
  abortController: AbortController
  jobState: {
    hasError: boolean
    isTransitionJob: boolean
  }
}

async function handleExitPlanTransition(options: ExitPlanTransitionOptions): Promise<void> {
  const { event, sessionId, projectPath, abortController, jobState } = options
  
  if (event.event_type !== 'user' || !event.data || typeof event.data !== 'object') {
    return
  }
  
  const data = event.data as { message?: { content?: Array<{ type: string; tool_use_id?: string; is_error?: boolean }> } }
  if (!data.message?.content || !Array.isArray(data.message.content)) {
    return
  }
  
  for (const content of data.message.content) {
    if (content.type === 'tool_result' && content.tool_use_id && !content.is_error) {
      const parentEvent = await findAssistantEventWithToolUseId(sessionId, content.tool_use_id)
      
      if (await isExitPlanModeToolUse(parentEvent, content.tool_use_id)) {
        jobState.hasError = false
        jobState.isTransitionJob = true
        abortController.abort()
        
        setTimeout(async () => {
          try {
            await createContinuationJob(sessionId, projectPath, EXIT_PLAN_CONTINUATION_MESSAGE)
          } catch {
            // Log error but don't fail the transition
          }
        }, CONTINUATION_JOB_DELAY_MS)
        
        break
      }
    }
  }
}

async function isExitPlanModeToolUse(parentEvent: { data: unknown } | null, toolUseId: string): Promise<boolean> {
  if (!parentEvent?.data || typeof parentEvent.data !== 'object') {
    return false
  }
  
  const parentData = parentEvent.data as { message?: { content?: Array<{ type: string; id?: string; name?: string }> } }
  if (!parentData.message?.content || !Array.isArray(parentData.message.content)) {
    return false
  }
  
  return parentData.message.content.some((c) => 
    c.type === 'tool_use' && c.id === toolUseId && c.name === 'exit_plan_mode'
  )
}

interface JobCompletionOptions {
  jobState: {
    hasError: boolean
    errorMessage: string
    messagesProcessed: number
  }
  sessionId: string
  userId?: string
  callback: (error: Error | null, result?: unknown) => void
}

async function handleJobCompletion(options: JobCompletionOptions): Promise<void> {
  const { jobState, sessionId, userId, callback } = options
  
  if (jobState.hasError) {
    await updateSessionClaudeStatus(sessionId, 'error').catch(() => {})
    callback(new Error(`Claude Code SDK error: ${jobState.errorMessage}`))
    return
  }
  
  await updateSessionClaudeStatus(sessionId, 'completed').catch(() => {})
  callback(null, {
    success: true,
    sessionId,
    messagesProcessed: jobState.messagesProcessed,
    userId
  })
}

interface JobErrorOptions {
  error: Error
  jobId: string
  sessionId: string
  userId?: string
  jobState: {
    isTransitionJob: boolean
    messagesProcessed: number
  }
  abortController: AbortController
  callback: (error: Error | null, result?: unknown) => void
}

async function handleJobError(options: JobErrorOptions): Promise<void> {
  const { error, jobId, sessionId, userId, jobState, abortController, callback } = options
  
  const currentJob = await getJob(jobId)
  const isCancelled = currentJob?.status === 'cancelled' || abortController.signal.aborted
  
  if (isCancelled) {
    if (jobState.isTransitionJob) {
      // Transition jobs complete successfully even when cancelled
      await updateSessionClaudeStatus(sessionId, 'completed').catch(() => {})
      callback(null, {
        success: true,
        sessionId,
        messagesProcessed: jobState.messagesProcessed,
        userId,
        transition: true
      })
      return
    }
    
    callback(new Error('Job cancelled by user'))
    return
  }
  
  await updateSessionClaudeStatus(sessionId, 'error').catch(() => {})
  callback(new Error(`Claude Code SDK error: ${error.message}`))
}