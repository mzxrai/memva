import type { Route } from "./+types/api.permissions.$id"
import { getPermissionRequests, updatePermissionDecision } from "../db/permissions.service"

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

    // Update the permission
    const updated = await updatePermissionDecision(id, { decision })
    
    return Response.json(updated)
  } catch (error) {
    console.error('[Permissions API] Error updating permission:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update permission" },
      { status: 500 }
    )
  }
}