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
  console.log(`[Claude Code] === STREAM START ===`)
  console.log(`[Claude Code] Resume session ID: ${resumeSessionId || 'NONE (new session)'}`)
  console.log(`[Claude Code] Memva session ID: ${memvaSessionId}`)
  console.log(`[Claude Code] Prompt: "${prompt}"`)
  console.log(`[Claude Code] Project path: ${projectPath}`)
  console.log(`[Claude Code] Initial parent UUID: ${initialParentUuid || 'none'}`)
  console.log(`[Claude Code] Timeout: ${timeoutMs}ms (${timeoutMs / 60000} minutes)`)
  console.log(`[Claude Code] Max turns: ${maxTurns}`)
  console.log(`[Claude Code] Permission mode: ${permissionMode}`)

  const controller = abortController || new AbortController()

  // Set up global timeout
  const timeoutId = setTimeout(() => {
    console.log(`[Claude Code] Global timeout reached (${timeoutMs}ms), aborting...`)
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
    const abortTime = new Date().toISOString()
    console.log(`[Claude Code] ABORT REQUEST received at ${abortTime}`)
    console.log(`[Claude Code] Message count at abort request: ${messageCount}`)
    console.log(`[Claude Code] Has received first message: ${hasReceivedFirstMessage}`)
    console.log(`[Claude Code] Has received assistant message: ${hasReceivedAssistantMessage}`)
    console.log(`[Claude Code] Current lastSessionId: ${lastSessionId}`)
    console.log(`[Claude Code] Resume session ID was: ${resumeSessionId}`)

    abortRequested = true

    // Only actually abort if we've received an assistant message
    if (hasReceivedAssistantMessage) {
      console.log(`[Claude Code] Abort accepted - assistant message already received`)
      isAborted = true
      internalAbortController.abort()
    } else {
      console.log(`[Claude Code] ABORT DELAYED - waiting for assistant message to ensure session can be resumed`)
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
      console.log('[Claude Code] Attempting to resume session:', resumeSessionId)
      options.resume = resumeSessionId
    }

    // Add MCP configuration for permissions if we have a memva session ID
    if (memvaSessionId) {
      console.log('[Claude Code] Configuring MCP permissions for session:', memvaSessionId)
      options = await getClaudeCodeOptionsWithPermissions(memvaSessionId, options)
    }

    console.log('[Claude Code] Query options:', JSON.stringify(options, null, 2))

    const messages = query({
      prompt,
      options: {
        ...options,
        abortController: internalAbortController
      }
    })

    console.log(`[Claude Code] Entering message loop...`)
    let messageLoopStarted = false

    try {
      for await (const message of messages) {
        if (!messageLoopStarted) {
          console.log(`[Claude Code] First iteration of message loop`)
          messageLoopStarted = true
        }

        // Check if we've been aborted BEFORE processing (only if we have the session ID)
        if (isAborted) {
          console.log(`[Claude Code] ABORT detected at start of loop iteration:`)
          console.log(`[Claude Code]   isAborted: ${isAborted}`)
          console.log(`[Claude Code]   signal.aborted: ${controller.signal.aborted}`)
          console.log(`[Claude Code]   messageCount: ${messageCount}`)
          console.log(`[Claude Code]   memvaSessionId: ${memvaSessionId}`)
          console.log(`[Claude Code]   hasReceivedFirstMessage: ${hasReceivedFirstMessage}`)

          console.log(`[Claude Code] Breaking out of message loop due to abort`)
          break
        }

        messageCount++

        // Capture timestamp when message is received
        const receivedTimestamp = new Date().toISOString()

        console.log(`[Claude Code] Message ${messageCount} received: type=${message.type}, aborted=${controller.signal.aborted}, timestamp=${new Date().toISOString()}`)

        // Track session ID from each message
        if ('session_id' in message) {
          const newClaudeSessionId = message.session_id

          if (lastSessionId !== newClaudeSessionId) {
            lastSessionId = newClaudeSessionId
            console.log(`[Claude Code] Updated lastSessionId to: ${lastSessionId}`)
          }

          // CRITICAL: Update the Claude session ID in the database immediately
          // This ensures we can resume even if the process is aborted
          if (memvaSessionId && lastSessionId && lastSessionId !== resumeSessionId) {
            console.log(`[Claude Code] New session ID detected, updating database immediately`)
            console.log(`[Claude Code]   Old: ${resumeSessionId || 'none'}`)
            console.log(`[Claude Code]   New: ${lastSessionId}`)

            const { updateClaudeSessionId } = await import('../db/sessions.service')
            await updateClaudeSessionId(memvaSessionId, lastSessionId)
            console.log(`[Claude Code] Database updated with new session ID`)

            // IMPORTANT: Update resumeSessionId to prevent re-running this block
            resumeSessionId = lastSessionId
          }
        }

        // Mark that we've received the first message
        if (!hasReceivedFirstMessage) {
          hasReceivedFirstMessage = true
          console.log(`[Claude Code] First message received! Session ID: ${lastSessionId}`)
        }

        // Mark if we've received an assistant message (only if not early abort)
        if (message.type === 'assistant' && !hasReceivedAssistantMessage) {
          hasReceivedAssistantMessage = true
          console.log(`[Claude Code] First assistant message received! Can now safely abort if needed`)

          // Check if abort was requested before assistant message
          if (abortRequested && !earlyAbortRequested) {
            console.log(`[Claude Code] Processing delayed abort - now that we have an assistant message`)
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
            console.log(`[Claude Code] Early abort - skipping storage of ${message.type} message`)

            // Check if this is the assistant message we were waiting for
            if (message.type === 'assistant') {
              console.log(`[Claude Code] First assistant message received during early abort - now aborting`)
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
            console.log(`[Claude Code] Abort detected before storing message ${messageCount}, will store this message then break`)
            // Don't break here - we want to store this message first
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

        // Check abort again after processing the message
        if (isAborted) {
          console.log(`[Claude Code] Abort flag set after processing message ${messageCount}, breaking loop`)
          break
        }
      }


    } catch (loopError) {
      console.log(`[Claude Code] Error in message loop:`, loopError)
      throw loopError
    }

    console.log(`[Claude Code] Finished processing ${messageCount} messages for session ${memvaSessionId}`)
  } catch (error) {
    console.log(`[Claude Code] CATCH BLOCK: Error caught:`, error)
    console.log(`[Claude Code] CATCH BLOCK: Error type:`, error?.constructor?.name)
    console.log(`[Claude Code] CATCH BLOCK: Error message:`, error instanceof Error ? error.message : 'Unknown')
    console.log(`[Claude Code] CATCH BLOCK: Error stack:`, error instanceof Error ? error.stack : 'No stack')
    console.log(`[Claude Code] CATCH BLOCK: Controller aborted:`, controller.signal.aborted)
    console.log(`[Claude Code] CATCH BLOCK: isAborted flag:`, isAborted)
    console.log(`[Claude Code] CATCH BLOCK: Message count:`, messageCount)
    console.log(`[Claude Code] CATCH BLOCK: Resume session ID was:`, resumeSessionId)

    // Check if this is a resume failure (exit code 1 with no messages)
    if (error instanceof Error &&
      error.message === 'Claude Code process exited with code 1' &&
      messageCount === 0 &&
      resumeSessionId) {
      console.log(`[Claude Code] RESUME FAILED - Claude session ${resumeSessionId} cannot be resumed`)
      console.log(`[Claude Code] This likely means the session was previously aborted`)
      console.log(`[Claude Code] Consider implementing a fallback to start a new session with context`)

      // Don't propagate this error - it's expected when resuming aborted sessions
      return { lastSessionId: resumeSessionId }
    }

    // Check if this is an abort error
    if (isAborted || controller.signal.aborted) {
      if (timeoutAbort) {
        console.log(`[Claude Code] Processing stopped by timeout (${timeoutMs}ms)`)
        // Let timeout errors propagate to trigger error status
        throw new Error(`Claude Code session timed out after ${timeoutMs / 60000} minutes`)
      } else {
        console.log(`[Claude Code] Processing stopped by user (isAborted=${isAborted}, signal.aborted=${controller.signal.aborted}, hasReceivedAssistantMessage=${hasReceivedAssistantMessage})`)
        // Don't propagate user abort errors
        return { lastSessionId }
      }
    }

    // For non-abort errors, log and handle as before
    console.log(`[Claude Code] Error caught:`, error)
    console.log(`[Claude Code] Error details:`, {
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


