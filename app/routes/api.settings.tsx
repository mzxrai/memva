import type { Route } from "./+types/api.settings"
import { getSettings, updateSettings } from "../db/settings.service"

export async function loader() {
  const settings = await getSettings()
  return Response.json(settings)
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "PUT") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const updates = await request.json()
    await updateSettings(updates)
    const newSettings = await getSettings()
    return Response.json(newSettings)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 400 }
    )
  }
}