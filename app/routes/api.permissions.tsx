import type { Route } from "./+types/api.permissions"
import { getPermissionRequests, getPendingPermissionRequests } from "../db/permissions.service"

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const session_id = url.searchParams.get('session_id') || url.searchParams.get('sessionId') || undefined
  const status = url.searchParams.get('status') || undefined
  
  // If requesting pending permissions, use the function that filters out expired ones
  if (status === 'pending') {
    const permissions = await getPendingPermissionRequests(session_id)
    return Response.json({ permissions })
  }
  
  // For other statuses, use the regular function
  const permissions = await getPermissionRequests({ session_id, status })
  
  return Response.json({ permissions })
}