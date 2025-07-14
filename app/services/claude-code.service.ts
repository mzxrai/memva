export type SDKMessage = {
  type: string
  content: string
  timestamp?: string
  uuid?: string
  memva_session_id?: string
}

export interface SendPromptOptions {
  prompt: string
  sessionId: string
  onMessage: (message: SDKMessage) => void
  onError?: (error: Error) => void
  signal?: AbortSignal
}

export function sendPromptToClaudeCode({
  prompt,
  sessionId,
  onMessage,
  onError,
  signal
}: SendPromptOptions): void {
  const formData = new FormData()
  formData.append('prompt', prompt)

  fetch(`/api/claude-code/${sessionId}`, {
    method: 'POST',
    body: formData,
    signal
  }).then(async response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'result') {
              onMessage(data)
              return
            }
            onMessage(data)
          } catch (e) {
            console.error('Failed to parse SSE message:', e)
          }
        }
      }
    }
  }).catch(error => {
    if (onError) {
      onError(error)
    } else {
      console.error('Claude Code streaming error:', error)
    }
  })
}