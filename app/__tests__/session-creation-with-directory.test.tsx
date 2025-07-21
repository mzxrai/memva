import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { server } from '../test-utils/msw-server'
import { sessions, jobs } from '../db/schema'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { action } from '../routes/home'

describe('Session Creation with Directory', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
    vi.clearAllMocks()
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
    server.resetHandlers()
  })

  it('should create session with specified project directory', async () => {
    const formData = new FormData()
    formData.append('title', 'Test Session')
    formData.append('prompt', 'Test Session')
    formData.append('project_path', '/Users/testuser/projects/myapp')

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData
    })

    const result = await action({ request, params: {}, context: {} })

    // Should redirect to the new session
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(302)
      expect(result.headers.get('Location')).toMatch(/^\/sessions\/[a-f0-9-]+$/)
    }

    // Check that session was created with correct project path
    const sessionRecords = testDb.db.select().from(sessions).all()
    expect(sessionRecords).toHaveLength(1)
    expect(sessionRecords[0].title).toBe('Test Session')
    expect(sessionRecords[0].project_path).toBe('/Users/testuser/projects/myapp')
  })

  it('should reject session creation without project path', async () => {
    const formData = new FormData()
    formData.append('title', 'Test Session')
    formData.append('prompt', 'Test Session')
    formData.append('project_path', '')

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData
    })

    const result = await action({ request, params: {}, context: {} })

    // Should return error
    expect(result).toEqual({ error: 'Project path is required' })

    // No session should be created
    const sessionRecords = testDb.db.select().from(sessions).all()
    expect(sessionRecords).toHaveLength(0)
  })

  it('should trim whitespace from project path', async () => {
    const formData = new FormData()
    formData.append('title', 'Test Session')
    formData.append('prompt', 'Test Session')
    formData.append('project_path', '  /Users/testuser/projects/myapp  ')

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData
    })

    const result = await action({ request, params: {}, context: {} })

    // Should redirect
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(302)
    }

    // Check that session was created with trimmed path
    const sessionRecords = testDb.db.select().from(sessions).all()
    expect(sessionRecords[0].project_path).toBe('/Users/testuser/projects/myapp')
  })

  it('should handle different directory paths correctly', async () => {
    const testCases = [
      { path: '/absolute/path', expected: '/absolute/path' },
      { path: '~/home/relative', expected: '~/home/relative' },
      { path: './relative/path', expected: './relative/path' },
      { path: '../parent/path', expected: '../parent/path' }
    ]

    for (const { path, expected } of testCases) {
      // Clear database between tests
      testDb.db.delete(sessions).run()

      const formData = new FormData()
      formData.append('title', `Test ${path}`)
      formData.append('prompt', `Test ${path}`)
      formData.append('project_path', path)

      const request = new Request('http://localhost/', {
        method: 'POST',
        body: formData
      })

      const result = await action({ request, params: {}, context: {} })

      // Should redirect
      expect(result).toBeInstanceOf(Response)
      if (result instanceof Response) {
        expect(result.status).toBe(302)
      }

      // Check that session was created with correct path
      const sessionRecords = testDb.db.select().from(sessions).all()
      expect(sessionRecords).toHaveLength(1)
      expect(sessionRecords[0].project_path).toBe(expected)
    }
  })

  it('should create job with session runner for new session', async () => {
    const formData = new FormData()
    formData.append('title', 'Test Session')
    formData.append('prompt', 'Build a feature')
    formData.append('project_path', '/Users/testuser/projects/myapp')

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData
    })

    await action({ request, params: {}, context: {} })

    // Check that job was created
    const jobRecords = testDb.db.select().from(jobs).all()
    expect(jobRecords).toHaveLength(1)
    expect(jobRecords[0].type).toBe('session-runner')
    
    const jobData = jobRecords[0].data as { prompt: string; sessionId: string }
    expect(jobData.prompt).toBe('Build a feature')
    expect(jobData.sessionId).toBeTruthy()
  })

  it('should update claude_status to processing after creation', async () => {
    const formData = new FormData()
    formData.append('title', 'Test Session')
    formData.append('prompt', 'Test Session')
    formData.append('project_path', '/Users/testuser/projects/myapp')

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData
    })

    await action({ request, params: {}, context: {} })

    // Check that claude_status was updated
    const sessionRecords = testDb.db.select().from(sessions).all()
    expect(sessionRecords[0].claude_status).toBe('processing')
  })
})