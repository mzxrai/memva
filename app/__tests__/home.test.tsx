import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { createRoutesStub } from 'react-router'
import Home, { loader as homeLoader } from '../routes/home'

// Mock the database service
vi.mock('../db/sessions.service', () => ({
  listSessions: vi.fn().mockResolvedValue([]),
  getSessionWithStats: vi.fn().mockResolvedValue(null),
  createSession: vi.fn()
}))

describe('Home Route', () => {
  it('should render home page with session creation input', async () => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: homeLoader
      }
    ])
    
    render(<Stub />)
    
    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/start a new claude code session/i)).toBeInTheDocument()
    })
  })
})