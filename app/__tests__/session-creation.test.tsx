import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRoutesStub } from 'react-router'
import Home, { loader as homeLoader } from '../routes/home'

// Mock the database service
vi.mock('../db/sessions.service', () => ({
  listSessionsWithStats: vi.fn().mockResolvedValue([]),
  listSessions: vi.fn().mockResolvedValue([]),
  getSessionWithStats: vi.fn().mockResolvedValue(null),
  createSession: vi.fn().mockResolvedValue({ id: 'new-session-id' })
}))

describe('Session Creation', () => {
  it('should display a session creation input bar', async () => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader
      }
    ])

    render(<Stub />)

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/start a new claude code session/i)
      expect(input).toBeInTheDocument()
      
      const button = screen.getByRole('button', { name: /start/i })
      expect(button).toBeInTheDocument()
    })
  })

  it('should create a new session when Enter is pressed', async () => {
    const user = userEvent.setup()
    const mockAction = vi.fn().mockResolvedValue({ ok: true })
    
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader,
        action: mockAction
      }
    ])

    render(<Stub />)

    await waitFor(() => screen.getByPlaceholderText(/start a new claude code session/i))
    
    const input = screen.getByPlaceholderText(/start a new claude code session/i)
    await user.type(input, 'Fix authentication bug{Enter}')

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalled()
    })
  })

  it('should create a new session when Start button is clicked', async () => {
    const user = userEvent.setup()
    const mockAction = vi.fn().mockResolvedValue({ ok: true })
    
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader,
        action: mockAction
      }
    ])

    render(<Stub />)

    await waitFor(() => screen.getByPlaceholderText(/start a new claude code session/i))

    const input = screen.getByPlaceholderText(/start a new claude code session/i)
    const button = screen.getByRole('button', { name: /start/i })
    
    await user.type(input, 'Implement new feature')
    await user.click(button)

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalled()
    })
  })

  it('should not create session with empty input', async () => {
    const user = userEvent.setup()
    const mockAction = vi.fn()
    
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader,
        action: mockAction
      }
    ])

    render(<Stub />)

    await waitFor(() => screen.getByRole('button', { name: /start/i }))

    const button = screen.getByRole('button', { name: /start/i })
    await user.click(button)

    expect(mockAction).not.toHaveBeenCalled()
  })
})