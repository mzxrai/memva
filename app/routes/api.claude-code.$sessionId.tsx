import type { Route } from "./+types/api.claude-code.$sessionId"
import { getSession } from "../db/sessions.service"
import { streamClaudeCodeResponse } from "../services/claude-code.server"

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const session = await getSession(params.sessionId)
  if (!session) {
    return new Response("Session not found", { status: 404 })
  }

  const formData = await request.formData()
  const prompt = formData.get("prompt") as string

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
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const sendMessage = (message: any) => {
        const data = `data: ${JSON.stringify(message)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      try {
        await streamClaudeCodeResponse({
          prompt: prompt.trim(),
          projectPath: session.project_path,
          onMessage: sendMessage,
          onError: (error) => {
            sendMessage({ type: "error", content: error.message, timestamp: new Date().toISOString() })
          },
          abortController
        })

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
      abortController.abort()
    }
  })

  return new Response(stream, { headers })
}