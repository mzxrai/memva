import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import type { Route } from '../routes/+types/api.session.$sessionId.settings'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import { loader, action } from '../routes/api.session.$sessionId.settings'

describe('Session Settings API Route', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('GET /api/session/:sessionId/settings', () => {
    it('should return 404 if session not found', async () => {
      const request = new Request('http://localhost/api/session/invalid-session/settings')
      const params = { sessionId: 'invalid-session' }
      
      const response = await loader({ request, params } as Route.LoaderArgs)
      
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Session not found')
    })

    it('should return session settings when they exist', async () => {
      // Create a session with custom settings
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      // Update session with custom settings
      const { updateSessionSettings } = await import('../db/sessions.service')
      await updateSessionSettings(session.id, {
        maxTurns: 300,
        permissionMode: 'bypassPermissions'
      })
      
      const request = new Request(`http://localhost/api/session/${session.id}/settings`)
      const params = { sessionId: session.id }
      
      const response = await loader({ request, params } as Route.LoaderArgs)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.maxTurns).toBe(300)
      expect(data.permissionMode).toBe('bypassPermissions')
    })

    it('should return global defaults when session has no custom settings', async () => {
      // Create a session without custom settings
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      const request = new Request(`http://localhost/api/session/${session.id}/settings`)
      const params = { sessionId: session.id }
      
      const response = await loader({ request, params } as Route.LoaderArgs)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.maxTurns).toBe(200)
      expect(data.permissionMode).toBe('acceptEdits')
    })
  })

  describe('PUT /api/session/:sessionId/settings', () => {
    it('should return 404 if session not found', async () => {
      const request = new Request('http://localhost/api/session/invalid-session/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxTurns: 300 })
      })
      const params = { sessionId: 'invalid-session' }
      
      const response = await action({ request, params } as Route.ActionArgs)
      
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Session not found')
    })

    it('should update session settings', async () => {
      // Create a session
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      const newSettings = {
        maxTurns: 500,
        permissionMode: 'plan'
      }
      
      const request = new Request(`http://localhost/api/session/${session.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })
      const params = { sessionId: session.id }
      
      const response = await action({ request, params } as Route.ActionArgs)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.maxTurns).toBe(500)
      expect(data.permissionMode).toBe('plan')
      
      // Verify settings were actually updated
      const { getSessionSettings } = await import('../db/sessions.service')
      const updatedSettings = await getSessionSettings(session.id)
      expect(updatedSettings.maxTurns).toBe(500)
      expect(updatedSettings.permissionMode).toBe('plan')
    })

    it('should validate settings before updating', async () => {
      // Create a session
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      const invalidSettings = {
        maxTurns: 1500, // Too high
        permissionMode: 'invalid' // Invalid mode
      }
      
      const request = new Request(`http://localhost/api/session/${session.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidSettings)
      })
      const params = { sessionId: session.id }
      
      const response = await action({ request, params } as Route.ActionArgs)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid settings')
    })

    it('should handle partial updates', async () => {
      // Create a session with existing settings
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      // Set initial settings
      const { updateSessionSettings } = await import('../db/sessions.service')
      await updateSessionSettings(session.id, {
        maxTurns: 300,
        permissionMode: 'bypassPermissions'
      })
      
      // Update only maxTurns
      const request = new Request(`http://localhost/api/session/${session.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxTurns: 400 })
      })
      const params = { sessionId: session.id }
      
      const response = await action({ request, params } as Route.ActionArgs)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.maxTurns).toBe(400)
      expect(data.permissionMode).toBe('bypassPermissions') // Should remain unchanged
    })
  })
})