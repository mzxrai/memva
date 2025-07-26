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
    // Check for plan text
    expect(badge).toHaveTextContent('Plan')
    // Check for spinner element
    const spinner = badge.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
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

  it('should show disabled tooltip when isDisabled is true', () => {
    render(<PermissionsBadge mode="plan" isDisabled={true} />)
    
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('title', 'Cannot change permissions during active processing')
  })

  it('should show mode description tooltip when isDisabled is false', () => {
    render(<PermissionsBadge mode="plan" isDisabled={false} />)
    
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('title', 'Agent plans actions before executing')
  })

  it('should include disabled state in aria-label when disabled', () => {
    render(<PermissionsBadge mode="acceptEdits" isDisabled={true} />)
    
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('aria-label', 'Permissions mode: Accept Edits (changes disabled during processing)')
  })

  it('should show mode description in tooltip when not disabled', () => {
    render(<PermissionsBadge mode="plan" isDisabled={false} />)
    
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('title', 'Agent plans actions before executing')
  })

  it('should show mode description for all permission modes', () => {
    const modes = [
      { mode: 'default' as const, description: 'Standard behavior - prompts for permissions' },
      { mode: 'plan' as const, description: 'Agent plans actions before executing' },
      { mode: 'acceptEdits' as const, description: 'Automatically accept file edits' },
      { mode: 'bypassPermissions' as const, description: 'Bypass all permission checks' }
    ]

    modes.forEach(({ mode, description }) => {
      const { container } = render(<PermissionsBadge mode={mode} isDisabled={false} />)
      const badge = container.querySelector('[role="status"]')
      expect(badge).toHaveAttribute('title', description)
    })
  })
})