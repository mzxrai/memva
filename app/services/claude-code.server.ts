import { query, type SDKMessage } from '@anthropic-ai/claude-code'
import { createEventFromMessage, storeEvent } from './events.service'

interface StreamClaudeCodeOptions {
  prompt: string
  projectPath: string
  onMessage: (message: SDKMessage) => void
  onError?: (error: Error) => void
  abortController?: AbortController
  memvaSessionId?: string
  onStoredEvent?: (event: any) => void
  resumeSessionId?: string
}

export async function streamClaudeCodeResponse({
  prompt,
  projectPath,
  onMessage,
  onError,
  abortController,
  memvaSessionId,
  onStoredEvent,
  resumeSessionId
}: StreamClaudeCodeOptions): Promise<{ lastSessionId?: string }> {
  const controller = abortController || new AbortController()
  let lastEventUuid: string | null = null
  let lastSessionId: string | undefined
  
  console.log(`[Claude Code] Starting stream for session ${memvaSessionId}`)
  
  // Monitor abort signal
  controller.signal.addEventListener('abort', () => {
    console.log(`[Claude Code] Abort signal received for session ${memvaSessionId}`)
  })

  try {
    const options: any = {
      maxTurns: 10,
      cwd: projectPath
    }
    
    if (resumeSessionId) {
      console.log('[Claude Code] Attempting to resume session:', resumeSessionId)
      options.resume = resumeSessionId
    }

    console.log('[Claude Code] Query options:', JSON.stringify(options, null, 2))

    const messages = query({
      prompt,
      abortController: controller,
      options
    })

    let messageCount = 0
    for await (const message of messages) {
      messageCount++
      
      // Check if we've been aborted
      if (controller.signal.aborted) {
        console.log(`[Claude Code] Abort detected after ${messageCount} messages for session ${memvaSessionId}`)
        
        // Store a cancellation event
        if (memvaSessionId) {
          const cancelEvent = createEventFromMessage({
            message: {
              type: 'user_cancelled',
              content: 'Processing cancelled by user',
              session_id: lastSessionId || ''
            },
            memvaSessionId,
            projectPath,
            parentUuid: lastEventUuid,
            timestamp: new Date().toISOString()
          })
          
          await storeEvent(cancelEvent)
          
          if (onStoredEvent) {
            onStoredEvent(cancelEvent)
          }
        }
        
        console.log(`[Claude Code] Breaking out of message loop due to abort`)
        break
      }
      
      // Capture timestamp when message is received
      const receivedTimestamp = new Date().toISOString()
      
      console.log(`[Claude Code] Message ${messageCount} received: type=${message.type}, aborted=${controller.signal.aborted}`)
      
      // Track session ID from each message
      if ('session_id' in message) {
        lastSessionId = message.session_id
      }

      // Store event if we have memvaSessionId
      if (memvaSessionId) {
        const event = createEventFromMessage({
          message,
          memvaSessionId,
          projectPath,
          parentUuid: lastEventUuid,
          timestamp: receivedTimestamp
        })
        
        await storeEvent(event)
        lastEventUuid = event.uuid
        
        // Call onStoredEvent if provided
        if (onStoredEvent) {
          onStoredEvent(event)
        }
      }

      onMessage(message)
    }
    
    console.log(`[Claude Code] Finished processing ${messageCount} messages for session ${memvaSessionId}`)
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error)
    } else {
      throw error
    }
  }

  return { lastSessionId }
}