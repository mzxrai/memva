import { render, screen } from '@testing-library/react'
import PermissionBadge from '../components/permissions/PermissionBadge'

describe('PermissionBadge', () => {
  it('should not render when count is 0', () => {
    const { container } = render(<PermissionBadge count={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('should show count when greater than 0', () => {
    render(<PermissionBadge count={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('should show 9+ for counts greater than 9', () => {
    render(<PermissionBadge count={15} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  it('should have accessible label', () => {
    render(<PermissionBadge count={5} />)
    expect(screen.getByLabelText('5 pending permission requests')).toBeInTheDocument()
  })

  it('should use singular form for count of 1', () => {
    render(<PermissionBadge count={1} />)
    expect(screen.getByLabelText('1 pending permission request')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(<PermissionBadge count={2} className="custom-class" />)
    const badge = screen.getByText('2')
    expect(badge).toHaveClass('custom-class')
  })
})