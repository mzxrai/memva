import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForCondition } from '../test-utils/async-testing'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock claude-cli.server to avoid spawning actual processes
vi.mock('../services/claude-cli.server', () => ({
  streamClaudeCliResponse: vi.fn().mockImplementation(async ({ 
    prompt,
    onMessage, 
    onStoredEvent,
    memvaSessionId,
    projectPath,
    initialParentUuid
  }) => {
    const { createEventFromMessage, storeEvent } = await import('../db/events.service')
    
    // Simulate Claude Code messages
    const messages = []
    
    // Check if prompt is valid
    if (!prompt || prompt.trim() === '') {
      throw new Error('Invalid prompt: prompt cannot be empty')
    }
    
    messages.push({ type: 'system' as const, subtype: 'error' as const, content: 'Session started', session_id: 'mock-session-id' })
    messages.push({ type: 'user' as const, content: prompt, session_id: 'mock-session-id' })
    messages.push({ type: 'assistant' as const, content: 'Mock response', session_id: 'mock-session-id' })
    messages.push({ type: 'result' as const, content: '', session_id: 'mock-session-id' })
    
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

describe('Session Runner Handler', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('Claude Code SDK Integration', () => {
    it('should execute Claude Code SDK calls asynchronously', async () => {
      // This test will fail until we implement session runner handler
      const { sessionRunnerHandler } = await import('../workers/handlers/session-runner.handler')
      
      // Create a session first
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      const mockJob = {
        id: 'job-123',
        type: 'session-runner',
        data: {
          sessionId: session.id,
          prompt: 'Hello Claude, please help with this task',
          userId: 'user-789'
        }
      }
      
      let callbackCalled = false
      let callbackResult: unknown = null
      let callbackError: Error | null = null
      
      const callback = (error: Error | null, result?: unknown) => {
        callbackCalled = true
        callbackError = error
        callbackResult = result
      }
      
      // Execute the handler
      sessionRunnerHandler(mockJob, callback)
      
      // Wait for the async operation to complete
      await waitForCondition(() => callbackCalled, { timeoutMs: 5000 })
      
      expect(callbackError).toBeNull()
      expect(callbackResult).toBeDefined()
      expect(callbackResult).toEqual({
        success: true,
        sessionId: session.id,
        messagesProcessed: expect.any(Number),
        userId: 'user-789'
      })
    })

    it('should handle Claude Code SDK errors gracefully', async () => {
      // This test will fail until we implement error handling
      const { sessionRunnerHandler } = await import('../workers/handlers/session-runner.handler')
      
      // Create a session first
      const session = testDb.createSession({
        title: 'Test Session', 
        project_path: '/test/project'
      })
      
      const mockJob = {
        id: 'job-123', 
        type: 'session-runner',
        data: {
          sessionId: session.id,
          prompt: '   ', // Whitespace-only prompt should cause error
          userId: 'user-789'
        }
      }
      
      let callbackCalled = false
      let callbackError: Error | null = null
      
      const callback = (error: Error | null) => {
        callbackCalled = true
        callbackError = error
      }
      
      sessionRunnerHandler(mockJob, callback)
      
      await waitForCondition(() => callbackCalled, { timeoutMs: 5000 })
      
      expect(callbackError).toBeInstanceOf(Error)
      expect(callbackError).toBeTruthy()
      expect((callbackError as unknown as Error).message).toContain('Invalid prompt')
    })

    it('should store session events in database during processing', async () => {
      // This test will fail until we implement event storage
      const { sessionRunnerHandler } = await import('../workers/handlers/session-runner.handler')
      const { getEventsForSession } = await import('../db/event-session.service')
      
      // Create a session first
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      const mockJob = {
        id: 'job-123',
        type: 'session-runner', 
        data: {
          sessionId: session.id,
          prompt: 'Test prompt for session',
          userId: 'user-789'
        }
      }
      
      let callbackCalled = false
      const callback = () => {
        callbackCalled = true
      }
      
      sessionRunnerHandler(mockJob, callback)
      
      await waitForCondition(() => callbackCalled, { timeoutMs: 5000 })
      
      // Check that events were stored
      const events = await getEventsForSession(session.id)
      expect(events.length).toBeGreaterThan(0)
      
      // Should have at least a user event for the prompt
      const userEvents = events.filter(e => e.event_type === 'user')
      expect(userEvents.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle multiple concurrent session jobs', async () => {
      // This test will fail until we implement concurrent handling
      const { sessionRunnerHandler } = await import('../workers/handlers/session-runner.handler')
      
      const session1 = testDb.createSession({ title: 'Session 1', project_path: '/test1' })
      const session2 = testDb.createSession({ title: 'Session 2', project_path: '/test2' })
      
      const mockJob1 = {
        id: 'job-1',
        type: 'session-runner',
        data: {
          sessionId: session1.id,
          prompt: 'First session prompt',
          userId: 'user-1'
        }
      }
      
      const mockJob2 = {
        id: 'job-2', 
        type: 'session-runner',
        data: {
          sessionId: session2.id,
          prompt: 'Second session prompt',
          userId: 'user-2'
        }
      }
      
      let callback1Called = false
      let callback2Called = false
      
      const callback1 = () => { callback1Called = true }
      const callback2 = () => { callback2Called = true }
      
      // Start both jobs concurrently
      sessionRunnerHandler(mockJob1, callback1)
      sessionRunnerHandler(mockJob2, callback2)
      
      // Both should complete
      await waitForCondition(() => callback1Called && callback2Called, { timeoutMs: 8000 })
      
      expect(callback1Called).toBe(true)
      expect(callback2Called).toBe(true)
    })
  })

  describe('Job Data Validation', () => {
    it('should validate required job data fields', async () => {
      // This test will fail until we implement validation
      const { sessionRunnerHandler } = await import('../workers/handlers/session-runner.handler')
      
      const invalidJob = {
        id: 'job-123',
        type: 'session-runner',
        data: {
          // Missing sessionId and prompt
          userId: 'user-789'
        }
      }
      
      let callbackCalled = false
      let callbackError: Error | null = null
      
      const callback = (error: Error | null) => {
        callbackCalled = true
        callbackError = error
      }
      
      sessionRunnerHandler(invalidJob, callback)
      
      await waitForCondition(() => callbackCalled, { timeoutMs: 1000 })
      
      expect(callbackError).toBeInstanceOf(Error)
      expect(callbackError).toBeTruthy()
      expect((callbackError as unknown as Error).message).toContain('Missing required fields')
    })

    it('should validate session exists before processing', async () => {
      // This test will fail until we implement session validation
      const { sessionRunnerHandler } = await import('../workers/handlers/session-runner.handler')
      
      const mockJob = {
        id: 'job-123',
        type: 'session-runner',
        data: {
          sessionId: 'non-existent-session',
          prompt: 'Test prompt',
          userId: 'user-789'
        }
      }
      
      let callbackCalled = false
      let callbackError: Error | null = null
      
      const callback = (error: Error | null) => {
        callbackCalled = true
        callbackError = error
      }
      
      sessionRunnerHandler(mockJob, callback)
      
      await waitForCondition(() => callbackCalled, { timeoutMs: 1000 })
      
      expect(callbackError).toBeInstanceOf(Error)
      expect(callbackError).toBeTruthy()
      expect((callbackError as unknown as Error).message).toContain('Session not found')
    })
  })

  describe('Progress Tracking', () => {
    it('should track job progress during Claude Code interaction', async () => {
      // This test will fail until we implement progress tracking
      const { sessionRunnerHandler } = await import('../workers/handlers/session-runner.handler')
      
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      const mockJob = {
        id: 'job-123',
        type: 'session-runner',
        data: {
          sessionId: session.id,
          prompt: 'Complex task that takes time',
          userId: 'user-789'
        }
      }
      
      let callbackCalled = false
      
      const callback = () => {
        callbackCalled = true
      }
      
      sessionRunnerHandler(mockJob, callback)
      
      await waitForCondition(() => callbackCalled, { timeoutMs: 5000 })
      
      // Should have received progress updates (this will need implementation)
      // expect(progressUpdates.length).toBeGreaterThan(0)
    })
  })
})