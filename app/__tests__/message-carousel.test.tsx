import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockEvent, createMockAssistantEvent } from '../test-utils/factories'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

import MessageCarousel from '../components/MessageCarousel'

describe('MessageCarousel Component', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should display 2-3 lines of assistant message', async () => {
    const session = testDb.createSession({
      project_path: '/test/project'
    })

    // Create assistant event with longer content
    const longMessage = 'This is a very long assistant message that should be truncated to 2-3 lines when displayed in the carousel. It contains multiple sentences and should demonstrate the preview functionality working correctly.'
    const assistantEvent = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'assistant',
      data: createMockAssistantEvent(longMessage)
    })
    testDb.insertEvent(assistantEvent)

    render(<MessageCarousel sessionId={session.id} />)

    // Wait for async data loading to complete
    await waitFor(() => {
      expect(screen.getByText(/This is a very long assistant message/)).toBeInTheDocument()
    })
    
    // Should be contained in a vertical feed container
    const container = screen.getByTestId('message-carousel')
    expect(container).toHaveClass('overflow-hidden')
    expect(container).toHaveClass('h-16') // Fixed height for 2-3 lines
  })

  it('should handle sessions with no assistant messages gracefully', async () => {
    const session = testDb.createSession({
      project_path: '/test/project'
    })

    // Create only user events (no assistant messages)
    const userEvent = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'user',
      data: { type: 'user', message: { content: [{ type: 'text', text: 'Hello' }] } }
    })
    testDb.insertEvent(userEvent)

    render(<MessageCarousel sessionId={session.id} />)

    // Wait for async data loading to complete
    await waitFor(() => {
      expect(screen.getByText(/No assistant messages yet/)).toBeInTheDocument()
    })
  })

  it('should display multiple assistant messages in vertical feed', async () => {
    const session = testDb.createSession({
      project_path: '/test/project'
    })

    // Create multiple assistant events
    for (let i = 0; i < 3; i++) {
      const assistantEvent = createMockEvent({
        session_id: 'test-session-id',
        memva_session_id: session.id,
        event_type: 'assistant',
        data: createMockAssistantEvent(`Assistant response ${i + 1}`)
      })
      testDb.insertEvent(assistantEvent)
    }

    render(<MessageCarousel sessionId={session.id} />)

    // Wait for async data loading to complete
    await waitFor(() => {
      expect(screen.getByText(/Assistant response 1/)).toBeInTheDocument()
    })

    // Should show all messages
    expect(screen.getByText(/Assistant response 2/)).toBeInTheDocument()
    expect(screen.getByText(/Assistant response 3/)).toBeInTheDocument()

    // Should have vertical scrolling container with fixed height
    const container = screen.getByTestId('message-carousel')
    expect(container).toHaveClass('overflow-hidden')
    expect(container).toHaveClass('flex-col')
  })

  it('should show most recent messages first', async () => {
    const session = testDb.createSession({
      project_path: '/test/project'
    })

    // Create assistant events at different times
    const firstEvent = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'assistant',
      data: createMockAssistantEvent('First message'),
      timestamp: '2023-01-01T00:00:00Z'
    })
    testDb.insertEvent(firstEvent)

    const secondEvent = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'assistant',
      data: createMockAssistantEvent('Second message'),
      timestamp: '2023-01-02T00:00:00Z'
    })
    testDb.insertEvent(secondEvent)

    render(<MessageCarousel sessionId={session.id} />)

    // Wait for async data loading to complete
    await waitFor(() => {
      const messages = screen.getAllByTestId('message-item')
      expect(messages).toHaveLength(2)
    })

    // Should show messages in order (newest first)
    const messages = screen.getAllByTestId('message-item')
    expect(messages[0]).toHaveTextContent('Second message')
    expect(messages[1]).toHaveTextContent('First message')
  })

  it('should apply consistent styling with design system', async () => {
    const session = testDb.createSession({
      project_path: '/test/project'
    })

    const assistantEvent = createMockEvent({
      session_id: 'test-session-id',
      memva_session_id: session.id,
      event_type: 'assistant',
      data: createMockAssistantEvent('Test message')
    })
    testDb.insertEvent(assistantEvent)

    render(<MessageCarousel sessionId={session.id} />)

    // Wait for async data loading to complete
    await waitFor(() => {
      const messageItem = screen.getByTestId('message-item')
      expect(messageItem).toBeInTheDocument()
    })

    // Should follow design system patterns for vertical feed
    const container = screen.getByTestId('message-carousel')
    expect(container).toHaveClass('overflow-hidden')
    
    const messageItem = screen.getByTestId('message-item')
    expect(messageItem).toHaveClass('text-zinc-300')
    expect(messageItem).toHaveClass('text-sm')
    expect(messageItem).toHaveClass('leading-relaxed')
  })
})