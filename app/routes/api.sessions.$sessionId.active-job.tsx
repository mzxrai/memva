import type { LoaderFunctionArgs } from "react-router";
import { getActiveJobForSession } from "../db/jobs.service";

export async function loader({ params }: LoaderFunctionArgs) {
  const { sessionId } = params;
  
  if (!sessionId) {
    return Response.json({ error: 'Session ID is required' }, { status: 400 });
  }
  
  try {
    const job = await getActiveJobForSession(sessionId);
    return Response.json({ job });
  } catch (error) {
    console.error('Error fetching active job:', error);
    return Response.json({ job: null });
  }
}