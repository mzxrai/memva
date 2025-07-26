import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import type { SDKMessage } from '@anthropic-ai/claude-code'
import { createEventFromMessage, storeEvent } from '../db/events.service'

export class ContextLimitError extends Error {
  constructor(message: string, public readonly sessionId?: string) {
    super(message)
    this.name = 'ContextLimitError'
  }
}

interface StreamClaudeCliOptions {
  prompt: string
  projectPath: string
  memvaSessionId?: string
  resumeSessionId?: string
  abortController?: AbortController
  onMessage: (message: SDKMessage) => void
  onStoredEvent: (event: unknown) => void
  onError?: (error: Error) => void
  maxTurns?: number
  permissionMode?: string
  initialParentUuid?: string | null
  timeoutMs?: number
}

/**
 * Find the Claude executable by checking multiple possible locations
 * Returns { command, args } to handle different installation methods
 */
function findClaudeExecutable(): { command: string; args: string[] } {
  // 1. Check if 'claude' is in PATH
  try {
    execSync('which claude', { encoding: 'utf-8' }).trim()
    console.debug('[Claude CLI] Found claude in PATH')
    return { command: 'claude', args: [] }
  } catch {
    // 'which' command failed, continue to other methods
  }

  // 2. Check local node_modules (for local installation)
  const localPackage = join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-code', 'package.json')
  if (existsSync(localPackage)) {
    console.debug('[Claude CLI] Found local installation, using npx')
    return { command: 'npx', args: ['claude-code'] }
  }

  // 3. Try using npx with global install
  try {
    execSync('npm list -g @anthropic-ai/claude-code', { encoding: 'utf-8' })
    console.debug('[Claude CLI] Found global npm installation, using npx')
    return { command: 'npx', args: ['claude-code'] }
  } catch {
    // Not installed globally
  }

  // 4. Check common binary locations
  const binaryPaths = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    join(process.env.HOME || '', '.local', 'bin', 'claude'),
  ]

  for (const path of binaryPaths) {
    if (existsSync(path)) {
      console.debug('[Claude CLI] Found binary at:', path)
      return { command: path, args: [] }
    }
  }

  throw new Error(
    'Claude executable not found. Please ensure Claude Code is installed. ' +
    'Run: npm install -g @anthropic-ai/claude-code'
  )
}

/**
 * Parse a line of stream-json output
 */
function parseJsonLine(line: string): SDKMessage | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed) as SDKMessage
  } catch {
    // Not JSON, might be debug output
    return null
  }
}

/**
 * Stream response from Claude CLI instead of using the SDK
 */
