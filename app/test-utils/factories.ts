import type { Session, Event, NewSession, NewEvent, Job, NewJob, Settings } from '../db/schema'
import type { SessionWithStats } from '../db/sessions.service'
import type { SettingsConfig } from '../types/settings'

/**
 * Test data factories for creating consistent mock data across tests.
 * Uses type-safe defaults with optional overrides.
 */

// Session Factory
export function createMockSession(overrides?: Partial<Session>): Session {
  return {
    id: crypto.randomUUID(),
    title: 'Test Session',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    project_path: '/test/project',
    metadata: null,
    claude_status: 'not_started',
    settings: null,
    ...overrides
  }
}

export function createMockNewSession(overrides?: Partial<NewSession>): NewSession {
  return {
    id: crypto.randomUUID(),
    title: 'Test Session',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    project_path: '/test/project',
    metadata: null,
    claude_status: 'not_started',
    settings: null,
    ...overrides
  }
}

export function createMockSessionWithStats(overrides?: Partial<SessionWithStats>): SessionWithStats {
  const base = createMockSession(overrides)
  return {
    ...base,
    event_count: 0,
    duration_minutes: 0,
    event_types: {},
    last_event_at: undefined,
    ...overrides
  }
}

// Event Factory
export function createMockEvent(overrides?: Partial<Event>): Event {
  return {
    uuid: crypto.randomUUID(),
    session_id: 'session-123',
    event_type: 'user',
    timestamp: new Date().toISOString(),
    is_sidechain: false,
    parent_uuid: null,
    cwd: '/test/project',
    project_name: 'test-project',
    data: { type: 'user', content: 'Test message' },
    memva_session_id: null,
    ...overrides
  }
}

export function createMockNewEvent(overrides?: Partial<NewEvent>): NewEvent {
  return {
    uuid: crypto.randomUUID(),
    session_id: 'session-123',
    event_type: 'user',
    timestamp: new Date().toISOString(),
    is_sidechain: false,
    parent_uuid: null,
    cwd: '/test/project',
    project_name: 'test-project',
    data: { type: 'user', content: 'Test message' },
    memva_session_id: null,
    ...overrides
  }
}

// Specialized Event Factories
export function createMockUserEvent(content: string, overrides?: Partial<Event>): Event {
  return createMockEvent({
    event_type: 'user',
    data: { type: 'user', content },
    ...overrides
  })
}

export function createMockAssistantEvent(content: string, overrides?: Partial<Event>): Event {
  return createMockEvent({
    event_type: 'assistant',
    data: {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: content }]
      }
    },
    ...overrides
  })
}

export function createMockSystemEvent(content: string, sessionId: string, overrides?: Partial<Event>): Event {
  return createMockEvent({
    event_type: 'system',
    session_id: sessionId,
    data: { type: 'system', content, session_id: sessionId },
    ...overrides
  })
}

// Tool Call Factories
export function createMockToolUseEvent(toolName: string, input: Record<string, unknown>, overrides?: Partial<Event>): Event {
  return createMockEvent({
    event_type: 'assistant',
    data: {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: `toolu_${crypto.randomUUID().slice(0, 8)}`,
          name: toolName,
          input
        }]
      }
    },
    ...overrides
  })
}

export function createMockToolResultEvent(toolUseId: string, content: string, overrides?: Partial<Event>): Event {
  return createMockEvent({
    event_type: 'user',
    data: {
      type: 'user',
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseId,
          content
        }]
      }
    },
    ...overrides
  })
}

// Tool Use Content for Component Tests
export type ToolUseContent = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export function createMockToolUse(toolName: string, input: Record<string, unknown>, overrides?: Partial<ToolUseContent>): ToolUseContent {
  return {
    type: 'tool_use',
    id: `toolu_${crypto.randomUUID().slice(0, 8)}`,
    name: toolName,
    input,
    ...overrides
  }
}

