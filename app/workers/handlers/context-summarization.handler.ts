import type { JobHandler } from '../job-worker'
import { streamClaudeCliResponse } from '../../services/claude-cli.server'
import { getSession, updateSessionClaudeStatus } from '../../db/sessions.service'
import { getEventsForSession } from '../../db/event-session.service'
import { createEventFromMessage, storeEvent } from '../../db/events.service'
import { createJob } from '../../db/jobs.service'
import { createSessionRunnerJob } from '../job-types'
import type { ContextSummarizationJobData } from '../job-types'


/**
 * Handles context summarization when a session hits Claude's context limit
 */
export const contextSummarizationHandler: JobHandler = async (job: unknown, callback) => {
  console.log('[Context Summarization] Handler called with job:', job)
  
  try {
    const jobData = job as { id: string; type: string; data: ContextSummarizationJobData }
    const { sessionId, userId, claudeSessionId } = jobData.data
    
    console.log('[Context Summarization] Starting summarization for session:', sessionId)
    console.log('[Context Summarization] Job details:', { sessionId, userId, claudeSessionId })
    
    // Get the session
    const session = await getSession(sessionId)
    if (!session) {
      callback(new Error(`Session not found: ${sessionId}`))
      return
    }
    
    // Get all events for the session
    const events = await getEventsForSession(sessionId)
    console.log(`[Context Summarization] Found ${events.length} events to summarize`)
    
    // Combine all events into one string
    let allContent = ''
    for (const event of events) {
      // Include the full JSON for context
      allContent += `=== ${event.event_type.toUpperCase()} EVENT ===\n`
      allContent += JSON.stringify(event.data, null, 2)
      allContent += '\n\n'
    }
    
    // Take only the last 30k tokens worth (rough estimate)
    // We need to leave PLENTY of room for the system prompt and Claude's response
    // Claude seems to need more headroom than expected
    const CHARS_PER_TOKEN = 4
    const MAX_CHARS = 30_000 * CHARS_PER_TOKEN // 120k chars
    
    if (allContent.length > MAX_CHARS) {
      console.log(`[Context Summarization] Content too long (${allContent.length} chars), truncating to last ${MAX_CHARS} chars`)
      allContent = allContent.slice(-MAX_CHARS)
      allContent = '[Earlier conversation truncated due to length...]\n\n' + allContent
    }
    
    // Format for Claude
    const conversationHistory = allContent
    
    const summaryPrompt = `Please summarize the following conversation that has reached its context limit. The user needs to continue working on their task, so preserve all critical information.

<conversation>
${conversationHistory}
</conversation>

Create a comprehensive summary that will allow the conversation to continue seamlessly.`
    
    try {
      // Store the "summarizing" event
      const summarizingEvent = createEventFromMessage({
        message: {
          type: 'system',
          subtype: 'summarizing_context',
          content: 'Context limit reached. Creating summary to continue conversation...'
        },
        memvaSessionId: sessionId,
        projectPath: session.project_path,
        parentUuid: events[0]?.uuid || null,
        visible: true
      })
      await storeEvent(summarizingEvent)
      
      let summaryContent = ''
      
      // Call Claude to generate summary
      await streamClaudeCliResponse({
        prompt: summaryPrompt,
        projectPath: session.project_path,
        memvaSessionId: sessionId,
        maxTurns: 1,
        permissionMode: 'bypassPermissions', // No user interaction needed
        abortController: new AbortController(),
        onMessage: (message) => {
          if (message.type === 'assistant' && message.message.content) {
            // Extract text content from assistant message
            for (const content of message.message.content) {
              if (content.type === 'text') {
                summaryContent += content.text
              }
            }
          }
        },
        onStoredEvent: () => {
          // We don't store intermediate events for summarization
        },
        onError: (error) => {
          console.error('[Context Summarization] Error during summary generation:', error)
        }
      })
      
      if (!summaryContent) {
        throw new Error('Failed to generate summary')
      }
      
      console.log('[Context Summarization] Summary generated successfully')
      
      // Store the summary as a special event
      const summaryEvent = createEventFromMessage({
        message: {
          type: 'system',
          subtype: 'context_summary',
          content: summaryContent,
          metadata: {
            summarized_event_count: events.length,
            original_claude_session: claudeSessionId
          }
        },
        memvaSessionId: sessionId,
        projectPath: session.project_path,
        parentUuid: summarizingEvent.uuid,
        visible: true
      })
      await storeEvent(summaryEvent)
      
      // Create a continuation prompt
      const continuationPrompt = `I've summarized our previous conversation due to context limits. Here's the summary:

${summaryContent}

Please acknowledge that you've received this summary and are ready to continue helping with the task.`
      
      // Store the continuation prompt as a user event
      const continuationEvent = createEventFromMessage({
        message: {
          type: 'user',
          content: continuationPrompt,
          session_id: ''
        },
        memvaSessionId: sessionId,
        projectPath: session.project_path,
        parentUuid: summaryEvent.uuid,
        visible: false // Hide this automatic prompt
      })
      await storeEvent(continuationEvent)
      
      // Create a new session runner job to continue
      const continuationJob = createSessionRunnerJob({
        sessionId,
        prompt: continuationPrompt,
        userId
      })
      
      await createJob(continuationJob)
      
      // Update session status
      await updateSessionClaudeStatus(sessionId, 'active')
      
      callback(null, {
        success: true,
        sessionId,
        summaryGenerated: true,
        continuationJobCreated: true
      })
      
    } catch (error) {
      console.error('[Context Summarization] Error:', error)
      
      // Store a failure event if this is the final attempt
      // Check if this is a context limit error by checking the error message
      const isContextLimitError = error instanceof Error && 
        (error.message.includes('context limit') || error.message.includes('context window'))
      if (isContextLimitError) {
        const failureEvent = createEventFromMessage({
          message: {
            type: 'system',
            subtype: 'error',
            content: 'Failed to create summary: The conversation is too large even after truncation. Please start a new session.'
          },
          memvaSessionId: sessionId,
          projectPath: session.project_path,
          parentUuid: events[0]?.uuid || null,
          visible: true
        })
        await storeEvent(failureEvent)
      }
      
      await updateSessionClaudeStatus(sessionId, 'error')
      callback(error as Error)
    }
    
  } catch (error) {
    callback(new Error(`Context summarization error: ${(error as Error).message}`))
  }
}

