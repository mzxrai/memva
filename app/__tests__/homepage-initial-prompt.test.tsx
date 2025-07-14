import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, sessions, events } from '../db'
import { eq } from 'drizzle-orm'
import { action as homeAction } from '../routes/home'
import { loader as sessionLoader } from '../routes/sessions.$sessionId'
import type { Route as HomeRoute } from '../routes/+types/home'
import type { Route as SessionRoute } from '../routes/+types/sessions.$sessionId'

describe('Homepage Initial Prompt Behavior', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await db.delete(events).execute()
    await db.delete(sessions).execute()
    vi.clearAllMocks()
  })

  it('should create session when user submits homepage form', async () => {
    // Test session creation from homepage form submission
    const userInput = "Help me implement a new feature"
    
    // Step 1: Submit form on homepage
    const homeFormData = new FormData()
    homeFormData.append('title', userInput)
    
    const homeRequest = new Request('http://localhost/', {
      method: 'POST',
      body: homeFormData
    })
    
    const homeResponse = await homeAction({ 
      request: homeRequest 
    } as HomeRoute.ActionArgs)
    
    // Should redirect to new session
    expect(homeResponse).toBeInstanceOf(Response)
    if (homeResponse instanceof Response) {
      expect(homeResponse.status).toBe(302)
      const location = homeResponse.headers.get('Location')
      expect(location).toMatch(/\/sessions\/[a-zA-Z0-9-]+/)
      
      // Extract session ID from redirect location
      const sessionId = location?.split('/sessions/')[1]
      expect(sessionId).toBeTruthy()
      
      // Verify session was created in database with correct title
      if (sessionId) {
        const sessionData = await db.select().from(sessions)
          .where(eq(sessions.id, sessionId))
          .execute()
        
        expect(sessionData).toHaveLength(1)
        expect(sessionData[0]?.title).toBe(userInput)
      }
    }
  })

  it('should load session data when navigating to session detail page', async () => {
    // First create a session with initial prompt
    const userInput = "Create a React component"
    
    const homeFormData = new FormData()
    homeFormData.append('title', userInput)
    
    const homeRequest = new Request('http://localhost/', {
      method: 'POST', 
      body: homeFormData
    })
    
    const homeResponse = await homeAction({ 
      request: homeRequest 
    } as HomeRoute.ActionArgs)
    
    expect(homeResponse).toBeInstanceOf(Response)
    const sessionId = homeResponse instanceof Response 
      ? homeResponse.headers.get('Location')?.split('/sessions/')[1]
      : undefined
    expect(sessionId).toBeTruthy()
    
    // Load the session detail page data
    if (sessionId) {
      const sessionLoaderData = await sessionLoader({
        params: { sessionId }
      } as SessionRoute.LoaderArgs)
      
      // Should load session with correct title and empty events (new session)
      expect(sessionLoaderData.session).toBeTruthy()
      expect(sessionLoaderData.session?.title).toBe(userInput)
      expect(sessionLoaderData.events).toHaveLength(0) // New session, no events yet
    }
  })
})