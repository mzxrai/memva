import type { Route } from "./+types/api.claude-code.$sessionId"
import { getSession, getLatestClaudeSessionId, updateClaudeSessionId } from "../db/sessions.service"
import { streamClaudeCodeResponse } from "../services/claude-code.server"
import { getEventsForSession } from "../db/event-session.service"

// GET endpoint for SSE event listening
export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.sessionId)
  if (!session) {
    return new Response("Session not found", { status: 404 })
  }

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  })

  // Create SSE stream that polls and sends new events
  let intervalId: ReturnType<typeof setInterval> | null = null
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let lastEventTimestamp: string | null = null
      
      // Send initial connection message
      const connectMsg = `data: ${JSON.stringify({ type: 'connection', status: 'connected' })}\n\n`
      controller.enqueue(encoder.encode(connectMsg))
      
      // Poll for new events every 500ms
      const pollEvents = async () => {
        try {
          const events = await getEventsForSession(params.sessionId)
          
          // Find new events since last check
          let newEvents: typeof events
          if (lastEventTimestamp !== null) {
            const timestamp = lastEventTimestamp
            newEvents = events.filter(e => e.timestamp > timestamp)
          } else {
            newEvents = events
          }
          
          // Send new events (they come newest first from DB, so reverse to send oldest first)
          for (const event of newEvents.reverse()) {
            // Send the complete event structure, don't spread the data
            const message = {
              uuid: event.uuid,
              event_type: event.event_type,
              timestamp: event.timestamp,
              memva_session_id: event.memva_session_id,
              data: event.data  // Keep data nested as expected by EventRenderer
            }
            
            const data = `data: ${JSON.stringify(message)}\n\n`
            controller.enqueue(encoder.encode(data))
          }
          
          // Update last timestamp
          if (events.length > 0) {
            lastEventTimestamp = events[0].timestamp // events[0] is newest
          }
        } catch (error) {
          console.error('[SSE] Error polling events:', error)
        }
      }
      
      // Initial poll
      await pollEvents()
      
      // Set up polling interval
      intervalId = setInterval(pollEvents, 500)
      
      // Clean up will be handled in cancel method
    },
    cancel() {
      // Stream canceled - cleanup
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
  })

  return new Response(stream, { headers })
}

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
  console.log('[API] Retrieved Claude session ID for resumption:', existingClaudeSessionId)
  
  // Get the latest event to use as parent UUID
  const events = await getEventsForSession(params.sessionId)
  const lastEvent = events.length > 0 ? events[0] : null // events are ordered newest first
  const lastParentUuid = lastEvent?.uuid || undefined
  
  // Don't store user event here - it's already stored by the page action
  // Just log that we're processing the prompt
  console.log(`[API] Processing prompt for session ${params.sessionId}`)
  console.log(`[API] Last parent UUID: ${lastParentUuid}`)

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
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      // Track stream state through controller.desiredSize
      
      // Simple check if stream is closed
      const checkStreamClosed = () => {
        return controller.desiredSize === null
      }

      const sendMessage = (message: Record<string, unknown>) => {
        if (checkStreamClosed()) {
          return
        }
        
        try {
          const data = `data: ${JSON.stringify(message)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch (error) {
          console.log(`[API Stream] Error sending message:`, error)
          // Abort Claude Code if we can't send messages
          if (!abortController.signal.aborted) {
            abortController.abort()
          }
        }
      }
      
      // Don't send the user message here - let SSE polling pick it up to avoid duplicates
      
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
          resumeSessionId: existingClaudeSessionId || undefined,
          initialParentUuid: lastParentUuid,
          onStoredEvent: (event) => {
            console.log(`[API] onStoredEvent called for type=${event.event_type}, aborted=${abortController.signal.aborted}`)
            
            // Don't send if aborted
            if (abortController.signal.aborted) {
              console.log(`[API] Skipping send due to abort`)
              return
            }
            
            // Send the complete event structure
            sendMessage({
              uuid: event.uuid,
              event_type: event.event_type,
              timestamp: event.timestamp,
              memva_session_id: event.memva_session_id,
              data: event.data  // Keep data nested as expected by EventRenderer
            })
          }
        })
        
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