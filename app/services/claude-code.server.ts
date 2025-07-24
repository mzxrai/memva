import { query, type SDKMessage } from '@anthropic-ai/claude-code'
import { createEventFromMessage, storeEvent } from '../db/events.service'
import path from 'node:path'

interface StreamClaudeCodeOptions {
  prompt: string
  projectPath: string
  onMessage: (message: SDKMessage) => void
  onError?: (error: Error) => void
  abortController?: AbortController
  memvaSessionId?: string
  onStoredEvent?: (event: Record<string, unknown>) => void
  resumeSessionId?: string
  initialParentUuid?: string
  timeoutMs?: number
  maxTurns?: number
  permissionMode?: string
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
  initialParentUuid,
  timeoutMs = 30 * 60 * 1000, // 30 minutes default
  maxTurns = 200,
  permissionMode = 'acceptEdits'
}: StreamClaudeCodeOptions): Promise<{ lastSessionId?: string }> {

  const controller = abortController || new AbortController()

  // Set up global timeout
  const timeoutId = setTimeout(() => {
    timeoutAbort = true
    controller.abort()
  }, timeoutMs)
  let lastEventUuid: string | null = initialParentUuid || null
  let lastSessionId: string | undefined
  let isAborted = false
  let messageCount = 0
  let hasReceivedFirstMessage = false
  let hasReceivedAssistantMessage = false
  let abortRequested = false
  let earlyAbortRequested = false
  let timeoutAbort = false


  // Create our own abort controller that we'll trigger when ready
  const internalAbortController = new AbortController()

  // Monitor the external abort signal
  controller.signal.addEventListener('abort', () => {
    abortRequested = true

    // Only actually abort if we've received an assistant message
    if (hasReceivedAssistantMessage) {
      isAborted = true
      internalAbortController.abort()
    } else {
      earlyAbortRequested = true
    }
  })

  try {
    let options: Record<string, unknown> = {
      maxTurns,
      cwd: projectPath,
      permissionMode,
      allowedTools: ['Read'] // Only allow Read by default, everything else requires permission
    }

    if (resumeSessionId) {
      options.resume = resumeSessionId
    }

    // Add MCP configuration for permissions if we have a memva session ID
    if (memvaSessionId) {
      options = await getClaudeCodeOptionsWithPermissions(memvaSessionId, options)
    }

    console.debug('[Claude Code] Query options:', JSON.stringify(options, null, 2))

    const messages = query({
      prompt,
      options: {
        ...options,
        abortController: internalAbortController
      }
    })

    let messageLoopStarted = false

    for await (const message of messages) {
      if (!messageLoopStarted) {
        messageLoopStarted = true
      }

      // Check if we've been aborted BEFORE processing (only if we have the session ID)
      if (isAborted) {
          break
      }

      messageCount++

      // Capture timestamp when message is received
      const receivedTimestamp = new Date().toISOString()


      // Track session ID from each message
      if ('session_id' in message) {
        const newClaudeSessionId = message.session_id

        if (lastSessionId !== newClaudeSessionId) {
          lastSessionId = newClaudeSessionId
        }

        // CRITICAL: Update the Claude session ID in the database immediately
        // This ensures we can resume even if the process is aborted
        if (memvaSessionId && lastSessionId && lastSessionId !== resumeSessionId) {

          const { updateClaudeSessionId } = await import('../db/sessions.service')
          await updateClaudeSessionId(memvaSessionId, lastSessionId)

          // IMPORTANT: Update resumeSessionId to prevent re-running this block
          resumeSessionId = lastSessionId
        }
      }

      // Mark that we've received the first message
      if (!hasReceivedFirstMessage) {
        hasReceivedFirstMessage = true
      }


      // Mark if we've received an assistant message (only if not early abort)
      if (message.type === 'assistant' && !hasReceivedAssistantMessage) {
        hasReceivedAssistantMessage = true

        // Check if abort was requested before assistant message
        if (abortRequested && !earlyAbortRequested) {
          isAborted = true
          internalAbortController.abort()
          // Don't break immediately - store this message first
        }
      }

      // Call onMessage for all messages (SDK requirement)
      onMessage(message)

      // Store event if we have memvaSessionId
      if (memvaSessionId) {
        // Skip storing ANY messages after system message if early abort requested
        if (earlyAbortRequested && message.type !== 'system') {
          
          // Check if this is the assistant message we were waiting for
          if (message.type === 'assistant') {
            isAborted = true
            internalAbortController.abort()

            // Continue to next iteration which will break due to isAborted check
            continue
          }

          // Skip to next message without storing
          continue
        }

        // Check abort one more time before storing (but only if we're past first message)
        if (isAborted && hasReceivedFirstMessage && !earlyAbortRequested) {
          // Don't break here - we want to store this message first
        }

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

      // Check abort again after processing the message
      if (isAborted) {
        break
      }
    }

  } catch (error) {

    // Check if this is a resume failure (exit code 1 with no messages)
    if (error instanceof Error &&
      error.message === 'Claude Code process exited with code 1' &&
      messageCount === 0 &&
      resumeSessionId) {

      // Don't propagate this error - it's expected when resuming aborted sessions
      return { lastSessionId: resumeSessionId }
    }

    // Check if this is an abort error
    if (isAborted || controller.signal.aborted) {
      if (timeoutAbort) {
        // Let timeout errors propagate to trigger error status
        throw new Error(`Claude Code session timed out after ${timeoutMs / 60000} minutes`)
      } else {
        // Don't propagate user abort errors
        return { lastSessionId }
      }
    }

    // For non-abort errors, log and handle as before
    console.error(`[Claude Code] Error caught:`, error)
    console.error(`[Claude Code] Error details:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      aborted: controller.signal.aborted
    })

    if (onError && error instanceof Error) {
      onError(error)
    } else {
      throw error
    }
  } finally {
    // Clear the timeout to prevent it from firing after completion
    clearTimeout(timeoutId)
    
    // No cleanup needed since we're using direct MCP server config
  }

  return { lastSessionId }
}


/**
 * Get Claude Code SDK options with MCP permissions configured
 */
export async function getClaudeCodeOptionsWithPermissions(
  sessionId: string,
  baseOptions: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  // Get absolute path for MCP server
  const mcpServerPath = path.resolve(process.cwd(), 'mcp-permission-server', 'build', 'index.js')
  
  // Create MCP server config (database path is now hardcoded in the MCP server)
  const mcpServers = {
    'memva-permissions': {
      command: 'node',
      args: [
        mcpServerPath,
        '--session-id',
        sessionId
      ]
    }
  }
  
  // Ensure permission tool is in allowed tools
  const permissionTool = 'mcp__memva-permissions__approval_prompt'
  const existingTools = (baseOptions.allowedTools as string[]) || []
  const allowedTools = existingTools.includes(permissionTool) 
    ? existingTools 
    : [...existingTools, permissionTool]
  
  // Return options with MCP servers and permission tool
  return {
    ...baseOptions,
    mcpServers,
    permissionPromptToolName: permissionTool,
    allowedTools
  }
}


