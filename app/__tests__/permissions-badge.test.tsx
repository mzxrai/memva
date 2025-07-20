import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PermissionsBadge from '../components/PermissionsBadge'

describe('PermissionsBadge Component', () => {
  it('should render PLAN mode correctly', () => {
    render(<PermissionsBadge mode="plan" />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Plan')
  })

  it('should render ACCEPT EDITS mode correctly', () => {
    render(<PermissionsBadge mode="acceptEdits" />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    expect(badge).toHaveTextContent('Accept Edits')
  })

  it('should render BYPASS PERMS mode correctly', () => {
    render(<PermissionsBadge mode="bypassPermissions" />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    expect(badge).toHaveTextContent('Bypass Perms')
  })

  it('should show updating state', () => {
    render(<PermissionsBadge mode="plan" isUpdating={true} />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    // Check for updating text or indicator
    expect(badge).toHaveTextContent('Plan')
    expect(badge).toHaveTextContent('Updating...')
  })

  it('should have proper accessibility attributes', () => {
    render(<PermissionsBadge mode="acceptEdits" />)
    
    const badge = screen.getByRole('status', { name: /permissions mode/i })
    expect(badge).toHaveAttribute('aria-label', 'Permissions mode: Accept Edits')
  })

  it('should display shortcut hint', () => {
    render(<PermissionsBadge mode="plan" />)
    
    // Should show ⇧TAB hint
    expect(screen.getByText('⇧TAB')).toBeInTheDocument()
  })
})