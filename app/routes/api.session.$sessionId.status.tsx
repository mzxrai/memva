import type { ActionFunctionArgs } from "react-router";
import { updateSession, getSession } from "../db/sessions.service";

export async function action({ request, params }: ActionFunctionArgs) {
  const { sessionId } = params;
  
  if (!sessionId) {
    return Response.json({ error: "Session ID is required" }, { status: 400 });
  }
  
  if (request.method !== "PATCH") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  
  try {
    const data = await request.json();
    const { status } = data;
    
    if (!status || !["active", "archived"].includes(status)) {
      return Response.json({ error: "Invalid status. Must be 'active' or 'archived'" }, { status: 400 });
    }
    
    // Check if session exists
    const existingSession = await getSession(sessionId);
    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }
    
    // Update session status
    const updatedSession = await updateSession(sessionId, { status });
    
    return Response.json({ session: updatedSession });
  } catch (error) {
    console.error('Error updating session status:', error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}