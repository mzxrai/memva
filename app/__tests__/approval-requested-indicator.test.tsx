import { render, screen } from '@testing-library/react'
import StatusIndicator from '../components/StatusIndicator'
import type { Session } from '../db/schema'

describe('Approval Requested Status Indicator', () => {
  const baseSession: Session = {
    id: '123',
    title: 'Test Session',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    project_path: '/test',
    metadata: null,
    settings: null,
    claude_status: 'processing'
  }

  it('should show Working status when processing without pending permissions', () => {
    render(<StatusIndicator session={baseSession} />)
    
    expect(screen.getByText('Working')).toBeInTheDocument()
    expect(screen.getByTestId('status-dot')).toHaveAttribute('data-status', 'processing')
  })

  it('should show Approval Requested when processing with pending permissions', () => {
    const sessionWithPermissions = {
      ...baseSession,
      pendingPermissionsCount: 1
    }
    
    render(<StatusIndicator session={sessionWithPermissions} />)
    
    expect(screen.getByText('Approval Requested')).toBeInTheDocument()
    expect(screen.getByTestId('status-dot')).toHaveAttribute('data-status', 'approval_requested')
  })

  it('should show Approval Requested for multiple pending permissions', () => {
    const sessionWithPermissions = {
      ...baseSession,
      pendingPermissionsCount: 3
    }
    
    render(<StatusIndicator session={sessionWithPermissions} />)
    
    expect(screen.getByText('Approval Requested')).toBeInTheDocument()
    expect(screen.getByTestId('status-dot')).toHaveClass('bg-amber-500')
  })

  it('should not show approval requested for other statuses even with pending permissions', () => {
    const sessionNotProcessing = {
      ...baseSession,
      claude_status: 'not_started',
      pendingPermissionsCount: 1
    }
    
    render(<StatusIndicator session={sessionNotProcessing} />)
    
    expect(screen.queryByText('Approval Requested')).not.toBeInTheDocument()
    expect(screen.getByTestId('status-dot')).toHaveAttribute('data-status', 'not_started')
  })

  it('should handle zero pending permissions', () => {
    const sessionWithZeroPermissions = {
      ...baseSession,
      pendingPermissionsCount: 0
    }
    
    render(<StatusIndicator session={sessionWithZeroPermissions} />)
    
    expect(screen.getByText('Working')).toBeInTheDocument()
    expect(screen.queryByText('Approval Requested')).not.toBeInTheDocument()
  })
})