import type { Route } from "./+types/sessions.$sessionId";
import { useParams, Form } from "react-router";
import { useSessionStatus } from "../hooks/useSessionStatus";
import { useEventPolling } from "../hooks/useEventPolling";
import { useState } from "react";
import { RiSendPlaneFill, RiFolder3Line } from "react-icons/ri";
import { EventRenderer } from "../components/events/EventRenderer";
import { getSession } from "../db/sessions.service";
import { getEventsForSession } from "../db/event-session.service";

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.sessionId);
  const events = await getEventsForSession(params.sessionId);
  return { session, events };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const prompt = formData.get('prompt') as string;
  
  if (!prompt?.trim()) {
    return { error: 'Prompt is required' };
  }

  // Update session status to processing
  const { updateSession } = await import('../db/sessions.service');
  await updateSession(params.sessionId, { status: 'active' });

  // Update claude_status to processing
  const { updateSessionClaudeStatus } = await import('../db/sessions.service');
  await updateSessionClaudeStatus(params.sessionId, 'processing');

  // Create session-runner job
  const { createJob } = await import('../db/jobs.service');
  const { createSessionRunnerJob } = await import('../workers/job-types');
  
  const jobInput = createSessionRunnerJob({
    sessionId: params.sessionId,
    prompt: prompt.trim()
  });
  
  await createJob(jobInput);
  
  return { success: true };
}

// The EventRenderer component is already memoized and handles all event types

export default function SessionDetail() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  
  // Use hooks for polling session status and events
  const { session } = useSessionStatus(sessionId);
  const { events } = useEventPolling(sessionId);
  
  const [prompt, setPrompt] = useState(""); 

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

  // Determine UI state based on claude_status
  const isProcessing = session.claude_status === 'processing';
  const hasError = session.claude_status === 'error';

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Fixed header */}
      <div className="px-4 py-6 border-b border-zinc-800">
        <div className="container mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold text-zinc-100 mb-2">{session.title || 'Untitled Session'}</h1>
          <div className="text-sm text-zinc-400 flex items-center">
            <span className="flex items-center gap-1.5">
              <RiFolder3Line className="w-4 h-4 text-zinc-500" />
              <span className="font-mono">{session.project_path}</span>
            </span>
            <span className="mx-2">•</span>
            <span className="capitalize">{session.status}</span>
          </div>
        </div>
      </div>

      {/* Error message for error status */}
      {hasError && (
        <div className="px-4 py-3 bg-red-900/20 border-b border-red-800/30">
          <div className="container mx-auto max-w-7xl">
            <p className="text-red-400">An error occurred while processing your request. Please try again.</p>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {events.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-500">No messages yet. Start by asking Claude Code something!</p>
          </div>
        ) : (
          <div className="min-h-full flex flex-col justify-start pt-6 pb-32">
            {events.map((event) => (
              <EventRenderer
                key={event.uuid}
                event={event.data as Record<string, unknown>}
                toolResults={new Map()}
                isStreaming={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating input form */}
      <div className="fixed bottom-0 left-0 right-0 pb-7 z-30">
        <div className="px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="relative">
              <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800/50 p-4">
                <Form method="post" className="flex gap-3">
                  <div className="flex-1 flex items-center px-5 py-3.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl focus-within:border-zinc-600 focus-within:bg-zinc-800/80 transition-all duration-200">
                    <span className="text-zinc-500 font-mono mr-4 select-none">{'>'}</span>
                    <input
                      name="prompt"
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isProcessing}
                      className="flex-1 bg-transparent text-zinc-100 focus:outline-none disabled:opacity-50 font-mono text-[0.9375rem]"
                      role="textbox"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!prompt.trim() || isProcessing}
                    className="px-6 py-3.5 bg-zinc-700/90 hover:bg-zinc-600/90 text-zinc-100 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:bg-zinc-600/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg font-mono text-[0.9375rem]"
                  >
                    <RiSendPlaneFill className="w-5 h-5" />
                    Send
                  </button>
                </Form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}