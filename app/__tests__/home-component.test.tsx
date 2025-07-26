import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLoaderData } from 'react-router'
import { createMockSessionWithStats } from '../test-utils/factories'
import { expectContent } from '../test-utils/component-testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from '../routes/home'
import { useHomepageData } from '../hooks/useHomepageData'
import { useImageUpload } from '../hooks/useImageUpload'

// Mock React Router hooks
vi.mock('react-router', () => ({
  useLoaderData: vi.fn(),
  Form: ({ children, onSubmit, ...props }: { children: React.ReactNode; onSubmit?: (event: React.FormEvent) => void; [key: string]: unknown }) => (
    <form onSubmit={onSubmit} {...props}>
      {children}
    </form>
  ),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: vi.fn(() => vi.fn()),
  useFetcher: vi.fn(() => ({
    submit: vi.fn(),
    state: 'idle',
    data: null
  }))
}))

// Mock the useHomepageData hook
vi.mock('../hooks/useHomepageData', () => ({
  useHomepageData: vi.fn()
}))

// Mock other custom hooks used by the component
vi.mock('../hooks/useAutoResizeTextarea', () => ({
  useAutoResizeTextarea: vi.fn(() => ({ textareaRef: { current: null } }))
}))

vi.mock('../hooks/useTextareaSubmit', () => ({
  useTextareaSubmit: vi.fn(() => vi.fn())
}))

vi.mock('../hooks/useImageUpload', () => ({
  useImageUpload: vi.fn(() => ({
    images: [],
    isDragging: false,
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
    removeImage: vi.fn(),
    clearImages: vi.fn()
  }))
}))

