import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import InlinePermissionRequest from '../components/permissions/InlinePermissionRequest'
import { createMockPermissionRequest } from '../test-utils/factories'
import { expectSemanticMarkup, expectInteraction } from '../test-utils/component-testing'

describe('InlinePermissionRequest Component', () => {
  const mockOnApprove = vi.fn()
  const mockOnDeny = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render pending permission request with tool description', () => {
    const request = createMockPermissionRequest({
      tool_name: 'Bash',
      input: { command: 'npm install' },
      status: 'pending'
    })

    render(
      <InlinePermissionRequest 
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
      />
    )

    expect(screen.getByText('Permission Required')).toBeInTheDocument()
    expect(screen.getByText('Execute command: npm install')).toBeInTheDocument()
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Deny')).toBeInTheDocument()
  })

  it('should show appropriate descriptions for different tools', () => {
    const testCases = [
      { tool_name: 'Read', input: { file_path: '/test.ts' }, expected: 'Read file: /test.ts' },
      { tool_name: 'Write', input: { file_path: '/new.ts' }, expected: 'Write to file: /new.ts' },
      { tool_name: 'Edit', input: { file_path: '/edit.ts' }, expected: 'Edit file: /edit.ts' },
      { tool_name: 'MultiEdit', input: { file_path: '/multi.ts' }, expected: 'Edit multiple sections in: /multi.ts' },
      { tool_name: 'CustomTool', input: {}, expected: 'Use CustomTool tool' }
    ]

    testCases.forEach(({ tool_name, input, expected }) => {
      const { unmount } = render(
        <InlinePermissionRequest 
          request={createMockPermissionRequest({ tool_name, input, status: 'pending' })}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
        />
      )
      
      expect(screen.getByText(expected)).toBeInTheDocument()
      unmount()
    })
  })

  it('should handle approve action', () => {
    const request = createMockPermissionRequest({ status: 'pending' })

    render(
      <InlinePermissionRequest 
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
      />
    )

    const approveButton = screen.getByRole('button', { name: 'Approve permission' })
    expectInteraction.clickable(approveButton)
    
    fireEvent.click(approveButton)
    expect(mockOnApprove).toHaveBeenCalledWith(request.id)
    expect(mockOnDeny).not.toHaveBeenCalled()
  })

  it('should handle deny action', () => {
    const request = createMockPermissionRequest({ status: 'pending' })

    render(
      <InlinePermissionRequest 
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
      />
    )

    const denyButton = screen.getByRole('button', { name: 'Deny permission' })
    expectInteraction.clickable(denyButton)
    
    fireEvent.click(denyButton)
    expect(mockOnDeny).toHaveBeenCalledWith(request.id)
    expect(mockOnApprove).not.toHaveBeenCalled()
  })

  it('should show approved status', () => {
    const request = createMockPermissionRequest({ 
      status: 'approved',
      decision: 'allow'
    })

    render(
      <InlinePermissionRequest 
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
      />
    )

    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve permission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deny permission' })).not.toBeInTheDocument()
  })

  it('should show denied status', () => {
    const request = createMockPermissionRequest({ 
      status: 'denied',
      decision: 'deny'
    })

    render(
      <InlinePermissionRequest 
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
      />
    )

    expect(screen.getByText('Denied')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve permission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deny permission' })).not.toBeInTheDocument()
  })

  it('should show timeout status', () => {
    const request = createMockPermissionRequest({ status: 'timeout' })

    render(
      <InlinePermissionRequest 
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
      />
    )

    expect(screen.getByText('Timed out')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve permission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deny permission' })).not.toBeInTheDocument()
  })

  it('should disable buttons when processing', () => {
    const request = createMockPermissionRequest({ status: 'pending' })

    render(
      <InlinePermissionRequest 
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
        isProcessing={true}
      />
    )

    const approveButton = screen.getByRole('button', { name: 'Approve permission' })
    const denyButton = screen.getByRole('button', { name: 'Deny permission' })
    
    expect(approveButton).toBeDisabled()
    expect(denyButton).toBeDisabled()
  })

  it('should show complex input as formatted JSON', () => {
    const request = createMockPermissionRequest({
      tool_name: 'ComplexTool',
      input: {
        nested: {
          value: 'test',
          array: [1, 2, 3]
        }
      },
      status: 'pending'
    })

    render(
      <InlinePermissionRequest 
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
      />
    )

    // The formatted JSON should be in a <code> element within a <pre>
    expect(screen.getByText(/"nested":/)).toBeInTheDocument()
    expect(screen.getByText(/"array":/)).toBeInTheDocument()
  })
})