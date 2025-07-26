import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../../../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../../../test-utils/database-mocking'
import { waitForCondition } from '../../../test-utils/async-testing'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock claude-cli.server to avoid spawning actual processes
vi.mock('../../../services/claude-cli.server', () => ({
  streamClaudeCliResponse: vi.fn().mockImplementation(async ({ 
    onMessage, 
    onStoredEvent,
    memvaSessionId,
    projectPath,
    initialParentUuid
  }) => {
    const { createEventFromMessage, storeEvent } = await import('../../../db/events.service')
    
    // Simulate successful Claude Code messages
    const messages = [
      { type: 'system' as const, subtype: 'error' as const, content: 'Session started', session_id: 'mock-session-id' },
      { type: 'user' as const, content: 'User message', session_id: 'mock-session-id' },
      { type: 'assistant' as const, content: 'Assistant response', session_id: 'mock-session-id' },
      { type: 'result' as const, content: '', session_id: 'mock-session-id' }
    ]
    
    let lastEventUuid = initialParentUuid || null
    
    for (const message of messages) {
      // Call onMessage callback
      onMessage(message)
      
      // Store event if memvaSessionId is provided
      if (memvaSessionId) {
        const event = createEventFromMessage({
          message,
          memvaSessionId,
          projectPath,
          parentUuid: lastEventUuid,
          timestamp: new Date().toISOString()
        })
        
        await storeEvent(event)
        lastEventUuid = event.uuid
        
        if (onStoredEvent) {
          onStoredEvent(event)
        }
      }
    }
    
    return { lastSessionId: 'mock-session-id' }
  })
}))

import { sessionRunnerHandler } from '../session-runner.handler'
import { getSession } from '../../../db/sessions.service'

describe('Session Runner Handler Status Updates', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should update claude_status to completed when handler succeeds', async () => {
    const session = testDb.createSession({ 
      title: 'Test Session', 
      project_path: '/test',
      claude_status: 'processing'
    })

    const mockJob = {
      id: 'test-job-1',
      type: 'session-runner',
      data: {
        sessionId: session.id,
        prompt: 'Hello Claude'
      }
    }

    let callbackResult: any = null
    const callback = (error: Error | null, result?: any) => {
      callbackResult = { error, result }
    }

    await sessionRunnerHandler(mockJob, callback)

    // Wait for status update to complete
    await waitForCondition(async () => {
      const updatedSession = await getSession(session.id)
      return updatedSession?.claude_status === 'completed'
    })

    const finalSession = await getSession(session.id)
    expect(finalSession?.claude_status).toBe('completed')
    expect(callbackResult?.error).toBeNull()
    expect(callbackResult?.result?.success).toBe(true)
  })

  it('should handle missing session gracefully', async () => {
    const mockJob = {
      id: 'test-job-2', 
      type: 'session-runner',
      data: {
        sessionId: 'non-existent-session',
        prompt: 'Hello Claude'
      }
    }

    let callbackResult: any = null
    const callback = (error: Error | null, result?: any) => {
      callbackResult = { error, result }
    }

    await sessionRunnerHandler(mockJob, callback)

    expect(callbackResult?.error).toBeInstanceOf(Error)
    expect(callbackResult?.error?.message).toContain('Session not found')
  })

})