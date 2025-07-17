import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { waitForEvents } from '../test-utils/async-testing'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { action } from '../routes/sessions.$sessionId'

describe('Session Detail User Message Storage', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should store user message as event when form is submitted', async () => {
    const session = testDb.createSession({ 
      title: 'Test Session', 
      project_path: '/test'
    })

    const formData = new FormData()
    formData.append('prompt', 'Hello Claude, can you help me?')

    const request = new Request('http://localhost', {
      method: 'POST',
      body: formData
    })

    const params = { sessionId: session.id }

    // Execute the action
    await action({ request, params })

    // Wait for events to be stored
    await waitForEvents(() => testDb.getEventsForSession(session.id), ['user'])

    const events = testDb.getEventsForSession(session.id)
    const userEvents = events.filter(e => e.event_type === 'user')
    
    expect(userEvents).toHaveLength(1)
    expect(userEvents[0].data).toMatchObject({
      type: 'user',
      content: 'Hello Claude, can you help me?',
      session_id: ''
    })
  })

  it('should store user message before creating job', async () => {
    const session = testDb.createSession({ 
      title: 'Test Session', 
      project_path: '/test'
    })

    // Mock createJob to verify it's called after event storage
    let jobCreated = false
    let eventsAtJobCreation = 0
    
    vi.doMock('../db/jobs.service', async () => {
      const actual = await vi.importActual('../db/jobs.service')
      return {
        ...actual,
        createJob: vi.fn(async (job) => {
          jobCreated = true
          // Check that user event exists when job is created
          const events = testDb.getEventsForSession(session.id)
          eventsAtJobCreation = events.filter(e => e.event_type === 'user').length
          return (actual as any).createJob(job)
        })
      }
    })

    const formData = new FormData()
    formData.append('prompt', 'Test prompt')

    const request = new Request('http://localhost', {
      method: 'POST',
      body: formData
    })

    const params = { sessionId: session.id }

    // Re-import action to get mocked version
    const { action: mockedAction } = await import('../routes/sessions.$sessionId')
    await mockedAction({ request, params })

    expect(jobCreated).toBe(true)
    expect(eventsAtJobCreation).toBe(1) // User event should exist before job creation
  })
})