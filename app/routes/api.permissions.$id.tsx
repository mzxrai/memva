import type { Route } from "./+types/api.permissions.$id"
import { getPermissionRequests, updatePermissionDecision, canAnswerPermission } from "../db/permissions.service"
import { getActiveJobForSession, cancelJob, getJob } from "../db/jobs.service"
import { updateSessionClaudeStatus } from "../db/sessions.service"
import { createEventFromMessage, storeEvent } from "../db/events.service"
import { findAssistantEventWithToolUseId } from "../db/event-session.service"
import type { SDKMessage } from '@anthropic-ai/claude-code'

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const { id } = params

  try {
    const body = await request.json()
    const { decision } = body

    if (!decision) {
      return Response.json(
        { error: "Decision is required" },
        { status: 400 }
      )
    }

    if (decision !== 'allow' && decision !== 'deny') {
      return Response.json(
        { error: 'Invalid decision. Must be "allow" or "deny"' },
        { status: 400 }
      )
    }

    // Check if permission exists
    const permissions = await getPermissionRequests({ id })
    if (permissions.length === 0) {
      return Response.json(
        { error: "Permission request not found" },
        { status: 404 }
      )
    }

    const permission = permissions[0]
    
    // Check if already decided
    if (permission.status !== 'pending') {
      return Response.json(
        { error: "Permission request has already been decided" },
        { status: 400 }
      )
    }
    
    // Check if permission can still be answered
    const canAnswer = await canAnswerPermission(id)
    if (!canAnswer) {
      return Response.json(
        { error: "Permission request can no longer be answered" },
        { status: 400 }
      )
    }

    // Check how many pending permissions exist BEFORE updating this one
    const pendingPermissionsBefore = await getPermissionRequests({ 
      session_id: permission.session_id, 
      status: 'pending' 
    })
    
    // Update the permission
    const updated = await updatePermissionDecision(id, { decision })
    
    // Calculate remaining permissions (subtract 1 from the count before update)
    const remainingPermissionsCount = pendingPermissionsBefore.length - 1
    
    // If permission was denied, handle the denial
    if (decision === 'deny') {
      
      // If we have a tool_use_id, create a synthetic tool_result event
      if (permission.tool_use_id) {
        
        // Find the parent assistant event that contains this tool_use_id
        const parentEvent = await findAssistantEventWithToolUseId(permission.session_id, permission.tool_use_id)
        
        // Create synthetic tool_result event to show denial in UI
        const toolResultMessage: SDKMessage = {
          type: 'user',
          message: {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: permission.tool_use_id,
              content: 'User denied request',
              is_error: true
            }]
          },
          parent_tool_use_id: null,
          session_id: ''
        }
        
        const toolResultEvent = createEventFromMessage({
          message: toolResultMessage,
          memvaSessionId: permission.session_id,
          projectPath: parentEvent?.cwd || '/',
          parentUuid: parentEvent?.uuid || null,
          timestamp: new Date().toISOString()
        })
        
        await storeEvent(toolResultEvent)
      }
      
      // Don't cancel the job immediately - let Claude process the denial first
      // The MCP server will return the denial to Claude, which should then:
      // 1. Create a tool_result event with the error
      // 2. Continue or stop based on its own logic
      
      // We can schedule a delayed cancellation to ensure cleanup
      const activeJob = await getActiveJobForSession(permission.session_id)
      
      // If there are no remaining pending permissions and we denied this one,
      // we should update the status immediately
      if (remainingPermissionsCount === 0) {
        if (activeJob) {
          // Cancel the job immediately since all permissions are handled
          await cancelJob(activeJob.id)
        }
        // Update session status to completed since no more permissions are pending
        await updateSessionClaudeStatus(permission.session_id, 'completed')
      } else if (activeJob) {
        // There are still pending permissions, so just schedule a delayed cleanup
        setTimeout(async () => {
          try {
            const currentJob = await getJob(activeJob.id)
            // Only cancel if still running after delay
            if (currentJob && (currentJob.status === 'running' || currentJob.status === 'pending')) {
              await cancelJob(activeJob.id)
              await updateSessionClaudeStatus(permission.session_id, 'completed')
            }
          } catch (error) {
            console.error(`Error in delayed cancellation:`, error)
          }
        }, 1000) // 1 second delay to allow Claude to process
      }
    }
    
    return Response.json(updated)
  } catch (error) {
    console.error('[Permissions API] Error updating permission:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update permission" },
      { status: 500 }
    )
  }
}