// Todo item type for TodoWrite factory
export type TodoItem = {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
}

// Common Tool Use Examples
export const MOCK_TOOLS = {
  read: (filePath: string) => createMockToolUse('Read', { file_path: filePath }),
  write: (filePath: string, content: string) => createMockToolUse('Write', { file_path: filePath, content }),
  bash: (command: string) => createMockToolUse('Bash', { command }),
  edit: (filePath: string, oldString: string, newString: string) => createMockToolUse('Edit', { file_path: filePath, old_string: oldString, new_string: newString }),
  todoWrite: (todos: TodoItem[]) => createMockToolUse('TodoWrite', { todos })
}

// Permission Request Factory
export function createMockPermissionRequest(overrides: Partial<{
  id: string
  session_id: string
  tool_name: string
  tool_use_id: string | null
  input: Record<string, unknown>
  status: string
  decision: string | null
  decided_at: string | null
  created_at: string
  expires_at: string
}> = {}): {
  id: string
  session_id: string
  tool_name: string
  tool_use_id: string | null
  input: Record<string, unknown>
  status: string
  decision: string | null
  decided_at: string | null
  created_at: string
  expires_at: string
} {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now
  
  return {
    id: `perm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    session_id: 'test-session-123',
    tool_name: 'Bash',
    tool_use_id: null,
    input: { command: 'ls -la' },
    status: 'pending',
    decision: null,
    decided_at: null,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    ...overrides
  }
}

// Job Factory
export function createMockJob(overrides?: Partial<Job>): Job {
  const now = new Date().toISOString()
  const defaultData: Record<string, unknown> = { sessionId: 'test-session-123', prompt: 'Test prompt' }
  return {
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'session-runner',
    data: defaultData,
    status: 'pending',
    priority: 5,
    attempts: 0,
    max_attempts: 3,
    error: null,
    result: null,
    scheduled_at: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides
  }
}

export function createMockNewJob(overrides?: Partial<NewJob>): NewJob {
  const now = new Date().toISOString()
  const defaultData: Record<string, unknown> = { sessionId: 'test-session-123', prompt: 'Test prompt' }
  return {
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'session-runner',
    data: defaultData,
    status: 'pending',
    priority: 5,
    attempts: 0,
    max_attempts: 3,
    error: null,
    result: null,
    scheduled_at: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides
  }
}

// Settings Factory
export function createMockSettings(overrides?: Partial<Settings>): Settings {
  const now = new Date().toISOString()
  return {
    id: 'singleton',
    config: {
      maxTurns: 30,
      permissionMode: 'default'
    },
    created_at: now,
    updated_at: now,
    ...overrides
  }
}

export function createMockSettingsConfig(overrides?: Partial<SettingsConfig>): SettingsConfig {
  return {
    maxTurns: 30,
    permissionMode: 'default',
    ...overrides
  }
}

// Form Data Factory
export function createMockFormData(data: Record<string, string | File> = {}): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}

// Image/File Factories
export function createMockFile(options: {
  name?: string
  type?: string
  size?: number
  content?: string
} = {}): File {
  const {
    name = 'test-image.png',
    type = 'image/png',
    content = 'fake-image-content'
  } = options
  
  const blob = new Blob([content], { type })
  return new File([blob], name, { type, lastModified: Date.now() })
}

export function createMockImageData(overrides: {
  id?: string
  file?: File
  preview?: string
} = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    file: overrides.file || createMockFile(),
    preview: overrides.preview || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  }
}

// Directory/Path Factories
export function createMockDirectoryData(overrides: {
  path?: string
  name?: string
  isDirectory?: boolean
  children?: Array<{ path: string; name: string; isDirectory: boolean }>
} = {}) {
  const path = overrides.path || '/test/project'
  return {
    path,
    name: overrides.name || path.split('/').pop() || 'project',
    isDirectory: overrides.isDirectory !== false,
    children: overrides.children || []
  }
}