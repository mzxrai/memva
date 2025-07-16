import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createJob } from '../db/jobs.service'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Route Configuration', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('Job API Routes Registration', () => {
    it('should register /api/jobs route pattern', async () => {
      // This test will fail until routes are properly registered
      // Import the route config to test route registration
      const routes = await import('../routes')
      
      const jobsRoute = routes.default.find(route => {
        // Check if this route matches the jobs API pattern
        return route.path === 'api/jobs' || 
               (route.id && route.id.includes('api/jobs'))
      })
      
      expect(jobsRoute).toBeDefined()
      expect(jobsRoute?.file || jobsRoute?.path).toBe('routes/api.jobs.tsx')
    })

    it('should register /api/jobs/:jobId route pattern', async () => {
      // This test will fail until routes are properly registered
      const routes = await import('../routes')
      
      const jobIdRoute = routes.default.find(route => {
        // Check if this route matches the individual job API pattern
        return route.path === 'api/jobs/:jobId' || 
               (route.id && route.id.includes('api/jobs/$jobId'))
      })
      
      expect(jobIdRoute).toBeDefined()
      expect(jobIdRoute?.file || jobIdRoute?.path).toBe('routes/api.jobs.$jobId.tsx')
    })

    it('should have correct route parameters for job ID extraction', async () => {
      // This test will fail until routes are properly configured
      const routes = await import('../routes')
      
      const jobIdRoute = routes.default.find(route => {
        return route.path === 'api/jobs/:jobId' || 
               (route.id && route.id.includes('api/jobs/$jobId'))
      })
      
      expect(jobIdRoute).toBeDefined()
      // In React Router v7, parameters are handled by file naming convention
      // The $jobId in the filename should create a :jobId parameter
      expect(jobIdRoute?.file || jobIdRoute?.path).toContain('$jobId')
    })
  })

  describe('Route Accessibility Integration', () => {
    it('should handle /api/jobs POST requests through route configuration', async () => {
      // This test validates that routes work end-to-end
      // Create a test session for job creation
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      // Test that the route can be accessed (this should work since routes are registered)
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'session-runner',
          data: {
            sessionId: session.id,
            prompt: 'Test route accessibility'
          }
        }),
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(201)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.jobId).toBeDefined()
    })

    it('should handle /api/jobs/:jobId GET requests through route configuration', async () => {
      // This test validates individual job routes work end-to-end
      // Create a test job
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'cleanup-old-jobs', olderThanDays: 30 }
      })
      
      // Test that the route can be accessed
      const { loader } = await import('../routes/api.jobs.$jobId')
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`)
      
      const response = await loader({ 
        request, 
        params: { jobId: job.id },
        context: {} 
      })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.job.id).toBe(job.id)
    })

    it('should handle /api/jobs/:jobId PUT requests through route configuration', async () => {
      // Test that update routes work end-to-end
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'vacuum-database' },
        priority: 3
      })
      
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priority: 7
        }),
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {} 
      })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.job.priority).toBe(7)
    })

    it('should handle /api/jobs/:jobId DELETE requests through route configuration', async () => {
      // Test that delete routes work end-to-end
      const job = await createJob({
        type: 'session-runner',
        data: { sessionId: 'test-session', prompt: 'Test delete' }
      })
      
      const { action } = await import('../routes/api.jobs.$jobId')
      
      const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'DELETE'
      })
      
      const response = await action({ 
        request, 
        params: { jobId: job.id },
        context: {} 
      })
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.job.status).toBe('cancelled')
    })
  })

  describe('Route Method Handling', () => {
    it('should support multiple HTTP methods on /api/jobs route', async () => {
      // Test that the route supports POST, GET, and DELETE
      const { action, loader } = await import('../routes/api.jobs')
      
      // Test POST (create job)
      const session = testDb.createSession({
        title: 'Test Session',
        project_path: '/test/project'
      })
      
      const postRequest = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'session-runner',
          data: { sessionId: session.id, prompt: 'Test' }
        })
      })
      
      const postResponse = await action({ request: postRequest, params: {} })
      expect(postResponse.status).toBe(201)
      
      // Test GET (list jobs)
      const getRequest = new Request('http://localhost:3000/api/jobs')
      const getResponse = await loader({ request: getRequest, params: {}, context: {} })
      expect(getResponse.status).toBe(200)
      
      // Test DELETE (cancel jobs)
      const deleteRequest = new Request('http://localhost:3000/api/jobs', {
        method: 'DELETE'
      })
      const deleteResponse = await action({ request: deleteRequest, params: {} })
      expect(deleteResponse.status).toBe(200)
    })

    it('should support multiple HTTP methods on /api/jobs/:jobId route', async () => {
      // Test that the individual job route supports GET, PUT, and DELETE
      const job = await createJob({
        type: 'maintenance',
        data: { operation: 'cleanup-old-jobs', olderThanDays: 30 }
      })
      
      const { action, loader } = await import('../routes/api.jobs.$jobId')
      
      // Test GET (retrieve job)
      const getRequest = new Request(`http://localhost:3000/api/jobs/${job.id}`)
      const getResponse = await loader({ request: getRequest, params: { jobId: job.id }, context: {} })
      expect(getResponse.status).toBe(200)
      
      // Test PUT (update job)
      const putRequest = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 9 })
      })
      const putResponse = await action({ request: putRequest, params: { jobId: job.id }, context: {} })
      expect(putResponse.status).toBe(200)
      
      // Test DELETE (cancel job)
      const deleteRequest = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
        method: 'DELETE'
      })
      const deleteResponse = await action({ request: deleteRequest, params: { jobId: job.id }, context: {} })
      expect(deleteResponse.status).toBe(200)
    })
  })

  describe('Route Error Handling', () => {
    it('should handle non-existent routes gracefully', async () => {
      // Test accessing job routes that don't exist
      const { loader } = await import('../routes/api.jobs.$jobId')
      
      const request = new Request('http://localhost:3000/api/jobs/non-existent-job')
      
      const response = await loader({ 
        request, 
        params: { jobId: 'non-existent-job' },
        context: {} 
      })
      
      expect(response.status).toBe(404)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('Job not found')
    })

    it('should handle invalid HTTP methods', async () => {
      // Test unsupported HTTP methods
      const { action } = await import('../routes/api.jobs')
      
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'PATCH'
      })
      
      const response = await action({ request, params: {}, context: {} })
      
      expect(response.status).toBe(405)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('Method PATCH not allowed')
    })
  })
})