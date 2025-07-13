# Claude Code Event Schema

This document describes the complete event schema for Claude Code sessions based on analysis of the JSONL files stored in `~/.claude/projects/`.

## Overview

Claude Code stores conversation history as JSONL (JSON Lines) files, where each line represents a single event. Sessions are organized by project path and stored with UUID filenames.

## File Organization

```
~/.claude/projects/
├── -Users-username-dev-project1/
│   ├── session-uuid-1.jsonl
│   └── session-uuid-2.jsonl
└── -Users-username-dev-project2/
    └── session-uuid-3.jsonl
```

Project directories use filesystem paths with slashes replaced by dashes.

## Event Types

### 1. User Event (`type: "user"`)

Represents messages from the user to Claude.

```typescript
interface UserEvent {
  // Core fields
  uuid: string;                    // Unique event ID
  parentUuid: string | null;       // Parent event UUID for threading
  sessionId: string;               // Session UUID
  timestamp: string;               // ISO 8601 timestamp
  type: "user";
  cwd: string;                     // Current working directory
  version: string;                 // Claude Code version (e.g., "1.0.43")
  userType: "external";            // User type
  isSidechain: boolean;            // Indicates parallel task execution (see Sidechains section)            // Indicates parallel task execution (see Sidechains section)
  
  // Message content
  message: {
    role: "user";
    content: Array<
      | TextContent
      | ToolResultContent
      | ImageContent
    >;
  };
  
  // Optional fields
  isMeta?: boolean;                // For meta messages (e.g., command outputs)
  toolUseResult?: ToolResult;      // Detailed tool execution results
}
```

#### User Content Types

```typescript
interface TextContent {
  type: "text";
  text: string;
}

interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;             // Matches assistant's tool_use id
  content: string | object;        // Tool output
}

interface ImageContent {
  type: "image";
  // Image data (format TBD based on examples)
}
```

### 2. Assistant Event (`type: "assistant"`)

Represents Claude's responses.

```typescript
interface AssistantEvent {
  // Core fields
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  type: "assistant";
  cwd: string;
  version: string;
  userType: "external";
  isSidechain: boolean;            // Indicates parallel task execution (see Sidechains section)
  
  // API request tracking
  requestId: string;               // API request ID
  
  // Message content
  message: {
    id: string;                    // Message ID from API
    type: "message";
    role: "assistant";
    model: string;                 // e.g., "claude-opus-4-20250514"
    content: Array<
      | AssistantTextContent
      | ToolUseContent
      | ThinkingContent
    >;
    stop_reason: string | null;    // e.g., "tool_use", "stop_sequence", null
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      output_tokens: number;
      service_tier: string;        // e.g., "standard"
    };
  };
}
```

#### Assistant Content Types

```typescript
interface AssistantTextContent {
  type: "text";
  text: string;
}

interface ToolUseContent {
  type: "tool_use";
  id: string;                      // Tool use ID (referenced in tool_result)
  name: string;                    // Tool name (e.g., "Read", "Bash", "Edit")
  input: object;                   // Tool-specific parameters
}

interface ThinkingContent {
  type: "thinking";
  text: string;                    // Extended thinking content
}
```

### 3. Summary Event (`type: "summary"`)

Represents session summaries.

```typescript
interface SummaryEvent {
  type: "summary";
  summary: string;                 // Summary text
  leafUuid: string;                // UUID of the last event summarized
}
```

## Tool Results

Tool results are stored in the `toolUseResult` field of user events that contain `tool_result` content.

### Common Tool Result Types

#### File Edit Result
```typescript
interface FileEditResult {
  type: "text";
  file: {
    filePath: string;
    content: string;               // New file content
  };
  originalFile: {
    filePath: string;
    content: string;               // Original content
  };
  structuredPatch: object;         // Git-style unified diff
  userModified: boolean;           // Whether user modified the suggestion
  oldString?: string;              // For Edit tool
  newString?: string;              // For Edit tool
  replaceAll?: boolean;            // For Edit tool
}
```

#### Bash Command Result
```typescript
interface BashResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs: number;
  // Additional fields may vary
}
```

#### Search/Glob Result
```typescript
interface SearchResult {
  filenames: string[];             // Matching file paths
  numFiles: number;
  truncated: boolean;
  durationMs: number;
}
```

#### Web Fetch Result
```typescript
interface WebResult {
  bytes: number;                   // Response size
  code: number;                    // HTTP status code
  codeText: string;                // e.g., "OK"
  result: string;                  // Fetched content
  durationMs: number;
  url: string;
}
```

#### Todo Write Result
```typescript
interface TodoResult {
  oldTodos: Todo[];
  newTodos: Todo[];
}

interface Todo {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
}
```

## Complete Example

Here's a complete example showing a tool use flow:

```json
// 1. Assistant uses a tool
{
  "uuid": "abc123",
  "parentUuid": null,
  "type": "assistant",
  "sessionId": "session123",
  "timestamp": "2025-07-13T20:00:00.000Z",
  "message": {
    "role": "assistant",
    "content": [{
      "type": "tool_use",
      "id": "toolu_123",
      "name": "Read",
      "input": {
        "file_path": "/path/to/file.ts"
      }
    }]
  }
  // ... other fields
}

// 2. User event with tool result
{
  "uuid": "def456",
  "parentUuid": "abc123",
  "type": "user",
  "sessionId": "session123",
  "timestamp": "2025-07-13T20:00:01.000Z",
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_123",
      "content": "File contents here..."
    }]
  },
  "toolUseResult": {
    "type": "text",
    "file": {
      "filePath": "/path/to/file.ts",
      "content": "File contents here..."
    }
  }
  // ... other fields
}
```

## Sidechains and Parallel Execution

The `isSidechain` field indicates whether an event is part of a parallel task execution:

- **`isSidechain: false`** - Events in the main conversation thread
- **`isSidechain: true`** - Events from parallel task execution via the Task tool

### How Sidechains Work

1. The main conversation uses the `Task` tool to spawn parallel research or processing tasks
2. Each Task creates a new conversation thread with:
   - `isSidechain: true`
   - `parentUuid: null` (starts a new thread)
   - Same `sessionId` as the main conversation
3. These sidechains run independently and complete their work
4. Results are merged back into the main conversation via `tool_result` events

### Example Flow

```
Main Thread (isSidechain: false):
├── User: "Research Claude Code architecture"
├── Assistant: Uses Task tool (spawns sidechain)
├── Assistant: Uses Task tool (spawns another sidechain)
└── User: tool_result from completed sidechains

Sidechain 1 (isSidechain: true):
├── User: Task prompt about architecture
├── Assistant: Researches architecture
└── Assistant: Returns results

Sidechain 2 (isSidechain: true):
├── User: Task prompt about usage patterns  
├── Assistant: Researches usage patterns
└── Assistant: Returns results
```

This enables Claude Code to work on multiple research tasks or analyses in parallel, improving efficiency for complex requests.

## Storage Considerations

When storing these events in a database:

1. **Preserve the complete JSON** - Store the full event JSON for future compatibility
2. **Index key fields** - sessionId, uuid, parentUuid, timestamp, type
3. **Extract searchable content** - Message text, file paths, tool names
4. **Handle large content** - Tool results can contain entire file contents
5. **Maintain threading** - Use parentUuid to reconstruct conversation flow
6. **Support filtering** - By project, date range, tool usage, etc.

## Schema Evolution

The schema has evolved over time (note different version numbers in events). Key considerations:

- New fields may be added in future versions
- Tool result structures may vary by tool and version
- Always handle missing optional fields gracefully
- The `version` field indicates the Claude Code version that created the event