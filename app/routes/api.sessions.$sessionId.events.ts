import type { LoaderFunctionArgs } from "react-router";
import { z } from "zod";
import { getSession } from "../db/sessions.service";
import { getEventsForSession } from "../db/event-session.service";
import type { Event } from "../db/schema";

// Query parameter schema for type safety
const QuerySchema = z.object({
  since_timestamp: z.string().optional(),
  since_event_id: z.string().optional(),
  include_all: z.string().optional().transform((val) => val === 'true'),
});

// Response schema
interface EventsResponse {
  events: Event[];
  session_status: string | null;
  has_more: boolean;
  latest_event_id: string | null;
  latest_timestamp: string | null;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const sessionId = params.sessionId;
  
  if (!sessionId) {
    throw new Response("Session ID is required", { status: 400 });
  }
  
  // Get session to check if it exists and get status
  const session = await getSession(sessionId);
  
  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }
  
  // Parse query parameters
  const url = new URL(request.url);
  const queryParams = QuerySchema.parse({
    since_timestamp: url.searchParams.get('since_timestamp'),
    since_event_id: url.searchParams.get('since_event_id'), 
    include_all: url.searchParams.get('include_all'),
  });
  
  // Get all events for the session
  let events = await getEventsForSession(sessionId);
  
  // Filter events based on query parameters
  if (!queryParams.include_all) {
    if (queryParams.since_timestamp) {
      const sinceDate = new Date(queryParams.since_timestamp);
      events = events.filter(event => new Date(event.timestamp) > sinceDate);
    } else if (queryParams.since_event_id) {
      // Find the index of the since_event_id
      const sinceIndex = events.findIndex(e => e.uuid === queryParams.since_event_id);
      if (sinceIndex !== -1) {
        // Return only events after this index
        events = events.slice(sinceIndex + 1);
      }
    }
  }
  
  // Sort events by timestamp (oldest first)
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  // Determine if there might be more events (for future pagination)
  const hasMore = false; // For now, we return all matching events
  
  // Get latest event info for the client to track
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  
  const response: EventsResponse = {
    events,
    session_status: session.claude_status,
    has_more: hasMore,
    latest_event_id: latestEvent?.uuid || null,
    latest_timestamp: latestEvent?.timestamp || null,
  };
  
  return Response.json(response);
}