import type { LoaderFunctionArgs } from "react-router";
import { getSession } from "../db/sessions.service";
import { getEventsForSession } from "../db/event-session.service";

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const sessionId = params.sessionId;
    
    if (!sessionId) {
      throw new Response("Session ID is required", { status: 400 });
    }
    
    const [session, events] = await Promise.all([
      getSession(sessionId),
      getEventsForSession(sessionId)
    ]);

    if (!session) {
      throw new Response("Session not found", { status: 404 });
    }

    return {
      session,
      events,
      timestamp: Date.now() // For polling detection
    };
  } catch (error) {
    console.error('Error fetching session data:', error);
    throw new Response("Internal server error", { status: 500 });
  }
}