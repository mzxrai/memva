import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PermissionsBadge from '../components/PermissionsBadge'
import { expectSemanticMarkup } from '../test-utils/component-testing'

describe('PermissionsBadge Component', () => {
  it('should render PLAN mode correctly', () => {
    render(<PermissionsBadge mode="plan" />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('PLAN')
    expect(badge).toHaveClass('text-blue-400')
  })

  it('should render ACCEPT EDITS mode correctly', () => {
    render(<PermissionsBadge mode="acceptEdits" />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    expect(badge).toHaveTextContent('ACCEPT EDITS')
    expect(badge).toHaveClass('text-emerald-400')
  })

  it('should render BYPASS PERMS mode correctly', () => {
    render(<PermissionsBadge mode="bypassPermissions" />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    expect(badge).toHaveTextContent('BYPASS PERMS')
    expect(badge).toHaveClass('text-amber-400')
  })

  it('should show updating state', () => {
    render(<PermissionsBadge mode="plan" isUpdating={true} />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    expect(badge).toHaveClass('opacity-60')
    expect(badge.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('should have proper accessibility attributes', () => {
    render(<PermissionsBadge mode="acceptEdits" />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Permission mode: acceptEdits'))
  })
})