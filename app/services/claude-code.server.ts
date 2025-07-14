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
  initialParentUuid?: string
}

export async function streamClaudeCodeResponse({
  prompt,
  projectPath,
  onMessage,
  onError,
  abortController,
  memvaSessionId,
  onStoredEvent,
  resumeSessionId,
  initialParentUuid
}: StreamClaudeCodeOptions): Promise<{ lastSessionId?: string }> {
  const controller = abortController || new AbortController()
  let lastEventUuid: string | null = initialParentUuid || null
  let lastSessionId: string | undefined
  let isAborted = false
  let cancellationEventStored = false
  let messageCount = 0
  
  console.log(`[Claude Code] Starting stream for session ${memvaSessionId}`)
  
  // Monitor abort signal
  controller.signal.addEventListener('abort', () => {
    const abortTime = new Date().toISOString()
    console.log(`[Claude Code] Abort signal received for session ${memvaSessionId} at ${abortTime}`)
    isAborted = true
  })

  try {
    const options: any = {
      maxTurns: 100,
      cwd: projectPath
    }
    
    if (resumeSessionId) {
      console.log('[Claude Code] Attempting to resume session:', resumeSessionId)
      options.resume = resumeSessionId
    }

    console.log('[Claude Code] Query options:', JSON.stringify(options, null, 2))

    const messages = query({
      prompt,
      options: {
        ...options,
        abortController: controller
      }
    })

    for await (const message of messages) {
      // Check if we've been aborted BEFORE processing
      if (isAborted || controller.signal.aborted) {
        console.log(`[Claude Code] Abort detected before processing message ${messageCount + 1} for session ${memvaSessionId}`)
        
        // Store a cancellation event (only once per query)
        if (memvaSessionId && messageCount > 0 && !cancellationEventStored) {
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
          cancellationEventStored = true
          
          if (onStoredEvent) {
            onStoredEvent(cancelEvent)
          }
        }
        
        console.log(`[Claude Code] Breaking out of message loop due to abort`)
        break
      }
      
      messageCount++
      
      // Capture timestamp when message is received
      const receivedTimestamp = new Date().toISOString()
      
      console.log(`[Claude Code] Message ${messageCount} received: type=${message.type}, aborted=${controller.signal.aborted}, timestamp=${new Date().toISOString()}`)
      
      // Track session ID from each message
      if ('session_id' in message) {
        lastSessionId = message.session_id
      }

      // Store event if we have memvaSessionId
      if (memvaSessionId) {
        // Check abort one more time before storing
        if (controller.signal.aborted) {
          console.log(`[Claude Code] Abort detected before storing message ${messageCount}, breaking immediately`)
          
          // Store cancellation event immediately
          if (!cancellationEventStored) {
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
            cancellationEventStored = true
            
            if (onStoredEvent) {
              onStoredEvent(cancelEvent)
            }
          }
          
          break
        }
        
        const event = createEventFromMessage({
          message,
          memvaSessionId,
          projectPath,
          parentUuid: lastEventUuid,
          timestamp: receivedTimestamp
        })
        
        console.log(`[Claude Code] Storing event type=${event.event_type} at ${new Date().toISOString()}`)
        await storeEvent(event)
        lastEventUuid = event.uuid
        
        // Call onStoredEvent if provided
        if (onStoredEvent) {
          onStoredEvent(event)
        }
      }

      onMessage(message)
      
      // Check abort again after processing the message
      if (controller.signal.aborted) {
        console.log(`[Claude Code] Abort detected after processing message ${messageCount}, breaking loop`)
        break
      }
    }
    
    // If we exited the loop due to abort, store a cancellation event (if we haven't already)
    if (controller.signal.aborted && memvaSessionId && messageCount > 0 && !cancellationEventStored) {
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
      cancellationEventStored = true
      
      if (onStoredEvent) {
        onStoredEvent(cancelEvent)
      }
      
      console.log(`[Claude Code] Stored cancellation event after loop exit`)
    }
    
    console.log(`[Claude Code] Finished processing ${messageCount} messages for session ${memvaSessionId}`)
  } catch (error) {
    console.log(`[Claude Code] Error caught:`, error)
    console.log(`[Claude Code] Error details:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      aborted: controller.signal.aborted
    })
    
    // Check if this is an abort error
    if (controller.signal.aborted) {
      console.log(`[Claude Code] Error is due to abort signal`)
      
      // Store cancellation event if we haven't already
      if (memvaSessionId && messageCount > 0 && !cancellationEventStored) {
        console.log(`[Claude Code] Storing cancellation event...`)
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
        cancellationEventStored = true
        
        if (onStoredEvent) {
          onStoredEvent(cancelEvent)
        }
        
        console.log(`[Claude Code] Stored cancellation event in catch block`)
      } else {
        console.log(`[Claude Code] Not storing cancellation event:`, {
          memvaSessionId,
          messageCount,
          cancellationEventStored
        })
      }
      
      // Don't propagate abort errors
      return { lastSessionId }
    }
    
    // For non-abort errors, handle as before
    if (onError && error instanceof Error) {
      onError(error)
    } else {
      throw error
    }
  }

  return { lastSessionId }
}