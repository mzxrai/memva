import type { Route } from "./+types/api.claude-code.$sessionId"
import { getSession, getLatestClaudeSessionId, updateClaudeSessionId } from "../db/sessions.service"
import { streamClaudeCodeResponse } from "../services/claude-code.server"
import { createEventFromMessage, storeEvent } from "../services/events.service"

export async function action({ request, params }: Route.ActionArgs) {
  console.log(`[API] Action called for session ${params.sessionId}`)
  
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }
  
  // Check if request was already aborted
  if (request.signal.aborted) {
    console.log(`[API] Request already aborted on arrival`)
    return new Response("Request aborted", { status: 499 })
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

  // Get the latest Claude session ID if we're resuming
  const existingClaudeSessionId = await getLatestClaudeSessionId(params.sessionId)
  
  // Store user prompt as an event
  const userEvent = createEventFromMessage({
    message: {
      type: 'user',
      content: prompt.trim(),
      session_id: existingClaudeSessionId || ''  // Use existing session ID if resuming
    } as any,
    memvaSessionId: params.sessionId,
    projectPath: session.project_path,
    parentUuid: null,
    timestamp: new Date().toISOString()
  })
  
  await storeEvent(userEvent)
  console.log(`[API] Stored user prompt as event with UUID: ${userEvent.uuid}`)

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  })

  const abortController = new AbortController()
  
  // Forward the request abort signal to our controller
  request.signal.addEventListener('abort', () => {
    const abortTime = new Date().toISOString()
    console.log(`[API] Request signal aborted at ${abortTime}`)
    if (!abortController.signal.aborted) {
      abortController.abort()
    }
  })
  
  // Use the existing Claude session ID we already retrieved
  const resumeSessionId = existingClaudeSessionId
  console.log('[API] Retrieved Claude session ID for resumption:', resumeSessionId)
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isStreamClosed = false
      let lastParentUuid = userEvent.uuid
      
      // Simple check if stream is closed
      const checkStreamClosed = () => {
        if (controller.desiredSize === null) {
          isStreamClosed = true
          return true
        }
        return false
      }

      const sendMessage = (message: any) => {
        if (checkStreamClosed()) {
          return
        }
        
        try {
          const data = `data: ${JSON.stringify(message)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch (error) {
          console.log(`[API Stream] Error sending message:`, error)
          isStreamClosed = true
          // Abort Claude Code if we can't send messages
          if (!abortController.signal.aborted) {
            abortController.abort()
          }
        }
      }
      
      // Send the user message immediately
      sendMessage({
        ...(typeof userEvent.data === 'object' && userEvent.data !== null ? userEvent.data : {}),
        uuid: userEvent.uuid,
        memva_session_id: userEvent.memva_session_id
      })
      
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
          initialParentUuid: lastParentUuid,
          onStoredEvent: (event) => {
            console.log(`[API] onStoredEvent called for type=${event.event_type}, aborted=${abortController.signal.aborted}`)
            
            // Don't send if aborted
            if (abortController.signal.aborted) {
              console.log(`[API] Skipping send due to abort`)
              return
            }
            
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
      const cancelTime = new Date().toISOString()
      console.log(`[API Cancel] Client disconnected for session ${params.sessionId} at ${cancelTime}`)
      console.log(`[API Cancel] Calling abortController.abort()`)
      abortController.abort()
      console.log(`[API Cancel] AbortController aborted, signal.aborted = ${abortController.signal.aborted}`)
    }
  })

  return new Response(stream, { headers })
}