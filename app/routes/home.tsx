import type { Route } from "./+types/home";
import { Link, Form, redirect } from "react-router";
import { createSession, type SessionWithStats } from "../db/sessions.service";
import { RiFolder3Line, RiTimeLine, RiPulseLine } from "react-icons/ri";
import StatusIndicator from "../components/StatusIndicator";
import MessageCarousel from "../components/MessageCarousel";
import RelativeTime from "../components/RelativeTime";
import clsx from "clsx";
import { useState, type FormEvent } from "react";
import { useHomepageData } from "../hooks/useHomepageData";

export function meta(): Array<{ title?: string; name?: string; content?: string }> {
  return [
    { title: "Memva - Session Manager" },
    { name: "description", content: "Manage your Claude Code sessions efficiently" },
  ];
}

export async function loader() {
  // Initial load doesn't need to fetch all data since React Query will handle it
  return { sessions: [] };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get('title') as string;
  const prompt = formData.get('prompt') as string;
  
  if (!title?.trim()) {
    return { error: 'Title is required' };
  }
  
  if (!prompt?.trim()) {
    return { error: 'Prompt is required' };
  }
  
  // Create session with claude_status set to not_started
  const session = await createSession({
    title: title.trim(),
    project_path: '/Users/mbm-premva/dev/memva', // Auto-assigned for now
    status: 'active',
    metadata: {
      should_auto_start: true
    }
  });
  
  // Update claude_status to processing so pending message shows immediately
  const { updateSessionClaudeStatus } = await import('../db/sessions.service');
  await updateSessionClaudeStatus(session.id, 'processing');
  
  // Create session-runner job
  const { createJob } = await import('../db/jobs.service');
  const { createSessionRunnerJob } = await import('../workers/job-types');
  
  const jobInput = createSessionRunnerJob({
    sessionId: session.id,
    prompt: prompt.trim()
  });
  
  await createJob(jobInput);
  
  return redirect(`/sessions/${session.id}`);
}

function isSessionWithStats(session: SessionWithStats | { id: string }): session is SessionWithStats {
  return 'event_count' in session && typeof session.event_count === 'number';
}

export default function Home() {
  const { sessions } = useHomepageData();
  const [sessionTitle, setSessionTitle] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!sessionTitle.trim()) {
      e.preventDefault();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* New Session Bar */}
        <div className="mb-8">
          <Form 
            method="post" 
            onSubmit={handleSubmit}
            className="p-4 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl"
          >
            <input
              type="text"
              name="title"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Start a new Claude Code session: ask, brainstorm, build"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:bg-zinc-800/70 transition-all duration-200 font-mono text-[0.9375rem]"
            />
            <input type="hidden" name="prompt" value={sessionTitle} />
          </Form>
        </div>

        {/* Sessions Grid */}
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="text-center max-w-md">
              <div className="mb-6 text-zinc-700">
                <RiPulseLine className="w-16 h-16 mx-auto" />
              </div>
              <h2 className="text-xl font-medium text-zinc-300 mb-2">No sessions yet</h2>
              <p className="text-zinc-500">
                Start working with Claude Code to see your sessions here
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className={clsx(
                  "group relative block p-6",
                  "bg-zinc-900/50 backdrop-blur-sm",
                  "border border-zinc-800",
                  "rounded-xl",
                  "hover:bg-zinc-900/70",
                  "hover:border-zinc-700",
                  "hover:shadow-lg hover:shadow-zinc-950/50",
                  "transform hover:scale-[1.02]",
                  "transition-all duration-150",
                  "cursor-pointer",
                  "min-h-[240px]",
                  "grid grid-rows-[1fr_auto_auto_auto_auto]",
                  "gap-4"
                )}
              >
                {/* Status Indicator */}
                <div className="absolute top-4 right-4">
                  <StatusIndicator session={session} />
                </div>

                {/* Title */}
                <h3 className="text-lg font-medium text-zinc-100 pr-20 min-h-[3rem] line-clamp-2">
                  {session.title || "Untitled Session"}
                </h3>

                {/* Project Path */}
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <RiFolder3Line className="w-4 h-4 text-zinc-500" />
                  <span className="font-mono text-xs truncate">
                    {session.project_path}
                  </span>
                </div>

                {/* Last Event Time */}
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <RiTimeLine className="w-4 h-4" />
                  <RelativeTime 
                    timestamp={isSessionWithStats(session) && session.last_event_at
                      ? session.last_event_at
                      : session.updated_at
                    } 
                  />
                </div>

                {/* Event Count */}
                <div className="text-sm text-zinc-400">
                  {(() => {
                    const count = isSessionWithStats(session) ? session.event_count : 0;
                    return `${count} event${count !== 1 ? "s" : ""}`;
                  })()}
                </div>

                {/* Message Carousel */}
                <div className="min-h-[60px]">
                  <MessageCarousel 
                    sessionId={session.id} 
                    latestMessage={session.latestMessage}
                  />
                </div>

                {/* Hover Gradient */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
