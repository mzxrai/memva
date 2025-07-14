import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { createRoutesStub } from 'react-router'
import Home from './home'

// Mock the database service
vi.mock('../db/sessions.service', () => ({
  listSessionsWithStats: vi.fn().mockResolvedValue([])
}))

describe('Home Route', () => {
  it('should render home page with session creation input', async () => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Home,
        loader: async () => ({ sessions: [] })
      }
    ])
    
    render(<Stub />)
    
    expect(await screen.findByText('Sessions')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/start a new claude code session/i)).toBeInTheDocument()
  })
})