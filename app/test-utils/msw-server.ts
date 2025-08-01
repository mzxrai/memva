import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { beforeAll, afterEach, afterAll } from 'vitest'

// Mock the Claude Code SDK module
import { vi } from 'vitest'

vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn().mockImplementation(({ prompt }) => {
    // Return a mock async iterator
    return {
      async *[Symbol.asyncIterator]() {
        // Simulate Claude Code messages
        yield {
          type: 'system',
          subtype: 'init',
          apiKeySource: 'user',
          cwd: '/test/project',
          session_id: 'mock-session-id',
          tools: ['Read', 'Write'],
          mcp_servers: [],
          model: 'claude-3',
          permissionMode: 'default'
        }
        
        yield {
          type: 'user',
          message: { content: prompt, role: 'user' },
          parent_tool_use_id: null,
          session_id: 'mock-session-id'
        }
        
        yield {
          type: 'assistant',
          message: { content: 'I can help with that!', role: 'assistant' },
          parent_tool_use_id: null,
          session_id: 'mock-session-id'
        }
        
        yield {
          type: 'result',
          subtype: 'success',
          duration_ms: 1000,
          duration_api_ms: 800,
          is_error: false,
          num_turns: 1,
          result: 'Task completed successfully',
          session_id: 'mock-session-id',
          total_cost_usd: 0.001,
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        }
      }
    }
  })
}))

// Define handlers that will be shared across tests
export const handlers = [
  // Mock the session detail API endpoint
  http.get('/api/session/:sessionId', ({ params }) => {
    const { sessionId } = params
    return HttpResponse.json({
      session: {
        id: sessionId,
        title: 'Test Session',
        project_path: '/test/project',
        status: 'ready',
        claude_session_id: 'mock-session-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      events: []
    })
  }),
  
  // Mock the settings API endpoints
  http.get('/api/settings', () => {
    return HttpResponse.json({
      maxTurns: 200,
      permissionMode: 'acceptEdits'
    })
  }),
  
  http.post('/api/settings', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body)
  }),
  
  http.put('/api/settings', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body)
  }),
  
  // Mock session-specific settings endpoints
  http.get('/api/session/:sessionId/settings', () => {
    return HttpResponse.json({
      maxTurns: 200,
      permissionMode: 'acceptEdits'
    })
  }),
  
  http.put('/api/session/:sessionId/settings', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body)
  }),
  
  // Mock filesystem API endpoint
  http.get('/api/filesystem', ({ request }) => {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    
    if (action === 'current') {
      return HttpResponse.json({ currentDirectory: '/' })
    }
    
    return HttpResponse.json({ error: 'Unknown action' }, { status: 400 })
  }),
  
  // Mock permissions API endpoint
  http.get('/api/permissions', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    
    // Return empty array by default or filtered by status
    if (status === 'pending') {
      return HttpResponse.json({ permissions: [] })
    }
    
    return HttpResponse.json({ permissions: [] })
  }),
  
  http.put('/api/permissions/:id', async ({ params, request }) => {
    const body = await request.json() as { decision: string }
    return HttpResponse.json({
      id: params.id,
      status: body.decision === 'allow' ? 'approved' : 'denied',
      decision: body.decision,
      decided_at: new Date().toISOString()
    })
  }),
  
  // Also handle POST for permissions (same as PUT)
  http.post('/api/permissions/:id', async ({ params, request }) => {
    const body = await request.json() as { decision: string }
    return HttpResponse.json({
      id: params.id,
      status: body.decision === 'allow' ? 'approved' : 'denied',
      decision: body.decision,
      decided_at: new Date().toISOString()
    })
  })
]

// Setup the MSW server
export const server = setupServer(...handlers)

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers())

// Clean up after the tests are finished
afterAll(() => server.close())