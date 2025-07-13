import type { Route } from "./+types/sessions.$sessionId";
import { useLoaderData } from "react-router";
import { getSession } from "../db/sessions.service";

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.sessionId);
  return { session };
}

export default function SessionDetail() {
  const { session } = useLoaderData<typeof loader>();

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Session not found</h1>
          <p className="text-zinc-400">The requested session could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-zinc-100 mb-2">{session.title || 'Untitled Session'}</h1>
          <div className="text-sm text-zinc-400 space-y-1">
            <p>ID: {session.id}</p>
            <p>Status: {session.status}</p>
            <p>Project Path: {session.project_path}</p>
            <p>Created: {new Date(session.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(session.updated_at).toLocaleString()}</p>
            {session.metadata && (
              <p>Metadata: {typeof session.metadata === 'object' ? JSON.stringify(session.metadata) : session.metadata}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}