export async function streamClaudeCliResponse({
  prompt,
  projectPath,
  memvaSessionId,
  resumeSessionId,
  abortController: controller = new AbortController(),
  onMessage,
  onStoredEvent,
  onError,
  maxTurns = 200,
  permissionMode = 'acceptEdits',
  initialParentUuid,
  timeoutMs = 24 * 60 * 60 * 1000 // 24 hours default
}: StreamClaudeCliOptions) {
  let timeoutAbort = false
  
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
  let stderrBuffer = ''
  let stdoutBuffer = ''
  let childProcess: ChildProcess | null = null
  let contextLimitError: ContextLimitError | null = null

  // Create our own abort controller that we'll trigger when ready
  const internalAbortController = new AbortController()

  // Monitor the external abort signal
  controller.signal.addEventListener('abort', () => {
    abortRequested = true

    // Only actually abort if we've received an assistant message
    if (hasReceivedAssistantMessage) {
      isAborted = true
      internalAbortController.abort()
      if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM')
      }
    } else {
      earlyAbortRequested = true
    }
  })

  try {
    const { command, args: executableArgs } = findClaudeExecutable()
    
    // Build command line arguments
    const args: string[] = [
      ...executableArgs, // Include any args from findClaudeExecutable (like 'claude-code' for npx)
      '--print', // Non-interactive mode  
      '--output-format', 'stream-json',
      '--input-format', 'text', // Expect text input from stdin
      '--verbose', // Required for stream-json output
      '--debug', // Enable debug mode to capture errors
      '--max-turns', maxTurns.toString(),
      '--permission-mode', permissionMode,
    ]

    if (resumeSessionId) {
      args.push('--resume', resumeSessionId)
    }

    // Add MCP configuration if we have a memva session ID
    if (memvaSessionId) {
      const mcpServerPath = join(process.cwd(), 'mcp-permission-server', 'build', 'index.js')
      const mcpConfig = {
        mcpServers: {
          'memva-permissions': {
            command: 'node',
            args: [mcpServerPath, '--session-id', memvaSessionId]
          }
        }
      }
      args.push('--mcp-config', JSON.stringify(mcpConfig))
      args.push('--permission-prompt-tool', 'mcp__memva-permissions__approval_prompt')
      args.push('--allowedTools', 'Read,mcp__memva-permissions__approval_prompt')
    } else {
      args.push('--allowedTools', 'Read')
    }

    console.debug('[Claude CLI] Executing:', command, args.map(arg => {
      // Show args with proper quoting for debugging
      if (arg.includes(' ') || arg.includes('{')) {
        return `"${arg}"`
      }
      return arg
    }).join(' '))
    console.debug('[Claude CLI] Prompt (via stdin):', prompt.substring(0, 100) + '...')

    // Spawn the process with proper array arguments
    childProcess = spawn(command, args, {
      cwd: projectPath,
      env: { ...process.env },
      signal: internalAbortController.signal,
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
      shell: false // Use array args, not shell parsing
    })


    // Write prompt to stdin and close it
    childProcess.stdin?.write(prompt)
    childProcess.stdin?.end()

    // Handle stdout (JSON messages)
    childProcess.stdout?.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString()
      
      // Process complete lines
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        const message = parseJsonLine(line)
        if (!message) continue

        console.debug('[Claude CLI] Received message:', JSON.stringify(message).substring(0, 200))
        messageCount++

        // Track session ID from each message
        if ('session_id' in message) {
          const newClaudeSessionId = message.session_id
          console.debug('[Claude CLI] Message has session_id:', newClaudeSessionId)

          if (lastSessionId !== newClaudeSessionId) {
            console.debug('[Claude CLI] Session ID changed from', lastSessionId, 'to', newClaudeSessionId)
            lastSessionId = newClaudeSessionId
          }

          // Update the Claude session ID in the database
          if (memvaSessionId && lastSessionId && lastSessionId !== resumeSessionId) {
            const sessionIdToUpdate = lastSessionId
            import('../db/sessions.service').then(({ updateClaudeSessionId }) => {
              updateClaudeSessionId(memvaSessionId, sessionIdToUpdate)
            })
            resumeSessionId = lastSessionId
          }
        }

        // ONLY check result messages with is_error=true to avoid false positives
        // (e.g. user asking Claude about handling "prompt is too long" errors!)
        if (message.type === 'result' && message.is_error === true && 'result' in message && message.result) {
          const resultText = typeof message.result === 'string' ? message.result : ''
          if (resultText.toLowerCase().includes('too long') || 
              resultText.toLowerCase().includes('context') ||
              resultText.toLowerCase().includes('limit')) {
            console.error('[Claude CLI] Context limit error in result:', resultText)
            contextLimitError = new ContextLimitError(resultText, lastSessionId)
            // Don't throw here - it crashes the stdout handler!
            // We'll handle it after the process completes
          }
        }
        
        // Mark that we've received the first message
        if (!hasReceivedFirstMessage) {
          hasReceivedFirstMessage = true
        }

        // Mark if we've received an assistant message
        if (message.type === 'assistant' && !hasReceivedAssistantMessage) {
          hasReceivedAssistantMessage = true

          // Check if abort was requested before assistant message
          if (abortRequested && !earlyAbortRequested) {
            isAborted = true
            internalAbortController.abort()
            if (childProcess && !childProcess.killed) {
              childProcess.kill('SIGTERM')
            }
          }
        }

        // Call onMessage for all messages
        onMessage(message)

        // Store event if we have memvaSessionId
        if (memvaSessionId) {
          // Skip storing messages if early abort requested
          if (earlyAbortRequested && message.type !== 'system') {
            if (message.type === 'assistant') {
              isAborted = true
              internalAbortController.abort()
              if (childProcess && !childProcess.killed) {
                childProcess.kill('SIGTERM')
              }
              continue
            }
            continue
          }

          const event = createEventFromMessage({
            message,
            memvaSessionId,
            projectPath,
            parentUuid: lastEventUuid,
            timestamp: new Date().toISOString()
          })

          storeEvent(event).then(() => {
            lastEventUuid = event.uuid
            if (onStoredEvent) {
              onStoredEvent(event)
            }
          })
        }

        // Check abort again after processing
        if (isAborted) {
          break
        }
      }
    })

    // Handle stderr (debug output and errors)
    childProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      stderrBuffer += text

      // Log debug output
      const lines = text.split('\n')
      for (const line of lines) {
        if (line.trim()) {
          console.debug('[Claude CLI stderr]', line)
        }
      }
    })

    // Wait for process to complete
    await new Promise<void>((resolve, reject) => {
      if (!childProcess) {
        reject(new Error('Child process not initialized'))
        return
      }
      
      childProcess.on('close', (code) => {
        // Check if we detected a context limit error FIRST
        if (contextLimitError) {
          reject(contextLimitError)
          return
        }
        
        if (code === 0) {
          resolve()
        } else {
          const error = new Error(`Claude Code process exited with code ${code}`)
          // Attach stderr for error context
          ;(error as Error & { stderr?: string }).stderr = stderrBuffer
          reject(error)
        }
      })

      childProcess.on('error', (error) => {
        // Check context limit error here too
        if (contextLimitError) {
          reject(contextLimitError)
        } else {
          reject(error)
        }
      })
    })

  } catch (error) {
    console.debug('[Claude CLI] Caught error:', error)
    console.debug('[Claude CLI] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.debug('[Claude CLI] Message count:', messageCount)
    console.debug('[Claude CLI] Resume session ID:', resumeSessionId)
    console.debug('[Claude CLI] Stderr buffer:', stderrBuffer)

    // Check if this is a resume failure
    if (error instanceof Error &&
      error.message.includes('exited with code 1') &&
      messageCount === 0 &&
      resumeSessionId) {
      
      // Parse specific errors from stderr
      if (stderrBuffer.includes('No conversation found with session ID')) {
        console.error('[Claude CLI] Session not found error detected')
        throw new Error(`Claude session ${resumeSessionId} no longer exists. Please start a new conversation.`)
      }
      
      // Note: Context limit errors come through JSON messages, not stderr
      // Keep this check just in case stderr behavior changes
      if (stderrBuffer.includes('context window') || stderrBuffer.includes('prompt too long')) {
        console.error('[Claude CLI] Context limit error detected in stderr')
        throw new ContextLimitError(`Claude session has reached its context limit.`, resumeSessionId)
      }
      
      // Generic resume failure
      console.error('[Claude CLI] Resume failure - propagating error')
      throw new Error(`Failed to resume Claude session. The session may have expired or been corrupted. Please try starting a new conversation.`)
    }

    // Check if this is an abort error
    if (isAborted || controller.signal.aborted) {
      if (timeoutAbort) {
        throw new Error(`Claude Code session timed out after ${timeoutMs / 60000} minutes`)
      } else {
        return { lastSessionId }
      }
    }

    // Check for specific error patterns in stderr
    if (stderrBuffer) {
      // 529 - Overloaded error
      if (stderrBuffer.includes('529') || stderrBuffer.includes('overloaded')) {
        console.error('[Claude CLI] Model overloaded error detected')
        throw new Error('Claude is currently overloaded. Please try again in a few moments.')
      }

      // 502/503/504 - Gateway/Service errors
      if (stderrBuffer.match(/50[234]/)) {
        console.error('[Claude CLI] Service error detected')
        throw new Error('Claude service is temporarily unavailable. Please try again.')
      }

      // Rate limit errors
      if (stderrBuffer.includes('rate limit') || stderrBuffer.includes('429')) {
        console.error('[Claude CLI] Rate limit error detected')
        throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
      }

      // Authentication errors
      if (stderrBuffer.includes('401') || stderrBuffer.includes('unauthorized') || stderrBuffer.includes('authentication')) {
        console.error('[Claude CLI] Authentication error detected')
        throw new Error('Authentication failed. Please check your Claude credentials.')
      }
    }

    // For non-abort errors, log and handle
    console.error(`[Claude CLI] Error caught:`, error)
    console.error(`[Claude CLI] Error details:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      aborted: controller.signal.aborted,
      stderr: stderrBuffer
    })

    // Always throw ContextLimitError so it can be caught by session-runner
    if (error instanceof ContextLimitError) {
      throw error
    }
    
    if (onError && error instanceof Error) {
      onError(error)
    } else {
      throw error
    }
  } finally {
    clearTimeout(timeoutId)
    
    // Ensure child process is cleaned up
    if (childProcess && !childProcess.killed) {
      childProcess.kill('SIGTERM')
    }
  }

  return { lastSessionId }
}