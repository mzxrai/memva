import type { Session, Event, NewSession, NewEvent } from '../db/schema'

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
        role: 'assistant', 
        content 
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