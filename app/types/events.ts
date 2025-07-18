// Types based on EVENT_SCHEMA.md

// User message content types
export interface TextContent {
  type: 'text'
  text: string
}

export interface ToolResultContent {
  type: 'tool_result'
  tool_use_id: string
  content: string | object
}

export interface ImageContent {
  type: 'image'
  // Image data format TBD
}

export type UserMessageContent = TextContent | ToolResultContent | ImageContent

// Assistant message content types
export interface AssistantTextContent {
  type: 'text'
  text: string
}

export interface ToolUseContent {
  type: 'tool_use'
  id: string
  name: string
  input: object
}

export interface ThinkingContent {
  type: 'thinking'
  thinking: string
  signature?: string
}

export type AssistantMessageContent = AssistantTextContent | ToolUseContent | ThinkingContent

// Event types
export interface BaseEvent {
  uuid: string
  parentUuid: string | null
  sessionId: string
  timestamp: string
  cwd: string
  version: string
  userType: 'external'
  isSidechain: boolean
}

export interface UserEvent extends BaseEvent {
  type: 'user'
  message: {
    role: 'user'
    content: UserMessageContent[]
  }
  isMeta?: boolean
  toolUseResult?: object
}

export interface AssistantEvent extends BaseEvent {
  type: 'assistant'
  requestId: string
  message: {
    id: string
    type: 'message'
    role: 'assistant'
    model: string
    content: AssistantMessageContent[]
    stop_reason: string | null
    stop_sequence: string | null
    usage: {
      input_tokens: number
      cache_creation_input_tokens: number
      cache_read_input_tokens: number
      output_tokens: number
      service_tier: string
    }
  }
}

export interface SummaryEvent {
  type: 'summary'
  summary: string
  leafUuid: string
}

// Additional event types used in the system
export interface SystemEvent {
  type: 'system'
  content: string
  session_id?: string
  timestamp?: string
  uuid?: string
}

export interface ErrorEvent {
  type: 'error' | 'user_cancelled'
  content: string
  session_id?: string
  timestamp?: string
  uuid?: string
}

export interface ResultEvent {
  type: 'result'
  content: string
  session_id?: string
  timestamp?: string
  uuid?: string
}

export type ClaudeEvent = UserEvent | AssistantEvent | SummaryEvent | SystemEvent | ErrorEvent | ResultEvent

// Union type for any event that might be passed to our components
// Using a flexible type to handle various event shapes from different sources
export type AnyEvent = Record<string, unknown> & {
  type?: string
  event_type?: string
  uuid?: string
  timestamp?: string
  content?: unknown
  message?: unknown
  data?: unknown
}

// Database row type
export interface EventRow {
  uuid: string
  session_id: string
  event_type: 'user' | 'assistant' | 'summary' | 'system' | 'error' | 'user_cancelled' | 'result'
  timestamp: string
  is_sidechain: boolean
  parent_uuid: string | null
  cwd: string
  project_name: string
  data: string // JSON string of ClaudeEvent
  memva_session_id?: string
}