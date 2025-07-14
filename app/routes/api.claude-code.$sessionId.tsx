import type { Route } from "./+types/api.claude-code.$sessionId"
import { getSession, getLatestClaudeSessionId, updateClaudeSessionId } from "../db/sessions.service"
import { streamClaudeCodeResponse } from "../services/claude-code.server"

export async function action({ request, params }: Route.ActionArgs) {
  console.log(`[API] Action called for session ${params.sessionId}`)
  
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const session = await getSession(params.sessionId)
  if (!session) {
    return new Response("Session not found", { status: 404 })
  }

  const formData = await request.formData()
  const prompt = formData.get("prompt") as string
  
  console.log(`[API] Received prompt: "${prompt}" for session ${params.sessionId}`)

  if (!prompt?.trim()) {
    return new Response("Prompt is required", { status: 400 })
  }

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  })

  const abortController = new AbortController()
  
  // Get existing Claude session ID for resumption
  const resumeSessionId = await getLatestClaudeSessionId(params.sessionId)
  console.log('[API] Retrieved Claude session ID for resumption:', resumeSessionId)
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isStreamClosed = false
      
      // Monitor if the stream is still writable
      const checkStreamClosed = () => {
        if (controller.desiredSize === null) {
          console.log(`[API Stream] Stream closed for session ${params.sessionId}`)
          isStreamClosed = true
          // Abort Claude Code when stream is closed
          if (!abortController.signal.aborted) {
            console.log(`[API Stream] Aborting Claude Code due to stream closure`)
            abortController.abort()
          }
          return true
        }
        return false
      }

      const sendMessage = (message: any) => {
        if (checkStreamClosed()) {
          console.log(`[API Stream] Attempted to send message to closed stream`)
          return
        }
        
        try {
          const data = `data: ${JSON.stringify(message)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch (error) {
          console.log(`[API Stream] Error sending message:`, error)
          isStreamClosed = true
          abortController.abort()
        }
      }
      
      // Set up periodic heartbeat to detect disconnection
      const heartbeatInterval = setInterval(() => {
        if (!isStreamClosed && !abortController.signal.aborted) {
          sendMessage({ type: "heartbeat", timestamp: new Date().toISOString() })
        } else {
          clearInterval(heartbeatInterval)
        }
      }, 5000) // Send heartbeat every 5 seconds

      try {
        const result = await streamClaudeCodeResponse({
          prompt: prompt.trim(),
          projectPath: session.project_path,
          onMessage: () => {
            // Don't send the raw message, wait for onStoredEvent
          },
          onError: (error) => {
            sendMessage({ type: "error", content: error.message, timestamp: new Date().toISOString() })
          },
          abortController,
          memvaSessionId: params.sessionId,
          resumeSessionId: resumeSessionId || undefined,
          onStoredEvent: (event) => {
            // Send the stored event which includes the database UUID
            sendMessage({
              ...event.data,
              uuid: event.uuid,
              memva_session_id: event.memva_session_id
            })
          }
        })
        
        clearInterval(heartbeatInterval)

        // Store the new Claude session ID if we got one
        if (result.lastSessionId) {
          console.log('[API] Storing new Claude session ID:', result.lastSessionId)
          await updateClaudeSessionId(params.sessionId, result.lastSessionId)
        } else {
          console.log('[API] No session ID returned from Claude Code')
        }

        // The Claude Code SDK sends a final message with type "result"
        // We don't need to send an additional done message
        controller.close()
      } catch (error) {
        sendMessage({ 
          type: "error", 
          content: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString()
        })
        controller.close()
      }
    },
    cancel() {
      // Called when the client disconnects
      console.log(`[API Cancel] Client disconnected for session ${params.sessionId}`)
      console.log(`[API Cancel] Calling abortController.abort()`)
      abortController.abort()
      console.log(`[API Cancel] AbortController aborted, signal.aborted = ${abortController.signal.aborted}`)
    }
  })

  return new Response(stream, { headers })
}