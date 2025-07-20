import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { sessions, jobs } from '../db/schema'
import { eq } from 'drizzle-orm'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Session Detail Job Dispatch', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should dispatch job when user submits new prompt in session detail', async () => {
    // This test will fail because session detail doesn't have an action yet
    // First, create a session
    const session = testDb.createSession({ 
      title: 'Test Session', 
      project_path: '/test',
      claude_status: 'not_started'
    })

    // Import the action that we'll need to create
    const { action } = await import('../routes/sessions.$sessionId')
    
    // Mock form data with prompt
    const formData = new FormData()
    formData.append('prompt', 'Help me debug this code')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    // Test the action behavior
    const result = await action({ 
      request: mockRequest, 
      params: { sessionId: session.id }, 
      context: {} 
    })

    // Verify success response
    expect(result).toEqual({ success: true })

    // Verify session status was updated to processing
    const updatedSession = testDb.db.select().from(sessions).where(eq(sessions.id, session.id)).get()
    expect(updatedSession?.claude_status).toBe('processing')

    // Verify job was created
    const jobsInDb = testDb.db.select().from(jobs).all()
    expect(jobsInDb).toHaveLength(1)
    expect(jobsInDb[0]).toMatchObject({
      type: 'session-runner',
      status: 'pending'
    })
    
    // Verify job data
    expect(jobsInDb[0].data).toMatchObject({
      sessionId: session.id,
      prompt: 'Help me debug this code'
    })
  })

  it('should update session status to processing', async () => {
    const session = testDb.createSession({ 
      title: 'Test Session', 
      project_path: '/test',
      claude_status: 'not_started'
    })

    const { action } = await import('../routes/sessions.$sessionId')
    
    const formData = new FormData()
    formData.append('prompt', 'Test prompt')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    await action({ 
      request: mockRequest, 
      params: { sessionId: session.id }, 
      context: {} 
    })

    const updatedSession = testDb.db.select().from(sessions).where(eq(sessions.id, session.id)).get()
    expect(updatedSession?.claude_status).toBe('processing')
  })

  it('should handle job submission errors', async () => {
    const session = testDb.createSession({ 
      title: 'Test Session', 
      project_path: '/test',
      claude_status: 'not_started'
    })

    const { action } = await import('../routes/sessions.$sessionId')
    
    const formData = new FormData()
    formData.append('prompt', 'Test prompt')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    // Mock createJob to throw an error
    vi.doMock('../db/jobs.service', () => ({
      createJob: vi.fn().mockRejectedValue(new Error('Job creation failed'))
    }))

    try {
      await action({ 
        request: mockRequest, 
        params: { sessionId: session.id }, 
        context: {} 
      })
      expect.fail('Expected action to throw error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Job creation failed')
    }

    // Restore original function
    vi.doUnmock('../db/jobs.service')
  })

  it('should maintain existing form UX', async () => {
    const session = testDb.createSession({ 
      title: 'Test Session', 
      project_path: '/test',
      claude_status: 'not_started'
    })

    const { action } = await import('../routes/sessions.$sessionId')
    
    const formData = new FormData()
    formData.append('prompt', 'Test prompt for UX')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    const result = await action({ 
      request: mockRequest, 
      params: { sessionId: session.id }, 
      context: {} 
    })

    // Should return success response that can be used by the form
    expect(result).toEqual({ success: true })
    expect(result).not.toBeInstanceOf(Response) // Should not redirect
  })

  it('should return error when prompt is empty', async () => {
    const session = testDb.createSession({ 
      title: 'Test Session', 
      project_path: '/test',
      claude_status: 'not_started'
    })

    const { action } = await import('../routes/sessions.$sessionId')
    
    const formData = new FormData()
    formData.append('prompt', '')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    const result = await action({ 
      request: mockRequest, 
      params: { sessionId: session.id }, 
      context: {} 
    })

    expect(result).toEqual({ error: 'Please provide a prompt or upload images' })
    
    // Verify no job was created
    const jobsInDb = testDb.db.select().from(jobs).all()
    expect(jobsInDb).toHaveLength(0)
  })

  it('should return error when prompt is only whitespace', async () => {
    const session = testDb.createSession({ 
      title: 'Test Session', 
      project_path: '/test',
      claude_status: 'not_started'
    })

    const { action } = await import('../routes/sessions.$sessionId')
    
    const formData = new FormData()
    formData.append('prompt', '   ')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    const result = await action({ 
      request: mockRequest, 
      params: { sessionId: session.id }, 
      context: {} 
    })

    expect(result).toEqual({ error: 'Please provide a prompt or upload images' })
    
    // Verify no job was created
    const jobsInDb = testDb.db.select().from(jobs).all()
    expect(jobsInDb).toHaveLength(0)
  })
})