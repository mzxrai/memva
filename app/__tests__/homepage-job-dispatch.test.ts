import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { sessions, jobs } from '../db/schema'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Homepage Job Dispatch', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should create session and dispatch job from homepage form', async () => {
    // This test will fail because the home action doesn't support prompt yet
    const { action } = await import('../routes/home')
    
    // Mock form data with title and prompt
    const formData = new FormData()
    formData.append('title', 'New Session')
    formData.append('prompt', 'Help me build a React component')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    // Test the action behavior
    const result = await action({ request: mockRequest, params: {}, context: {} })

    // Verify redirect response
    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.headers.get('Location')).toMatch(/^\/sessions\/[a-f0-9-]+$/)
    expect(response.status).toBe(302)

    // Verify session was created with correct claude_status
    const sessionsInDb = testDb.db.select().from(sessions).all()
    expect(sessionsInDb).toHaveLength(1)
    expect(sessionsInDb[0]).toMatchObject({
      title: 'New Session',
      claude_status: 'not_started'
    })

    // Verify job was created
    const jobsInDb = testDb.db.select().from(jobs).all()
    expect(jobsInDb).toHaveLength(1)
    expect(jobsInDb[0]).toMatchObject({
      type: 'session-runner',
      status: 'pending'
    })
    
    // Verify job data (stored as JSON object)
    expect(jobsInDb[0].data).toMatchObject({
      sessionId: sessionsInDb[0].id,
      prompt: 'Help me build a React component'
    })
  })

  it('should set initial status to not_started', async () => {
    const { action } = await import('../routes/home')
    
    const formData = new FormData()
    formData.append('title', 'Status Test Session')
    formData.append('prompt', 'Test prompt')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    await action({ request: mockRequest, params: {}, context: {} })

    const sessionsInDb = testDb.db.select().from(sessions).all()
    expect(sessionsInDb).toHaveLength(1)
    expect(sessionsInDb[0].claude_status).toBe('not_started')
  })

  it('should redirect to session detail page immediately', async () => {
    const { action } = await import('../routes/home')
    
    const formData = new FormData()
    formData.append('title', 'Redirect Test Session')
    formData.append('prompt', 'Test prompt')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    const result = await action({ request: mockRequest, params: {}, context: {} })

    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toMatch(/^\/sessions\/[a-f0-9-]+$/)
  })

  it('should dispatch session-runner job with prompt', async () => {
    const { action } = await import('../routes/home')
    
    const formData = new FormData()
    formData.append('title', 'Job Dispatch Test')
    formData.append('prompt', 'Create a TypeScript interface')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    await action({ request: mockRequest, params: {}, context: {} })

    const jobsInDb = testDb.db.select().from(jobs).all()
    expect(jobsInDb).toHaveLength(1)
    expect(jobsInDb[0].type).toBe('session-runner')
    expect(jobsInDb[0].data).toMatchObject({
      prompt: 'Create a TypeScript interface'
    })
  })

  it('should handle job creation errors gracefully', async () => {
    const { action } = await import('../routes/home')
    
    const formData = new FormData()
    formData.append('title', 'Error Test Session')
    formData.append('prompt', 'Test prompt')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    // Mock createJob to throw an error
    vi.doMock('../db/jobs.service', () => ({
      createJob: vi.fn().mockRejectedValue(new Error('Database error'))
    }))

    try {
      await action({ request: mockRequest, params: {}, context: {} })
      expect.fail('Expected action to throw error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Database error')
    }

    // Restore original function
    vi.doUnmock('../db/jobs.service')
  })

  it('should return error when prompt is empty', async () => {
    const { action } = await import('../routes/home')
    
    const formData = new FormData()
    formData.append('title', 'Valid Title')
    formData.append('prompt', '')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    const result = await action({ request: mockRequest, params: {}, context: {} })

    expect(result).toEqual({ error: 'Prompt is required' })
    
    // Verify no session or job was created
    const sessionsInDb = testDb.db.select().from(sessions).all()
    const jobsInDb = testDb.db.select().from(jobs).all()
    expect(sessionsInDb).toHaveLength(0)
    expect(jobsInDb).toHaveLength(0)
  })

  it('should return error when prompt is only whitespace', async () => {
    const { action } = await import('../routes/home')
    
    const formData = new FormData()
    formData.append('title', 'Valid Title')
    formData.append('prompt', '   ')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as any

    const result = await action({ request: mockRequest, params: {}, context: {} })

    expect(result).toEqual({ error: 'Prompt is required' })
    
    // Verify no session or job was created
    const sessionsInDb = testDb.db.select().from(sessions).all()
    const jobsInDb = testDb.db.select().from(jobs).all()
    expect(sessionsInDb).toHaveLength(0)
    expect(jobsInDb).toHaveLength(0)
  })
})