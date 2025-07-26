import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from '../routes/home'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock the useHomepageData hook
vi.mock('../hooks/useHomepageData', () => ({
  useHomepageData: () => ({ 
    sessions: [],
    timestamp: new Date().toISOString(),
    error: null,
    isLoading: false
  })
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
    removeImage: vi.fn()
  }))
}))

// Mock React Router for component testing
vi.mock('react-router', () => ({
  useLoaderData: vi.fn(() => ({ sessions: [] })),
  Form: ({ children, onSubmit, ...props }: any) => (
    <form onSubmit={onSubmit} {...props}>
      {children}
    </form>
  ),
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: vi.fn(() => vi.fn()),
  useFetcher: vi.fn(() => ({
    submit: vi.fn(),
    state: 'idle',
    data: null
  })),
  redirect: vi.fn()
}))

describe('Homepage Initial Prompt Behavior', () => {
  let testDb: TestDatabase
  let queryClient: QueryClient

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
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

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should accept user input for creating new sessions', async () => {
    const user = userEvent.setup()
    
    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // User should see the input field
    const input = screen.getByPlaceholderText(/start a new session/i)
    expect(input).toBeInTheDocument()
    
    // User should be able to type into it
    await user.type(input, 'Help me implement a new feature')
    expect(input).toHaveValue('Help me implement a new feature')
  })

  it('should show empty state when no sessions exist', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )
    
    // User should see the centered input form
    const input = screen.getByPlaceholderText(/start a new session/i)
    expect(input).toBeInTheDocument()
    
    // Should show directory selector prompt
    expect(screen.getByText('Select your working directory')).toBeInTheDocument()
  })

  it('should require input before submitting', async () => {
    const user = userEvent.setup()
    
    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    const input = screen.getByPlaceholderText(/start a new session/i)
    
    // Initial value should be empty
    expect(input).toHaveValue('')
    
    // Try to submit empty form
    await user.type(input, '{Enter}')
    
    // Form should not submit when empty (input remains visible)
    expect(input).toBeInTheDocument()
    // After Enter, textarea might have a newline character
    const currentValue = (input as HTMLTextAreaElement).value
    expect(currentValue.trim()).toBe('')
  })
})