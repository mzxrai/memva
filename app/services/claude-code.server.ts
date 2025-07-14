import { query, type SDKMessage } from '@anthropic-ai/claude-code'

interface StreamClaudeCodeOptions {
  prompt: string
  projectPath: string
  onMessage: (message: SDKMessage) => void
  onError?: (error: Error) => void
  abortController?: AbortController
}

export async function streamClaudeCodeResponse({
  prompt,
  projectPath,
  onMessage,
  onError,
  abortController
}: StreamClaudeCodeOptions): Promise<void> {
  const controller = abortController || new AbortController()

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