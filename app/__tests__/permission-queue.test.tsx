import { render, screen, fireEvent } from '@testing-library/react'
import { createMockPermissionRequest } from '../test-utils/factories'
import { expectSemanticMarkup } from '../test-utils/component-testing'
import PermissionQueue from '../components/permissions/PermissionQueue'

describe('PermissionQueue', () => {
  it('should render empty state when no requests', () => {
    render(<PermissionQueue requests={[]} onApprove={vi.fn()} onDeny={vi.fn()} />)
    
    expect(screen.getByText(/no pending permission requests/i)).toBeInTheDocument()
  })

  it('should render list of permission requests', () => {
    const requests = [
      createMockPermissionRequest({ 
        id: 'req-1',
        tool_name: 'Bash',
        status: 'pending' 
      }),
      createMockPermissionRequest({ 
        id: 'req-2',
        tool_name: 'Write',
        status: 'pending' 
      }),
      createMockPermissionRequest({ 
        id: 'req-3',
        tool_name: 'Read',
        status: 'approved' 
      })
    ]

    render(<PermissionQueue requests={requests} onApprove={vi.fn()} onDeny={vi.fn()} />)

    expectSemanticMarkup.heading(2, 'Permission Requests')
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByText('Write')).toBeInTheDocument()
    expect(screen.getByText('Read')).toBeInTheDocument()
  })

  it('should show count of pending requests', () => {
    const requests = [
      createMockPermissionRequest({ status: 'pending' }),
      createMockPermissionRequest({ status: 'pending' }),
      createMockPermissionRequest({ status: 'approved' }),
      createMockPermissionRequest({ status: 'denied' })
    ]

    render(<PermissionQueue requests={requests} onApprove={vi.fn()} onDeny={vi.fn()} />)

    expect(screen.getByText(/2 pending/i)).toBeInTheDocument()
  })

  it('should pass through approve and deny callbacks', () => {
    const onApprove = vi.fn()
    const onDeny = vi.fn()
    
    const requests = [
      createMockPermissionRequest({ 
        id: 'test-req-123',
        status: 'pending' 
      })
    ]

    render(<PermissionQueue requests={requests} onApprove={onApprove} onDeny={onDeny} />)

    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(onApprove).toHaveBeenCalledWith('test-req-123')

    fireEvent.click(screen.getByRole('button', { name: /deny/i }))
    expect(onDeny).toHaveBeenCalledWith('test-req-123')
  })

  it('should group requests by session', () => {
    const requests = [
      createMockPermissionRequest({ 
        session_id: 'session-a',
        tool_name: 'Bash'
      }),
      createMockPermissionRequest({ 
        session_id: 'session-a',
        tool_name: 'Write'
      }),
      createMockPermissionRequest({ 
        session_id: 'session-b',
        tool_name: 'Read'
      })
    ]

    render(<PermissionQueue requests={requests} onApprove={vi.fn()} onDeny={vi.fn()} />)

    // Check that we have the right tools grouped
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByText('Write')).toBeInTheDocument()
    expect(screen.getByText('Read')).toBeInTheDocument()
    
    // Verify both sessions appear
    const queueContent = screen.getByTestId('permission-queue')
    expect(queueContent).toHaveTextContent('session-a')
    expect(queueContent).toHaveTextContent('session-b')
  })

  it('should sort pending requests before completed ones', () => {
    const requests = [
      createMockPermissionRequest({ 
        id: 'req-1',
        tool_name: 'Completed',
        status: 'approved',
        created_at: new Date('2024-01-01').toISOString()
      }),
      createMockPermissionRequest({ 
        id: 'req-2',
        tool_name: 'Pending',
        status: 'pending',
        created_at: new Date('2024-01-02').toISOString()
      })
    ]

    render(<PermissionQueue requests={requests} onApprove={vi.fn()} onDeny={vi.fn()} />)

    const allText = screen.getByTestId('permission-queue').textContent
    const pendingIndex = allText?.indexOf('Pending') ?? -1
    const completedIndex = allText?.indexOf('Completed') ?? -1
    
    expect(pendingIndex).toBeLessThan(completedIndex)
  })
})