import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DirectorySelector from '../components/DirectorySelector'
import { expectSemanticMarkup } from '../test-utils/component-testing'
import { server } from '../test-utils/msw-server'
import { http, HttpResponse } from 'msw'

describe('DirectorySelector Component', () => {
  const mockOnSelect = vi.fn()
  const mockOnClose = vi.fn()
  const defaultDirectory = '/Users/testuser/projects'

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Add default handlers for filesystem API
    server.use(
      http.get('/api/filesystem', ({ request }) => {
        const url = new URL(request.url)
        const action = url.searchParams.get('action')
        const path = url.searchParams.get('path')
        
        if (action === 'expand') {
          // Default expand behavior - just return the path as-is
          return HttpResponse.json({ expandedPath: path || '' })
        }
        
        return HttpResponse.json({})
      })
    )
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => JSON.stringify(['/Users/testuser/recent1', '/Users/testuser/recent2'])),
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

  it('should render with current directory', () => {
    render(
      <DirectorySelector
        isOpen={true}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByDisplayValue(defaultDirectory)).toBeInTheDocument()
    expectSemanticMarkup.heading(2, 'Select Directory')
  })

  it('should not render when closed', () => {
    render(
      <DirectorySelector
        isOpen={false}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    expect(screen.queryByText('Select Directory')).not.toBeInTheDocument()
  })

  it('should expand path on input change', async () => {
    server.use(
      http.get('/api/filesystem', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('action') === 'expand') {
          return HttpResponse.json({ expandedPath: '/Users/testuser/documents' })
        }
        return HttpResponse.json({ valid: true })
      })
    )

    render(
      <DirectorySelector
        isOpen={true}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByDisplayValue(defaultDirectory)
    fireEvent.change(input, { target: { value: '~/documents' } })

    await waitFor(() => {
      expect(screen.getByText('→ /Users/testuser/documents')).toBeInTheDocument()
    })
  })

  it('should validate directory on blur', async () => {
    server.use(
      http.get('/api/filesystem', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('action') === 'validate') {
          return HttpResponse.json({ valid: false, resolvedPath: '/invalid/path' })
        }
        if (url.searchParams.get('action') === 'expand') {
          return HttpResponse.json({ expandedPath: '/invalid/path' })
        }
        return HttpResponse.json({})
      })
    )

    render(
      <DirectorySelector
        isOpen={true}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByDisplayValue(defaultDirectory)
    fireEvent.change(input, { target: { value: '/invalid/path' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.getByText("This directory couldn't be found. Please check the path and try again.")).toBeInTheDocument()
    })
  })

  it('should select directory on Enter key', async () => {
    server.use(
      http.get('/api/filesystem', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('action') === 'validate') {
          return HttpResponse.json({ valid: true, resolvedPath: '/Users/testuser/valid' })
        }
        if (url.searchParams.get('action') === 'expand') {
          return HttpResponse.json({ expandedPath: '/Users/testuser/valid' })
        }
        return HttpResponse.json({})
      })
    )

    render(
      <DirectorySelector
        isOpen={true}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByDisplayValue(defaultDirectory)
    fireEvent.change(input, { target: { value: '/Users/testuser/valid' } })
    
    // Wait for validation
    await waitFor(() => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith('/Users/testuser/valid')
    })
  })

  it('should close on Escape key', () => {
    render(
      <DirectorySelector
        isOpen={true}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByDisplayValue(defaultDirectory)
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should display recent directories', () => {
    render(
      <DirectorySelector
        isOpen={true}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Recent Directories')).toBeInTheDocument()
    expect(screen.getByText('/Users/testuser/recent1')).toBeInTheDocument()
    expect(screen.getByText('/Users/testuser/recent2')).toBeInTheDocument()
  })

  it('should select recent directory on click', async () => {
    server.use(
      http.get('/api/filesystem', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('action') === 'validate') {
          return HttpResponse.json({ valid: true, resolvedPath: '/Users/testuser/recent1' })
        }
        return HttpResponse.json({})
      })
    )

    render(
      <DirectorySelector
        isOpen={true}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    const recentDir = screen.getByText('/Users/testuser/recent1')
    fireEvent.click(recentDir)

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith('/Users/testuser/recent1')
    })
  })

  // Removed: "Use Current Directory" button was removed from the UI
  // it('should show current directory button', () => {
  //   render(
  //     <DirectorySelector
  //       isOpen={true}
  //       currentDirectory={defaultDirectory}
  //       onSelect={mockOnSelect}
  //       onClose={mockOnClose}
  //     />
  //   )

  //   const currentDirButton = screen.getByText('Use Current Directory')
  //   expectInteraction.clickable(currentDirButton)
  // })

  // it('should select current directory on button click', async () => {
  //   server.use(
  //     http.get('/api/filesystem', ({ request }) => {
  //       const url = new URL(request.url)
  //       if (url.searchParams.get('action') === 'current') {
  //         return HttpResponse.json({ currentDirectory: '/Users/testuser/current' })
  //       }
  //       if (url.searchParams.get('action') === 'validate') {
  //         return HttpResponse.json({ valid: true, resolvedPath: '/Users/testuser/current' })
  //       }
  //       return HttpResponse.json({})
  //     })
  //   )

  //   render(
  //     <DirectorySelector
  //       isOpen={true}
  //       currentDirectory={defaultDirectory}
  //       onSelect={mockOnSelect}
  //       onClose={mockOnClose}
  //     />
  //   )

  //   const button = screen.getByText('Use Current Directory')
  //   fireEvent.click(button)

  //   await waitFor(() => {
  //     expect(mockOnSelect).toHaveBeenCalledWith('/Users/testuser/current')
  //   })
  // })

  it('should update localStorage when directory is selected', async () => {
    server.use(
      http.get('/api/filesystem', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('action') === 'validate') {
          return HttpResponse.json({ valid: true, resolvedPath: '/Users/testuser/new' })
        }
        if (url.searchParams.get('action') === 'expand') {
          return HttpResponse.json({ expandedPath: '/Users/testuser/new' })
        }
        return HttpResponse.json({})
      })
    )

    render(
      <DirectorySelector
        isOpen={true}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByDisplayValue(defaultDirectory)
    fireEvent.change(input, { target: { value: '/Users/testuser/new' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalled()
    })
  })

  it('should have proper accessibility attributes', () => {
    render(
      <DirectorySelector
        isOpen={true}
        currentDirectory={defaultDirectory}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    )

    const modal = screen.getByRole('dialog')
    expect(modal).toHaveAttribute('aria-modal', 'true')
    expect(modal).toHaveAttribute('aria-labelledby')

    const input = screen.getByLabelText('Directory path')
    expect(input).toBeInTheDocument()
  })
})