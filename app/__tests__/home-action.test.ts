import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { sessions } from '../db/schema'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock the job service before importing action
vi.mock('../db/jobs.service', () => ({
  createJob: vi.fn().mockResolvedValue({ id: 'test-job-id' })
}))

// Mock the job types module
vi.mock('../workers/job-types', () => ({
  createSessionRunnerJob: vi.fn().mockReturnValue({
    type: 'session-runner',
    payload: { sessionId: 'test', prompt: 'test' }
  })
}))

// Mock the image storage module
vi.mock('../services/image-storage.server', () => ({
  saveImageToDisk: vi.fn().mockResolvedValue('/path/to/image.png')
}))

// Mock the image formatting module
vi.mock('../utils/image-prompt-formatting', () => ({
  formatPromptWithImages: vi.fn((prompt) => prompt)
}))

import { action } from '../routes/home'

describe('Home Action', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should create session and redirect on valid input', async () => {
    // Mock form data
    const formData = new FormData()
    formData.append('title', 'New Session Title')
    formData.append('prompt', 'Test prompt')
    formData.append('project_path', '/Users/mbm-premva/dev/memva')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as Request

    // Test the action behavior
    const result = await action({ request: mockRequest, params: {}, context: {} })

    // Verify redirect response
    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.headers.get('Location')).toMatch(/^\/sessions\/[a-f0-9-]+$/)
    expect(response.status).toBe(302)

    // Verify session was created in database
    const sessionsInDb = testDb.db.select().from(sessions).all()
    expect(sessionsInDb).toHaveLength(1)
    expect(sessionsInDb[0]).toMatchObject({
      title: 'New Session Title',
      project_path: '/Users/mbm-premva/dev/memva',
      status: 'active'
    })
    expect(sessionsInDb[0].metadata).toEqual({
      should_auto_start: true
    })
  })

  it('should trim whitespace from title', async () => {
    // Mock form data with whitespace
    const formData = new FormData()
    formData.append('title', '  Session With Spaces  ')
    formData.append('prompt', 'Test prompt')
    formData.append('project_path', '/Users/mbm-premva/dev/memva')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as Request

    // Test the action behavior
    const result = await action({ request: mockRequest, params: {}, context: {} })

    // Verify redirect response
    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.headers.get('Location')).toMatch(/^\/sessions\/[a-f0-9-]+$/)

    // Verify session was created with trimmed title
    const sessionsInDb = testDb.db.select().from(sessions).all()
    expect(sessionsInDb).toHaveLength(1)
    expect(sessionsInDb[0].title).toBe('Session With Spaces')
  })

  it('should return error when title is empty', async () => {
    // Mock form data with empty title
    const formData = new FormData()
    formData.append('title', '')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as Request

    // Test the action behavior
    const result = await action({ request: mockRequest, params: {}, context: {} })

    // Verify error response
    expect(result).toEqual({ error: 'Title is required' })

    // Verify no session was created
    const sessionsInDb = testDb.db.select().from(sessions).all()
    expect(sessionsInDb).toHaveLength(0)
  })

  it('should return error when title is only whitespace', async () => {
    // Mock form data with whitespace-only title
    const formData = new FormData()
    formData.append('title', '   ')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as Request

    // Test the action behavior
    const result = await action({ request: mockRequest, params: {}, context: {} })

    // Verify error response
    expect(result).toEqual({ error: 'Title is required' })

    // Verify no session was created
    const sessionsInDb = testDb.db.select().from(sessions).all()
    expect(sessionsInDb).toHaveLength(0)
  })

  it('should return error when title is missing', async () => {
    // Mock form data without title field
    const formData = new FormData()
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as Request

    // Test the action behavior
    const result = await action({ request: mockRequest, params: {}, context: {} })

    // Verify error response
    expect(result).toEqual({ error: 'Title is required' })

    // Verify no session was created
    const sessionsInDb = testDb.db.select().from(sessions).all()
    expect(sessionsInDb).toHaveLength(0)
  })

  it('should create session with correct default values', async () => {
    // Mock form data
    const formData = new FormData()
    formData.append('title', 'Test Session')
    formData.append('prompt', 'Test prompt')
    formData.append('project_path', '/Users/mbm-premva/dev/memva')
    
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as Request

    // Test the action behavior
    await action({ request: mockRequest, params: {}, context: {} })

    // Verify session was created with correct defaults
    const sessionsInDb = testDb.db.select().from(sessions).all()
    expect(sessionsInDb).toHaveLength(1)
    
    const session = sessionsInDb[0]
    expect(session.title).toBe('Test Session')
    expect(session.project_path).toBe('/Users/mbm-premva/dev/memva')
    expect(session.status).toBe('active')
    expect(session.metadata).toEqual({
      should_auto_start: true
    })
    expect(session.created_at).toBeDefined()
    expect(session.updated_at).toBeDefined()
    expect(session.id).toMatch(/^[a-f0-9-]+$/)
  })

  it('should handle multiple session creation correctly', async () => {
    // Create first session
    const formData1 = new FormData()
    formData1.append('title', 'First Session')
    formData1.append('prompt', 'First prompt')
    formData1.append('project_path', '/Users/mbm-premva/dev/memva')
    
    const mockRequest1 = {
      formData: vi.fn().mockResolvedValue(formData1)
    } as any

    await action({ request: mockRequest1, params: {}, context: {} })

    // Create second session
    const formData2 = new FormData()
    formData2.append('title', 'Second Session')
    formData2.append('prompt', 'Second prompt')
    formData2.append('project_path', '/Users/mbm-premva/dev/memva')
    
    const mockRequest2 = {
      formData: vi.fn().mockResolvedValue(formData2)
    } as any

    await action({ request: mockRequest2, params: {}, context: {} })

    // Verify both sessions were created
    const sessionsInDb = testDb.db.select().from(sessions).all()
    expect(sessionsInDb).toHaveLength(2)
    
    const titles = sessionsInDb.map(s => s.title)
    expect(titles).toContain('First Session')
    expect(titles).toContain('Second Session')
  })
})