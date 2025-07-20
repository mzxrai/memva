import type { Route } from "./+types/api.permissions"
import { getPermissionRequests } from "../db/permissions.service"

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const session_id = url.searchParams.get('session_id') || undefined
  const status = url.searchParams.get('status') || undefined
  
  const permissions = await getPermissionRequests({ session_id, status })
  
  return Response.json(permissions)
}