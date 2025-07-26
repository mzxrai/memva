import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsModal from '../components/SettingsModal'
import { expectSemanticMarkup } from '../test-utils/component-testing'
import { server } from '../test-utils/msw-server'
import { http, HttpResponse } from 'msw'

describe('SettingsModal Component', () => {
  beforeEach(() => {
    // Reset MSW handlers to defaults
    server.resetHandlers()
  })

  it('should not render when closed', () => {
    render(<SettingsModal isOpen={false} onClose={() => {}} />)
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should render with proper accessibility when open', async () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />)
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByLabelText(/max turns/i)).toBeInTheDocument()
    })
    
    expectSemanticMarkup.heading(2, 'Default settings for new sessions')
    expect(screen.getByRole('spinbutton', { name: /max turns/i })).toBeInTheDocument()
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'settings-modal-title')
  })

  it('should load settings from API when opened', async () => {
    const mockSettings = { maxTurns: 150, permissionMode: 'plan' }
    
    // Override the default handler for this test
    server.use(
      http.get('/api/settings', () => {
        return HttpResponse.json(mockSettings)
      })
    )

    render(<SettingsModal isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      const input = screen.getByLabelText(/max turns/i) as HTMLInputElement
      expect(input.value).toBe('150')
    })
  })

  it('should validate max turns input', async () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/max turns/i)).toBeInTheDocument()
    })

    const input = screen.getByLabelText(/max turns/i) as HTMLInputElement
    
    // Test invalid values
    fireEvent.change(input, { target: { value: '0' } })
    await waitFor(() => {
      expect(screen.getByText('Must be at least 1')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: '1001' } })
    await waitFor(() => {
      expect(screen.getByText('Must be 1000 or less')).toBeInTheDocument()
    })

    // Test valid value
    fireEvent.change(input, { target: { value: '100' } })
    await waitFor(() => {
      expect(screen.queryByText(/must be/i)).not.toBeInTheDocument()
    })
  })

  it('should save settings when Save button is clicked', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/max turns/i)).toBeInTheDocument()
    })

    // Change values
    const input = screen.getByLabelText(/max turns/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: '300' } })

    const acceptEditsButton = screen.getByText('Accept Edits').closest('button')
    if (acceptEditsButton) {
      fireEvent.click(acceptEditsButton)
    }

    // Save
    const saveButton = screen.getByText('Save Settings')
    fireEvent.click(saveButton)

    // Wait for save button to be enabled after changing values
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled()
    })

    // Should close after successful save
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  it('should close on Escape key', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('should save on Cmd+Enter', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter', metaKey: true })

    // Should close after successful save
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  it('should show all permission mode options', async () => {

    render(<SettingsModal isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Permission Mode')).toBeInTheDocument()
    })

    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getByText('Accept Edits')).toBeInTheDocument()
    expect(screen.getByText('Bypass Permissions')).toBeInTheDocument()
    expect(screen.getByText('Plan Mode')).toBeInTheDocument()
  })

  describe('Modal Modes', () => {
    it('should render global mode with correct title', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} mode="global" />)
      
      // Wait for content to load
      await waitFor(() => {
        expect(screen.getByLabelText(/max turns/i)).toBeInTheDocument()
      })
      
      expectSemanticMarkup.heading(2, 'Default settings for new sessions')
      // Helper text was removed from the UI
    })

    it('should render session mode with correct title', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} mode="session" sessionId="test-session-123" />)
      
      expectSemanticMarkup.heading(2, 'Session settings')
      expect(screen.queryByText('These settings will be used as defaults for all new sessions')).not.toBeInTheDocument()
    })

    it('should load session settings in session mode', async () => {
      const mockSessionSettings = { maxTurns: 300, permissionMode: 'bypassPermissions' }
      
      server.use(
        http.get('/api/session/:sessionId/settings', () => {
          return HttpResponse.json(mockSessionSettings)
        })
      )

      render(<SettingsModal isOpen={true} onClose={() => {}} mode="session" sessionId="test-session-123" />)

      await waitFor(() => {
        const input = screen.getByLabelText(/max turns/i) as HTMLInputElement
        expect(input.value).toBe('300')
      })
    })

    it('should save to correct endpoint based on mode', async () => {
      const onClose = vi.fn()
      let savedEndpoint = ''
      
      server.use(
        http.put('*', ({ request }) => {
          savedEndpoint = request.url
          return HttpResponse.json({ success: true })
        })
      )

      // Test global mode
      const { rerender } = render(<SettingsModal isOpen={true} onClose={onClose} mode="global" />)
      
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Save Settings'))
      
      await waitFor(() => {
        expect(savedEndpoint).toContain('/api/settings')
      })

      // Test session mode
      onClose.mockClear()
      rerender(<SettingsModal isOpen={true} onClose={onClose} mode="session" sessionId="test-123" />)
      
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Save Settings'))
      
      await waitFor(() => {
        expect(savedEndpoint).toContain('/api/session/test-123/settings')
      })
    })
  })
})