import { render, screen, fireEvent } from '@testing-library/react'
import { createMockPermissionRequest } from '../test-utils/factories'
import { expectSemanticMarkup, expectInteraction } from '../test-utils/component-testing'
import PermissionRequestNotification from '../components/permissions/PermissionRequestNotification'

describe('PermissionRequestNotification', () => {
  it('should render permission request with tool name and session info', () => {
    const mockRequest = createMockPermissionRequest({
      tool_name: 'Bash',
      session_id: 'test-session-123',
      status: 'pending'
    })

    render(<PermissionRequestNotification request={mockRequest} onApprove={vi.fn()} onDeny={vi.fn()} />)

    expectSemanticMarkup.heading(3, 'Permission Request')
    expect(screen.getByText(/Bash/)).toBeInTheDocument()
    expect(screen.getByText(/test-session-123/)).toBeInTheDocument()
  })

  it('should show approve and deny buttons for pending requests', () => {
    const mockRequest = createMockPermissionRequest({ status: 'pending' })
    const onApprove = vi.fn()
    const onDeny = vi.fn()

    render(<PermissionRequestNotification request={mockRequest} onApprove={onApprove} onDeny={onDeny} />)

    const approveButton = screen.getByRole('button', { name: /approve/i })
    const denyButton = screen.getByRole('button', { name: /deny/i })

    expectInteraction.clickable(approveButton)
    expectInteraction.clickable(denyButton)
  })

  it('should call onApprove when approve button is clicked', () => {
    const mockRequest = createMockPermissionRequest({ status: 'pending' })
    const onApprove = vi.fn()
    const onDeny = vi.fn()

    render(<PermissionRequestNotification request={mockRequest} onApprove={onApprove} onDeny={onDeny} />)

    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    expect(onApprove).toHaveBeenCalledWith(mockRequest.id)
    expect(onDeny).not.toHaveBeenCalled()
  })

  it('should call onDeny when deny button is clicked', () => {
    const mockRequest = createMockPermissionRequest({ status: 'pending' })
    const onApprove = vi.fn()
    const onDeny = vi.fn()

    render(<PermissionRequestNotification request={mockRequest} onApprove={onApprove} onDeny={onDeny} />)

    fireEvent.click(screen.getByRole('button', { name: /deny/i }))

    expect(onDeny).toHaveBeenCalledWith(mockRequest.id)
    expect(onApprove).not.toHaveBeenCalled()
  })

  it('should display approved status when request is approved', () => {
    const mockRequest = createMockPermissionRequest({ 
      status: 'approved',
      decision: 'allow'
    })

    render(<PermissionRequestNotification request={mockRequest} onApprove={vi.fn()} onDeny={vi.fn()} />)

    expect(screen.getByText(/approved/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deny/i })).not.toBeInTheDocument()
  })

  it('should display denied status when request is denied', () => {
    const mockRequest = createMockPermissionRequest({ 
      status: 'denied',
      decision: 'deny'
    })

    render(<PermissionRequestNotification request={mockRequest} onApprove={vi.fn()} onDeny={vi.fn()} />)

    expect(screen.getByText(/denied/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deny/i })).not.toBeInTheDocument()
  })

  it('should display timeout status when request has timed out', () => {
    const mockRequest = createMockPermissionRequest({ status: 'timeout' })

    render(<PermissionRequestNotification request={mockRequest} onApprove={vi.fn()} onDeny={vi.fn()} />)

    expect(screen.getByText(/timed out/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deny/i })).not.toBeInTheDocument()
  })

  it('should display tool input details when available', () => {
    const mockRequest = createMockPermissionRequest({
      tool_name: 'Write',
      input: {
        file_path: '/test/file.txt',
        content: 'Hello world'
      }
    })

    render(<PermissionRequestNotification request={mockRequest} onApprove={vi.fn()} onDeny={vi.fn()} />)

    expect(screen.getByText(/\/test\/file\.txt/)).toBeInTheDocument()
  })

  it('should handle empty input gracefully', () => {
    const mockRequest = createMockPermissionRequest({
      tool_name: 'Read',
      input: {}
    })

    render(<PermissionRequestNotification request={mockRequest} onApprove={vi.fn()} onDeny={vi.fn()} />)

    expect(screen.getByText(/Read/)).toBeInTheDocument()
  })

  it('should show time remaining for pending requests', () => {
    const futureDate = new Date()
    futureDate.setHours(futureDate.getHours() + 2)
    
    const mockRequest = createMockPermissionRequest({
      status: 'pending',
      expires_at: futureDate.toISOString()
    })

    render(<PermissionRequestNotification request={mockRequest} onApprove={vi.fn()} onDeny={vi.fn()} />)

    expect(screen.getByText(/expires in/i)).toBeInTheDocument()
  })
})