import { query, type SDKMessage } from '@anthropic-ai/claude-code'
import { createEventFromMessage, storeEvent } from './events.service'

interface StreamClaudeCodeOptions {
  prompt: string
  projectPath: string
  onMessage: (message: SDKMessage) => void
  onError?: (error: Error) => void
  abortController?: AbortController
  sessionId?: string
  memvaSessionId?: string
  onStoredEvent?: (event: any) => void
}

export async function streamClaudeCodeResponse({
  prompt,
  projectPath,
  onMessage,
  onError,
  abortController,
  sessionId,
  memvaSessionId,
  onStoredEvent
}: StreamClaudeCodeOptions): Promise<void> {
  const controller = abortController || new AbortController()
  let lastEventUuid: string | null = null

  try {
    const messages = query({
      prompt,
      abortController: controller,
      options: {
        maxTurns: 10,
        cwd: projectPath
      }
    })

    for await (const message of messages) {
      // Store event if we have both sessionId and memvaSessionId
      if (sessionId && memvaSessionId) {
        const event = createEventFromMessage({
          message,
          sessionId,
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
}