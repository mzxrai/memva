import type { Route } from "./+types/api.claude-code.$sessionId"
import { getSession, getLatestClaudeSessionId } from "../db/sessions.service"
import { streamClaudeCodeResponse } from "../services/claude-code.server"

export async function action({ request, params }: Route.ActionArgs) {
  
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }
  
  // Check if request was already aborted
  if (request.signal.aborted) {
    return new Response("Request aborted", { status: 499 })
  }

  const formData = await request.formData()
  const prompt = formData.get("prompt") as string
  
  if (!prompt) {
    return new Response("Prompt is required", { status: 400 })
  }

  const session = await getSession(params.sessionId)
  if (!session) {
    return new Response("Session not found", { status: 404 })
  }

  // Get latest Claude sessionId from events
  const latestSessionId = await getLatestClaudeSessionId(params.sessionId)
  
  
  // Update session status to processing
  const { updateSessionClaudeStatus } = await import('../db/sessions.service')
  await updateSessionClaudeStatus(params.sessionId, 'processing')
  
  try {
    // Get global settings first
    const { getSettings } = await import('../db/settings.service')
    const globalSettings = await getSettings()
    
    // Get session-specific settings
    const { getSessionSettings } = await import('../db/sessions.service')
    const sessionSettings = await getSessionSettings(params.sessionId)
    
    // Merge settings with session settings taking precedence
    const maxTurns = sessionSettings?.maxTurns ?? globalSettings?.maxTurns ?? 200
    const permissionMode = sessionSettings?.permissionMode ?? globalSettings?.permissionMode ?? 'acceptEdits'
    
    await streamClaudeCodeResponse({
      prompt, 
      projectPath: session.project_path,
      memvaSessionId: params.sessionId,
      resumeSessionId: latestSessionId || undefined,
      abortController: request.signal ? { signal: request.signal } as AbortController : undefined,
      onMessage: () => {},
      onStoredEvent: () => {},
      maxTurns,
      permissionMode
    })
    
    // Wait a bit before updating status to ensure all events are processed
    setTimeout(async () => {
      await updateSessionClaudeStatus(params.sessionId, 'completed')
    }, 500)
    
    // Return a streaming response to the client
    return new Response("OK", { status: 200 })
  } catch (error) {
    console.error(`[API] Error in action:`, error)
    
    // Update status to error
    await updateSessionClaudeStatus(params.sessionId, 'error')
    
    // Check if it was an abort
    if (error instanceof Error && (error.name === 'AbortError' || request.signal.aborted)) {
      return new Response("Request aborted", { status: 499 })
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      `Error processing request: ${message}`, 
      { status: 500 }
    )
  }
}