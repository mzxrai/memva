import type { Route } from "./+types/api.session.$sessionId.settings"
import { getSession, updateSessionSettings, getSessionSettings } from "../db/sessions.service"
import type { SettingsConfig } from "../types/settings"

const VALID_PERMISSION_MODES = ['acceptEdits', 'bypassPermissions', 'plan'] as const

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
  } catch (error) {
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
    if (!VALID_PERMISSION_MODES.includes(body.permissionMode as any)) {
      errors.push(`permissionMode must be one of: ${VALID_PERMISSION_MODES.join(', ')}`)
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