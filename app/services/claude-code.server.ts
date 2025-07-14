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

    for await (const message of messages) {
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
          parentUuid: lastEventUuid
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
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error)
    } else {
      throw error
    }
  }

  return { lastSessionId }
}