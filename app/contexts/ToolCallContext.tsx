import { createContext, useContext, useState, type ReactNode } from 'react'

interface ToolCall {
  id: string
  name: string
  input: unknown
  uuid: string
}

interface ToolCallContextType {
  toolCalls: Map<string, ToolCall>
  registerToolCall: (toolCall: ToolCall) => void
  getToolCall: (toolUseId: string) => ToolCall | undefined
}

const ToolCallContext = createContext<ToolCallContextType | undefined>(undefined)

export function ToolCallProvider({ children }: { children: ReactNode }) {
  const [toolCalls] = useState(new Map<string, ToolCall>())

  const registerToolCall = (toolCall: ToolCall) => {
    toolCalls.set(toolCall.id, toolCall)
  }

  const getToolCall = (toolUseId: string) => {
    return toolCalls.get(toolUseId)
  }

  return (
    <ToolCallContext.Provider value={{ toolCalls, registerToolCall, getToolCall }}>
      {children}
    </ToolCallContext.Provider>
  )
}

export function useToolCalls() {
  const context = useContext(ToolCallContext)
  if (!context) {
    throw new Error('useToolCalls must be used within a ToolCallProvider')
  }
  return context
}