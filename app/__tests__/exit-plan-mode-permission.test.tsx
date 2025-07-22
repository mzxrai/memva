import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import { createMockSession, createMockPermissionRequest } from '../test-utils/factories'
import { expectSemanticMarkup, expectInteraction } from '../test-utils/component-testing'
import CompactInlinePermission from '../components/permissions/CompactInlinePermission'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

describe('Exit Plan Mode Permission Request', () => {
  let testDb: TestDatabase
  const mockOnApprove = vi.fn()
  const mockOnDeny = vi.fn()
  const mockOnApproveWithSettings = vi.fn()

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
    vi.clearAllMocks()
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  it('should show three options for exit_plan_mode permissions', () => {
    const request = createMockPermissionRequest({
      tool_name: 'exit_plan_mode',
      status: 'pending'
    })

    render(
      <CompactInlinePermission
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
        onApproveWithSettings={mockOnApproveWithSettings}
        isExitPlanMode={true}
      />
    )

    // Check the question text
    expect(screen.getByText('Would you like to proceed?')).toBeInTheDocument()

    // Check all three buttons exist
    expectSemanticMarkup.button('Yes & auto-approve edits')
    expectSemanticMarkup.button('Yes & manually approve edits')
    expectSemanticMarkup.button('No, keep planning')
  })

  it('should handle "Yes & auto-approve edits" click', async () => {
    const request = createMockPermissionRequest({
      tool_name: 'exit_plan_mode',
      status: 'pending'
    })

    render(
      <CompactInlinePermission
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
        onApproveWithSettings={mockOnApproveWithSettings}
        isExitPlanMode={true}
      />
    )

    const autoApproveButton = screen.getByRole('button', { name: 'Yes & auto-approve edits' })
    fireEvent.click(autoApproveButton)

    await waitFor(() => {
      expect(mockOnApproveWithSettings).toHaveBeenCalledWith(request.id, 'acceptEdits')
    })
    expect(mockOnApprove).not.toHaveBeenCalled()
    expect(mockOnDeny).not.toHaveBeenCalled()
  })

  it('should handle "Yes & manually approve edits" click', async () => {
    const request = createMockPermissionRequest({
      tool_name: 'exit_plan_mode',
      status: 'pending'
    })

    render(
      <CompactInlinePermission
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
        onApproveWithSettings={mockOnApproveWithSettings}
        isExitPlanMode={true}
      />
    )

    const manualApproveButton = screen.getByRole('button', { name: 'Yes & manually approve edits' })
    fireEvent.click(manualApproveButton)

    await waitFor(() => {
      expect(mockOnApproveWithSettings).toHaveBeenCalledWith(request.id, 'default')
    })
    expect(mockOnApprove).not.toHaveBeenCalled()
    expect(mockOnDeny).not.toHaveBeenCalled()
  })

  it('should handle "No, keep planning" click', async () => {
    const request = createMockPermissionRequest({
      tool_name: 'exit_plan_mode',
      status: 'pending'
    })

    render(
      <CompactInlinePermission
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
        onApproveWithSettings={mockOnApproveWithSettings}
        isExitPlanMode={true}
      />
    )

    const denyButton = screen.getByRole('button', { name: 'No, keep planning' })
    fireEvent.click(denyButton)

    await waitFor(() => {
      expect(mockOnDeny).toHaveBeenCalledWith(request.id)
    })
    expect(mockOnApprove).not.toHaveBeenCalled()
    expect(mockOnApproveWithSettings).not.toHaveBeenCalled()
  })

  it('should show regular approve/deny for non-exit_plan_mode', () => {
    const request = createMockPermissionRequest({
      tool_name: 'Bash',
      status: 'pending'
    })

    render(
      <CompactInlinePermission
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
        isExitPlanMode={false}
      />
    )

    // Check regular permission text
    expect(screen.getByText('Do you approve this action?')).toBeInTheDocument()

    // Check only two buttons exist by their aria-labels
    const approveButton = screen.getByRole('button', { name: 'Approve permission' })
    const denyButton = screen.getByRole('button', { name: 'Deny permission' })
    expect(approveButton).toBeInTheDocument()
    expect(denyButton).toBeInTheDocument()
    
    // Make sure the three-option buttons don't exist
    expect(screen.queryByRole('button', { name: 'Yes & auto-approve edits' })).not.toBeInTheDocument()
  })

  it('should disable all buttons when processing', () => {
    const request = createMockPermissionRequest({
      tool_name: 'exit_plan_mode',
      status: 'pending'
    })

    render(
      <CompactInlinePermission
        request={request}
        onApprove={mockOnApprove}
        onDeny={mockOnDeny}
        onApproveWithSettings={mockOnApproveWithSettings}
        isExitPlanMode={true}
        isProcessing={true}
      />
    )

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })
})