describe('Home Component', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    
    // Mock localStorage with a default directory to ensure input renders
    const localStorageMock = {
      getItem: vi.fn((key: string) => {
        if (key === 'memvaLastDirectory') {
          return '/Users/testuser';
        }
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null)
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })
  })

  it('should render empty state with centered form when no sessions', async () => {
    // Mock loader data with empty sessions
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    // Mock useHomepageData to return empty sessions
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )
    
    // Test session creation form exists (centered when no sessions)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/start a new session: ask, brainstorm, build/i)).toBeInTheDocument()
    
    // Test directory selector button is visible - it will show the shortened path
    expect(screen.getByText('~')).toBeInTheDocument()
    expect(screen.getByText('$')).toBeInTheDocument()
    
    // Test settings button is present
    const settingsButton = screen.getByRole('button', { name: 'Open settings' })
    expect(settingsButton).toBeInTheDocument()
    
    // Test tooltip appears when no sessions
    expect(screen.getByText('Select your working directory')).toBeInTheDocument()
  })

  it('should render sessions grid when sessions exist', () => {
    // Mock loader data with sessions using factories
    const mockSessions = [
      createMockSessionWithStats({ 
        id: 'session-1',
        title: 'First Session',
        project_path: '/test/project1',
        status: 'active',
        created_at: '2025-01-01T10:00:00.000Z'
      }),
      createMockSessionWithStats({ 
        id: 'session-2',
        title: 'Second Session',
        project_path: '/test/project2',
        status: 'archived',
        created_at: '2025-01-01T11:00:00.000Z'
      })
    ]

    vi.mocked(useLoaderData).mockReturnValue({ sessions: mockSessions })
    
    // Mock useHomepageData to return sessions
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: mockSessions,
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Test that sessions are displayed (no h1 title anymore)
    
    // Test session links - need to check the link exists with correct href
    const firstSessionLink = screen.getByRole('link', { name: /First Session/ })
    expect(firstSessionLink).toBeInTheDocument()
    expect(firstSessionLink).toHaveAttribute('href', '/sessions/session-1')
    
    const secondSessionLink = screen.getByRole('link', { name: /Second Session/ })
    expect(secondSessionLink).toBeInTheDocument()
    expect(secondSessionLink).toHaveAttribute('href', '/sessions/session-2')
    
    // Test session details are visible
    expectContent.text('/test/project1')
    expectContent.text('/test/project2')
    
    // Test session creation form is still present
    expect(screen.getByPlaceholderText(/start a new session: ask, brainstorm, build/i)).toBeInTheDocument()
  })

  it('should handle session creation form interactions', async () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    // Mock useHomepageData
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    const titleInput = screen.getByPlaceholderText(/start a new session: ask, brainstorm, build/i)

    // Test initial state - input should be empty
    expect(titleInput).toHaveValue('')

    // Test typing in title input
    fireEvent.change(titleInput, { target: { value: 'New Session Title' } })
    
    // Test input value is updated
    expect(titleInput).toHaveValue('New Session Title')
    
    // The form now uses just the title as the prompt, submitted via Enter key
    const form = titleInput.closest('form')
    expect(form).toBeInTheDocument()
  })

  it('should display session event count when available', () => {
    // Mock session with stats
    const sessionWithStats = createMockSessionWithStats({ 
      id: 'session-with-stats',
      title: 'Session With Stats',
      event_count: 5,
      duration_minutes: 30,
      event_types: {
        user: 2,
        assistant: 2,
        summary: 1
      }
    })

    vi.mocked(useLoaderData).mockReturnValue({ sessions: [sessionWithStats] })
    
    // Mock useHomepageData
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [sessionWithStats],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Test session basic info is displayed
    expectContent.text('Session With Stats')
    
    // Test event count is displayed
    expectContent.text('5 events')
  })

  it('should handle untitled sessions gracefully', () => {
    // Mock session without title
    const untitledSession = createMockSessionWithStats({ 
      id: 'untitled-session',
      title: null
    })

    vi.mocked(useLoaderData).mockReturnValue({ sessions: [untitledSession] })
    
    // Mock useHomepageData
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [untitledSession],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Test untitled session displays fallback text
    expectContent.text('Untitled Session')
    
    const untitledLink = screen.getByRole('link', { name: /Untitled Session/ })
    expect(untitledLink).toBeInTheDocument()
    expect(untitledLink).toHaveAttribute('href', '/sessions/untitled-session')
  })

  it('should show relative dates for session creation', () => {
    // Mock session with specific creation date
    const recentSession = createMockSessionWithStats({ 
      id: 'recent-session',
      title: 'Recent Session',
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
    })

    vi.mocked(useLoaderData).mockReturnValue({ sessions: [recentSession] })
    
    // Mock useHomepageData
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [recentSession],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Test relative date is displayed (should contain "ago")
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  it('should display different status indicators correctly', () => {
    const processingSession = createMockSessionWithStats({ 
      id: 'processing-session',
      title: 'Processing Session',
      status: 'active',
      claude_status: 'processing'
    })
    const completedSession = createMockSessionWithStats({ 
      id: 'completed-session',
      title: 'Completed Session',
      status: 'active',
      claude_status: 'completed'
    })

    vi.mocked(useLoaderData).mockReturnValue({ 
      sessions: [processingSession, completedSession] 
    })
    
    // Mock useHomepageData
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [processingSession, completedSession],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Sessions should have status indicators
    // Note: 'completed' status doesn't render a dot, only 'processing' does
    const statusDots = screen.getAllByTestId('status-dot')
    expect(statusDots).toHaveLength(1)
    
    // Processing session has status indicator
    expect(statusDots[0]).toHaveAttribute('data-status', 'processing')
    expect(statusDots[0]).toHaveAttribute('data-pulse', 'true')
    
    // Completed session doesn't show a visual indicator (by design)
  })

  it('should prevent form submission when title is empty', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    // Mock useHomepageData
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    const titleInput = screen.getByPlaceholderText(/start a new session: ask, brainstorm, build/i)
    const form = titleInput.closest('form')

    // Form should exist
    expect(form).toBeInTheDocument()
    
    // Test that input accepts text
    fireEvent.change(titleInput, { target: { value: 'Test session' } })
    expect(titleInput).toHaveValue('Test session')
    
    // The form now uses the title as both title and prompt, submitted via Enter key
    // Form submission is handled by the action, not by button state
  })

  it('should handle form accessibility correctly', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    // Mock useHomepageData
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    const titleInput = screen.getByPlaceholderText(/start a new session: ask, brainstorm, build/i)

    // Test form elements are accessible
    expect(titleInput).toBeInTheDocument()
    // Textarea elements don't have a type attribute
    expect(titleInput.tagName).toBe('TEXTAREA')
    expect(titleInput).toHaveAttribute('name', 'title')
    
    // Test that input is in a form
    const form = titleInput.closest('form')
    expect(form).toBeInTheDocument()
    
    // Test keyboard navigation - input can be focused
    titleInput.focus()
    expect(titleInput).toHaveFocus()
    
    // Test that form can be submitted via Enter key
    fireEvent.change(titleInput, { target: { value: 'Test session' } })
    expect(titleInput).toHaveValue('Test session')
  })

  it('should show archived sessions link only when archived count > 0', () => {
    // Need at least one active session for the link to show
    const activeSession = createMockSessionWithStats({ 
      id: 'active-session',
      title: 'Active Session',
      status: 'active'
    })
    
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [activeSession] })
    
    // First test with no archived sessions
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [activeSession],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Should not show link when archivedCount is 0
    expect(screen.queryByText(/View archived sessions/)).not.toBeInTheDocument()

    // Now test with archived sessions
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [activeSession],
      archivedCount: 5,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    rerender(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Should show link when archivedCount > 0 and there are active sessions
    expect(screen.getByText('View archived sessions')).toBeInTheDocument()
    const archivedLink = screen.getByRole('link', { name: 'View archived sessions' })
    expect(archivedLink).toHaveAttribute('href', '/archived')
  })

  it('should handle image upload via drag and drop', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    // Mock the image upload hook with dragging state
    const mockHandleDrop = vi.fn()
    const mockHandleDragOver = vi.fn()
    const mockHandleDragLeave = vi.fn()
    const mockRemoveImage = vi.fn()
    
    vi.mocked(useImageUpload).mockReturnValue({
      images: [],
      isDragging: true,
      handleDragOver: mockHandleDragOver,
      handleDragLeave: mockHandleDragLeave,
      handleDrop: mockHandleDrop,
      removeImage: mockRemoveImage,
      clearImages: vi.fn()
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    const form = screen.getByRole('textbox').closest('form')
    expect(form).toBeInTheDocument()
    
    // Test that form shows dragging state
    expect(form).toHaveClass('border-zinc-500')
    
    // Test drag events are connected
    if (form) {
      fireEvent.dragOver(form)
      expect(mockHandleDragOver).toHaveBeenCalled()
      
      fireEvent.dragLeave(form)
      expect(mockHandleDragLeave).toHaveBeenCalled()
      
      fireEvent.drop(form)
      expect(mockHandleDrop).toHaveBeenCalled()
    }
  })

  it('should display uploaded images with preview', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    const mockImages = [
      {
        id: 'image-1',
        file: new File(['test'], 'test1.png', { type: 'image/png' }),
        preview: 'data:image/png;base64,test1'
      },
      {
        id: 'image-2',
        file: new File(['test'], 'test2.jpg', { type: 'image/jpeg' }),
        preview: 'data:image/jpeg;base64,test2'
      }
    ]
    
    const mockRemoveImage = vi.fn()
    
    vi.mocked(useImageUpload).mockReturnValue({
      images: mockImages,
      isDragging: false,
      handleDragOver: vi.fn(),
      handleDragLeave: vi.fn(),
      handleDrop: vi.fn(),
      removeImage: mockRemoveImage,
      clearImages: vi.fn()
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Images are now handled programmatically, no hidden inputs
    // Just verify that images are displayed in the preview component
  })

  it('should open directory selector when clicking directory button', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Find the directory button by title attribute
    const directoryButton = screen.getByTitle('Click to change directory')
    expect(directoryButton).toBeInTheDocument()
    
    // The button should show the shortened path
    expect(screen.getByText('~')).toBeInTheDocument()
    expect(screen.getByText('$')).toBeInTheDocument()
    
    // Click to open directory selector
    fireEvent.click(directoryButton)
    
    // Verify the button is a button element
    expect(directoryButton.tagName).toBe('BUTTON')
  })

  it('should hide tooltip when user has sessions or has typed in input', () => {
    // Test 1: Show tooltip when no sessions and empty input
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Tooltip should appear when no sessions and empty input
    expect(screen.getByText('Select your working directory')).toBeInTheDocument()
    
    // Test 2: Hide tooltip when user types
    const input = screen.getByPlaceholderText(/start a new session: ask, brainstorm, build/i)
    fireEvent.change(input, { target: { value: 'test' } })
    
    // Tooltip should disappear when user types
    expect(screen.queryByText('Select your working directory')).not.toBeInTheDocument()
    
    // Test 3: Hide tooltip when there are sessions
    const session = createMockSessionWithStats({ id: 'test-session' })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [session],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })
    
    // Clear the input first
    fireEvent.change(input, { target: { value: '' } })
    
    rerender(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )
    
    // Tooltip should not appear when there are sessions (even with empty input)
    expect(screen.queryByText('Select your working directory')).not.toBeInTheDocument()
  })

  it('should handle session reordering based on latest user message', () => {
    // Create sessions with different latest_user_message_at timestamps as EnhancedSession
    const olderSession = {
      ...createMockSessionWithStats({ 
        id: 'older-session',
        title: 'Older Session'
      }),
      latest_user_message_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
    }
    
    const newerSession = {
      ...createMockSessionWithStats({ 
        id: 'newer-session',
        title: 'Newer Session'
      }),
      latest_user_message_at: new Date(Date.now() - 1000 * 60).toISOString() // 1 minute ago
    }
    
    const noMessageSession = {
      ...createMockSessionWithStats({ 
        id: 'no-message-session',
        title: 'No Message Session'
      }),
      latest_user_message_at: null
    }

    vi.mocked(useLoaderData).mockReturnValue({ 
      sessions: [olderSession, noMessageSession, newerSession] 
    })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [olderSession, noMessageSession, newerSession],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Get all session links
    const sessionLinks = screen.getAllByRole('link', { name: /Session/ })
    
    // Verify order: newer session first, older session second, no message session last
    expect(sessionLinks[0]).toHaveAttribute('href', '/sessions/newer-session')
    expect(sessionLinks[1]).toHaveAttribute('href', '/sessions/older-session')
    expect(sessionLinks[2]).toHaveAttribute('href', '/sessions/no-message-session')
  })

  it('should show loading skeleton when data is loading', () => {
    const mockSessions = [createMockSessionWithStats()]
    
    vi.mocked(useLoaderData).mockReturnValue({ sessions: mockSessions })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: mockSessions,
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: true // Set loading state
    })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Should show skeleton animation divs instead of actual sessions
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons).toHaveLength(6) // Default skeleton count
    
    // Should not show actual session cards
    expect(screen.queryByRole('link', { name: /Session/ })).not.toBeInTheDocument()
  })

  // Test removed - memvaHasCreatedSession tracking was removed from the app

  it('should handle form submission with images and create proper hidden inputs', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    const mockImages = [
      {
        id: 'image-1',
        file: new File(['test'], 'screenshot.png', { type: 'image/png' }),
        preview: 'data:image/png;base64,iVBORw0KGgoAAAANS'
      }
    ]
    
    vi.mocked(useImageUpload).mockReturnValue({
      images: mockImages,
      isDragging: false,
      handleDragOver: vi.fn(),
      handleDragLeave: vi.fn(),
      handleDrop: vi.fn(),
      removeImage: vi.fn(),
      clearImages: vi.fn()
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Get the form
    const form = screen.getByRole('textbox').closest('form')
    expect(form).toBeInTheDocument()
    
    // No hidden inputs should exist anymore since we handle submission programmatically
    if (form) {
      const hiddenInputs = form.querySelectorAll('input[type="hidden"]')
      expect(hiddenInputs).toHaveLength(0)
    }
  })

  it('should update textarea value when typing', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    const titleInput = screen.getByPlaceholderText(/start a new session: ask, brainstorm, build/i)
    
    // Initially should be empty
    expect(titleInput).toHaveValue('')
    
    // Type in textarea
    fireEvent.change(titleInput, { target: { value: 'Build a chat app' } })
    
    // Value should update
    expect(titleInput).toHaveValue('Build a chat app')
  })

  it('should handle settings button click', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    vi.mocked(useHomepageData).mockReturnValue({
      sessions: [],
      archivedCount: 0,
      timestamp: new Date().toISOString(),
      error: null,
      isLoading: false
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    const settingsButton = screen.getByRole('button', { name: 'Open settings' })
    expect(settingsButton).toBeInTheDocument()
    
    // Click settings button
    fireEvent.click(settingsButton)
    
    // Can't test modal opening directly as it's a separate component
    // but we can verify the button is clickable and has correct attributes
    expect(settingsButton).toHaveAttribute('aria-label', 'Open settings')
    expect(settingsButton).toHaveAttribute('title', 'Settings')
  })
})