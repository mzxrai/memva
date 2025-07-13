import { describe, it, expect } from 'vitest'

describe('Claude Code Event Types', () => {
  it('should identify all event types from JSONL', () => {
    // Based on analysis of ~/.claude/projects/*.jsonl files
    const eventTypes = [
      'user',      // User messages
      'assistant', // Assistant responses
      'summary'    // Session summaries
    ]
    
    expect(eventTypes).toHaveLength(3)
  })

  it('should identify all user message content types', () => {
    const userContentTypes = [
      'text',        // Regular text messages
      'tool_result', // Results from tool executions
      'image'        // Pasted images/screenshots
    ]
    
    expect(userContentTypes).toHaveLength(3)
  })

  it('should identify all assistant message content types', () => {
    const assistantContentTypes = [
      'text',      // Regular text responses
      'tool_use',  // Tool invocations
      'thinking'   // Extended thinking blocks
    ]
    
    expect(assistantContentTypes).toHaveLength(3)
  })

  it('should identify core event fields', () => {
    const coreEventFields = {
      uuid: 'string',              // Unique ID for this event
      parentUuid: 'string | null', // Parent event UUID (for threading)
      sessionId: 'string',         // Session UUID
      timestamp: 'string',         // ISO timestamp
      type: 'user | assistant | summary',
      cwd: 'string',               // Current working directory
      version: 'string',           // Claude Code version
      userType: 'string',          // e.g., "external"
      isSidechain: 'boolean',      // For parallel conversations
      message: 'object',           // The actual message content
    }
    
    expect(Object.keys(coreEventFields)).toHaveLength(10)
  })

  it('should identify optional event fields', () => {
    const optionalFields = {
      requestId: 'string',         // For API tracking
      toolUseResult: 'object',     // Tool execution results
      isMeta: 'boolean',           // Meta messages
      leafUuid: 'string',          // For summary events
      summary: 'string',           // For summary events
    }
    
    expect(Object.keys(optionalFields)).toHaveLength(5)
  })

  it('should identify tool result structures', () => {
    const toolResultTypes = {
      // File operations
      fileEdit: {
        type: 'text',
        file: {
          filePath: 'string',
          content: 'string'
        },
        originalFile: 'object',
        structuredPatch: 'object',  // Git-style diff
        userModified: 'boolean',
        oldString: 'string',
        newString: 'string',
        replaceAll: 'boolean'
      },
      
      // Command execution
      bashResult: {
        stdout: 'string',
        stderr: 'string',
        exitCode: 'number',
        durationMs: 'number'
      },
      
      // Search results
      searchResult: {
        filenames: 'string[]',
        numFiles: 'number',
        truncated: 'boolean',
        durationMs: 'number'
      },
      
      // Web operations
      webResult: {
        bytes: 'number',
        code: 'number',
        codeText: 'string',
        result: 'string',
        durationMs: 'number',
        url: 'string'
      }
    }
    
    expect(Object.keys(toolResultTypes)).toHaveLength(4)
  })

  it('should identify message structures', () => {
    // User message structure
    const userMessage = {
      role: 'user',
      content: [
        {
          type: 'text' | 'tool_result' | 'image',
          text: 'string?',           // For text
          tool_use_id: 'string?',    // For tool_result
          content: 'string | array?' // For tool_result
        }
      ]
    }
    
    // Assistant message structure
    const assistantMessage = {
      id: 'string',
      type: 'message',
      role: 'assistant',
      model: 'string',
      content: [
        {
          type: 'text' | 'tool_use' | 'thinking',
          text: 'string?',      // For text/thinking
          id: 'string?',        // For tool_use
          name: 'string?',      // For tool_use
          input: 'object?'      // For tool_use
        }
      ],
      stop_reason: 'string | null',
      stop_sequence: 'string | null',
      usage: {
        input_tokens: 'number',
        cache_creation_input_tokens: 'number',
        cache_read_input_tokens: 'number',
        output_tokens: 'number',
        service_tier: 'string'
      }
    }
    
    expect(userMessage.content[0]).toBeDefined()
    expect(assistantMessage.content[0]).toBeDefined()
  })
})