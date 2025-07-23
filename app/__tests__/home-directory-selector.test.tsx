import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useLoaderData } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from '../routes/home'
import { server } from '../test-utils/msw-server'
import { http, HttpResponse } from 'msw'

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
  )
}))

// Mock useHomepageData hook
vi.mock('../hooks/useHomepageData', () => ({
  useHomepageData: vi.fn(() => ({ 
    sessions: [],
    archivedCount: 0,
    timestamp: new Date().toISOString(),
    error: null,
    isLoading: false
  }))
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

describe('Home Component - Directory Selector', () => {
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
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => {
          if (key === 'memvaLastDirectory') {
            return '/Users/testuser/last-used'
          }
          return null
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    server.resetHandlers()
  })

  it('should render terminal-style directory prefix', () => {
    // Mock loader data
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Should show current directory in terminal style
    expect(screen.getByText('$')).toBeInTheDocument()
  })

  it('should load last used directory from localStorage', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Should use the last directory from localStorage (shows shortened path)
    expect(screen.getByText('~/last-used')).toBeInTheDocument()
    expect(screen.getByText('$')).toBeInTheDocument()
  })

  it('should open directory selector when prefix is clicked', async () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    const directoryButton = screen.getByTitle('Click to change directory')
    fireEvent.click(directoryButton)

    // Directory selector should open
    await waitFor(() => {
      expect(screen.getByText('Select Directory')).toBeInTheDocument()
    })
  })

  it('should update directory when selected from modal', async () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    server.use(
      http.get('/api/filesystem', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('action') === 'validate') {
          return HttpResponse.json({ valid: true, resolvedPath: '/Users/testuser/new-project' })
        }
        return HttpResponse.json({})
      })
    )

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Open directory selector
    const directoryButton = screen.getByTitle('Click to change directory')
    fireEvent.click(directoryButton)

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Select Directory')).toBeInTheDocument()
    })

    // Change directory
    const input = screen.getByLabelText('Directory path')
    fireEvent.change(input, { target: { value: '/Users/testuser/new-project' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Should update the prefix (shows full path initially)
    await waitFor(() => {
      expect(screen.getByText('~/new-project')).toBeInTheDocument()
    })

    // Should save to localStorage
    expect(window.localStorage.setItem).toHaveBeenCalledWith('memvaLastDirectory', '/Users/testuser/new-project')
  })

  it('should include directory in form submission', async () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    const mockSubmit = vi.fn()
    
    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Find the form and attach submit handler
    const form = screen.getByRole('textbox').closest('form')
    if (form) {
      form.onsubmit = mockSubmit
    }

    // Type in session input
    const input = screen.getByPlaceholderText(/start a new session/i)
    fireEvent.change(input, { target: { value: 'Build a feature' } })

    // Submit form
    if (form) {
      fireEvent.submit(form)
    }

    // Check that form includes project_path hidden input
    await waitFor(() => {
      const hiddenInput = screen.getByDisplayValue('/Users/testuser/last-used') as HTMLInputElement
      expect(hiddenInput.type).toBe('hidden')
      expect(hiddenInput.name).toBe('project_path')
    })
  })

  it('should shorten path display for long paths', () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })

    // Mock a very long path
    vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
      if (key === 'memvaLastDirectory') {
        return '/Users/testuser/very/long/path/to/deeply/nested/project/directory'
      }
      return null
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Should show shortened path with tilde
    expect(screen.getByText('~/.../project/directory')).toBeInTheDocument()
  })

  it('should use current directory if no last directory in localStorage', async () => {
    vi.mocked(useLoaderData).mockReturnValue({ sessions: [] })
    
    // Mock localStorage to return null
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)

    // Mock the current directory API call
    server.use(
      http.get('/api/filesystem', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('action') === 'current') {
          return HttpResponse.json({ currentDirectory: '/Users/testuser/memva' })
        }
        return HttpResponse.json({})
      })
    )

    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    )

    // Should fetch and display current directory (shows full path initially)
    await waitFor(() => {
      expect(screen.getByText('~/memva')).toBeInTheDocument()
    })
  })
})