import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent, createMockAssistantEvent } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock react-router
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useLoaderData: vi.fn(),
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    Form: ({ children, ...props }: any) => <form {...props}>{children}</form>
  }
})

import Home from '../routes/home'
import { useLoaderData } from 'react-router'

describe('Home Message Carousel Integration', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should update carousel when new messages arrive', async () => {
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })

    // Create initial assistant message
    const initialMessage = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'assistant',
      data: createMockAssistantEvent('Initial response')
    })
    testDb.insertEvent(initialMessage)

    // Mock loader data
    vi.mocked(useLoaderData).mockReturnValue({
      sessions: [{
        ...session,
        event_count: 1,
        duration_minutes: 5,
        event_types: { assistant: 1 }
      }]
    })

    render(<Home />)

    // Wait for initial message to appear
    await waitFor(() => {
      expect(screen.getByText(/Initial response/)).toBeInTheDocument()
    })

    // Add new assistant message
    const newMessage = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'assistant',
      data: createMockAssistantEvent('New response')
    })
    testDb.insertEvent(newMessage)

    // Update loader data to reflect new message
    vi.mocked(useLoaderData).mockReturnValue({
      sessions: [{
        ...session,
        event_count: 2,
        duration_minutes: 5,
        event_types: { assistant: 2 }
      }]
    })

    // Re-render to simulate real-time update
    render(<Home />)

    // Should show the new message
    await waitFor(() => {
      expect(screen.getByText(/New response/)).toBeInTheDocument()
    })
  })

  it('should display MessageCarousel in session cards', async () => {
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })

    // Create assistant messages
    const assistantMessage1 = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'assistant',
      data: createMockAssistantEvent('First assistant response')
    })
    const assistantMessage2 = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'assistant',
      data: createMockAssistantEvent('Second assistant response')
    })
    testDb.insertEvent(assistantMessage1)
    testDb.insertEvent(assistantMessage2)

    // Mock loader data
    vi.mocked(useLoaderData).mockReturnValue({
      sessions: [{
        ...session,
        event_count: 2,
        duration_minutes: 5,
        event_types: { assistant: 2 }
      }]
    })

    render(<Home />)

    // Should have MessageCarousel in session card
    await waitFor(() => {
      expect(screen.getByTestId('message-carousel')).toBeInTheDocument()
    })

    // Should show assistant messages in carousel
    expect(screen.getByText(/First assistant response/)).toBeInTheDocument()
    expect(screen.getByText(/Second assistant response/)).toBeInTheDocument()
  })

  it('should show placeholder when session has no assistant messages', async () => {
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })

    // Create only user message (no assistant messages)
    const userMessage = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'user',
      data: { type: 'user', message: { content: [{ type: 'text', text: 'Hello' }] } }
    })
    testDb.insertEvent(userMessage)

    // Mock loader data
    vi.mocked(useLoaderData).mockReturnValue({
      sessions: [{
        ...session,
        event_count: 1,
        duration_minutes: 5,
        event_types: { user: 1 }
      }]
    })

    render(<Home />)

    // Should show placeholder message
    await waitFor(() => {
      expect(screen.getByText(/No assistant messages yet/)).toBeInTheDocument()
    })
  })

  it('should display carousel with proper styling in session cards', async () => {
    const session = testDb.createSession({
      title: 'Test Session',
      project_path: '/test/project'
    })

    // Create assistant message
    const assistantMessage = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'assistant',
      data: createMockAssistantEvent('Test message')
    })
    testDb.insertEvent(assistantMessage)

    // Mock loader data
    vi.mocked(useLoaderData).mockReturnValue({
      sessions: [{
        ...session,
        event_count: 1,
        duration_minutes: 5,
        event_types: { assistant: 1 }
      }]
    })

    render(<Home />)

    // Should have proper styling for integration
    await waitFor(() => {
      const carousel = screen.getByTestId('message-carousel')
      expect(carousel).toHaveClass('overflow-hidden')
      expect(carousel).toHaveClass('flex-col')
    })
  })
})