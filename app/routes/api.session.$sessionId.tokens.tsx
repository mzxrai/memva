import type { LoaderFunctionArgs } from 'react-router'
import { getSessionTokenStats } from '../db/sessions.service'

export async function loader({ params }: LoaderFunctionArgs) {
  const sessionId = params.sessionId
  
  if (!sessionId) {
    throw new Response('Session ID is required', { status: 400 })
  }
  
  const tokenStats = await getSessionTokenStats(sessionId)
  
  return Response.json({ tokenStats })
}