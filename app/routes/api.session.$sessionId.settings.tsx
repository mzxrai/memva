import type { Route } from "./+types/api.session.$sessionId.settings"
import { getSession, updateSessionSettings, getSessionSettings } from "../db/sessions.service"
import type { SettingsConfig } from "../types/settings"
import { PERMISSION_MODES } from "../types/settings"



// GET /api/session/:sessionId/settings
export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.sessionId)
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 })
  }

  const settings = await getSessionSettings(params.sessionId)
  return Response.json(settings)
}

// PUT /api/session/:sessionId/settings
export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "PUT") {
    return Response.json({ error: "Method not allowed" }, { status: 405 })
  }

  const session = await getSession(params.sessionId)
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 })
  }

  let body: Partial<SettingsConfig>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Validate settings
  const errors: string[] = []

  if ('maxTurns' in body) {
    const maxTurns = body.maxTurns
    if (typeof maxTurns !== 'number' || maxTurns < 1 || maxTurns > 1000) {
      errors.push("maxTurns must be a number between 1 and 1000")
    }
  }

  if ('permissionMode' in body) {
    const mode = body.permissionMode
    if (!mode || !PERMISSION_MODES.includes(mode)) {
      errors.push(`permissionMode must be one of: ${PERMISSION_MODES.join(', ')}`)
    }
  }

  if (errors.length > 0) {
    return Response.json({ error: `Invalid settings: ${errors.join('; ')}` }, { status: 400 })
  }

  // Update session settings
  await updateSessionSettings(params.sessionId, body)

  // Return updated settings
  const updatedSettings = await getSessionSettings(params.sessionId)
  return Response.json(updatedSettings)
}