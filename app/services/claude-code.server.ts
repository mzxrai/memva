import { query, type SDKMessage } from '@anthropic-ai/claude-code'
import { createEventFromMessage, storeEvent } from '../db/events.service'
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import os from 'node:os'

/**
 * Find the Claude executable by checking multiple common locations
 * @returns The full path to the Claude executable
 * @throws Error if Claude executable cannot be found
 */
export function findClaudeExecutable(): string {
  // Check locations in order of preference
  const locations: Array<{ path: string; description: string }> = []
  
  // 1. Check system PATH using 'which' command
  try {
    const whichResult = execSync('which claude', { encoding: 'utf8' }).trim()
    if (whichResult) {
      // If it's an alias or wrapper script, try to resolve the actual executable
      if (whichResult.includes('.claude/local/claude')) {
        // This is the common Claude local installation wrapper
        const actualPath = path.join(
          os.homedir(),
          '.claude/local/node_modules/@anthropic-ai/claude-code/cli.js'
        )
        locations.push({ path: actualPath, description: 'Claude local installation' })
      } else {
        locations.push({ path: whichResult, description: 'System PATH' })
      }
    }
  } catch {
    // 'which' command failed, continue to other locations
  }
  
  // 2. Check local node_modules (current project)
  const localPath = path.join(process.cwd(), 'node_modules/@anthropic-ai/claude-code/cli.js')
  locations.push({ path: localPath, description: 'Local project node_modules' })
  
  // 3. Check global npm installation
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim()
    const globalNpmPath = path.join(npmRoot, '@anthropic-ai/claude-code/cli.js')
    locations.push({ path: globalNpmPath, description: 'Global npm installation' })
  } catch {
    // npm command failed, continue
  }
  
  // 4. Check common user installation paths
  const userPaths = [
    path.join(os.homedir(), '.claude/local/node_modules/@anthropic-ai/claude-code/cli.js'),
    path.join(os.homedir(), '.npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js'),
    path.join(os.homedir(), 'node_modules/@anthropic-ai/claude-code/cli.js')
  ]
  
  for (const userPath of userPaths) {
    locations.push({ path: userPath, description: 'User installation' })
  }
  
  // 5. Check platform-specific locations
  if (process.platform === 'darwin') {
    // macOS with Homebrew
    locations.push({
      path: '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js',
      description: 'Homebrew global installation'
    })
    locations.push({
      path: '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
      description: 'macOS global installation'
    })
  } else if (process.platform === 'linux') {
    // Linux common paths
    locations.push({
      path: '/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js',
      description: 'Linux global installation'
    })
    locations.push({
      path: '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
      description: 'Linux local installation'
    })
  }
  
  // Try each location and return the first valid one
  for (const location of locations) {
    try {
      // Check if file exists and is executable
      const stats = fs.statSync(location.path)
      if (stats.isFile()) {
        // Verify it's the actual Claude CLI by checking if it's executable or a JS file
        if (location.path.endsWith('.js') || (stats.mode & fs.constants.X_OK)) {
          return location.path
        }
      }
    } catch {
      // File doesn't exist or can't be accessed, continue to next location
    }
  }
  
  // If we get here, Claude executable was not found
  const checkedPaths = locations.map(loc => `\n  - ${loc.description}: ${loc.path}`).join('')
  throw new Error(
    `Claude executable not found. Please ensure Claude Code is installed.\n` +
    `Checked the following locations:${checkedPaths}\n\n` +
    `To install Claude Code, run: npm install -g @anthropic-ai/claude-code`
  )
}

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
    console.debug('[Claude Code] Starting query with prompt:', prompt.substring(0, 100) + '...')
    console.debug('[Claude Code] Resume session ID:', resumeSessionId)

    // Temporarily enable DEBUG for Claude Code to get stderr output
    const originalDebug = process.env.DEBUG
    process.env.DEBUG = '1'

    const messages = query({
      prompt,
      options: {
        ...options,
        abortController: internalAbortController
      }
    })
    
    // Restore original DEBUG value after starting the query
    if (originalDebug === undefined) {
      delete process.env.DEBUG
    } else {
      process.env.DEBUG = originalDebug
    }

    let messageLoopStarted = false

    for await (const message of messages) {
      if (!messageLoopStarted) {
        messageLoopStarted = true
        console.debug('[Claude Code] Message loop started, first message type:', message.type)
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
        console.debug('[Claude Code] Message has session_id:', newClaudeSessionId)

        if (lastSessionId !== newClaudeSessionId) {
          console.debug('[Claude Code] Session ID changed from', lastSessionId, 'to', newClaudeSessionId)
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
    console.debug('[Claude Code] Caught error:', error)
    console.debug('[Claude Code] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.debug('[Claude Code] Message count:', messageCount)
    console.debug('[Claude Code] Resume session ID:', resumeSessionId)
    console.debug('[Claude Code] Has received first message:', hasReceivedFirstMessage)

    // Check if this is a resume failure (exit code 1 with no messages)
    if (error instanceof Error &&
      error.message === 'Claude Code process exited with code 1' &&
      messageCount === 0 &&
      resumeSessionId) {
      console.debug('[Claude Code] Resume failure detected - checking if this is a known error')
      
      // Since we can't easily capture stderr, we'll just surface all resume failures
      // This is more honest than swallowing errors
      console.error('[Claude Code] Resume failure - propagating error')
      throw new Error(`Failed to resume Claude session. The session may have expired, been corrupted, or hit its context limit. Please try starting a new conversation.`)
    }

    // Check for context limit errors
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase()
      if (errorMessage.includes('context') || 
          errorMessage.includes('prompt too long') || 
          errorMessage.includes('exceeded') ||
          errorMessage.includes('200000') ||
          errorMessage.includes('200k')) {
        console.error('[Claude Code] CONTEXT LIMIT ERROR DETECTED:', error.message)
        // Re-throw with clear error message
        throw new Error(`Context limit exceeded: ${error.message}`)
      }
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
      aborted: controller.signal.aborted,
      stack: error instanceof Error ? error.stack : undefined
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


