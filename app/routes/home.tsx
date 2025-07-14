import type { Route } from "./+types/home";
import { Link, useLoaderData, Form, redirect } from "react-router";
import { listSessions, getSessionWithStats, createSession, type SessionWithStats } from "../db/sessions.service";
import { formatDistanceToNow } from "date-fns";
import { RiFolder3Line, RiTimeLine, RiPulseLine, RiArchiveLine } from "react-icons/ri";
import clsx from "clsx";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Memva - Session Manager" },
    { name: "description", content: "Manage your Claude Code sessions efficiently" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const sessions = await listSessions();
  console.log(`Loaded ${sessions.length} sessions from database`);
  
  // Get stats for each session
  const sessionsWithStats = await Promise.all(
    sessions.map(async (session) => {
      const stats = await getSessionWithStats(session.id);
      return stats || session;
    })
  );

  console.log('Sessions with stats:', sessionsWithStats.length);
  return { sessions: sessionsWithStats };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get('title') as string;
  
  if (!title?.trim()) {
    return { error: 'Title is required' };
  }
  
  const session = await createSession({
    title: title.trim(),
    project_path: '/Users/mbm-premva/dev/memva', // Auto-assigned for now
    status: 'active',
    metadata: {
      should_auto_start: true
    }
  });
  
  return redirect(`/sessions/${session.id}`);
}

function isSessionWithStats(session: any): session is SessionWithStats {
  return typeof session.event_count === 'number';
}

export default function Home() {
  const { sessions } = useLoaderData<typeof loader>();
  const [sessionTitle, setSessionTitle] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!sessionTitle.trim()) {
      e.preventDefault();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-zinc-100 mb-2">Sessions</h1>
        </div>

        {/* New Session Bar */}
        <div className="mb-8">
          <Form 
            method="post" 
            onSubmit={handleSubmit}
            className="flex gap-3 p-4 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl"
          >
            <input
              type="text"
              name="title"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Start a new Claude Code session"
              className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:bg-zinc-800/70 transition-all duration-200"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium rounded-lg transition-colors focus:outline-none focus:bg-zinc-700"
            >
              Start
            </button>
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
                  "cursor-pointer"
                )}
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  {session.status === "active" ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-500">Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <RiArchiveLine className="w-3 h-3" />
                      <span>Archived</span>
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-lg font-medium text-zinc-100 mb-3 pr-20">
                  {session.title || "Untitled Session"}
                </h3>

                {/* Project Path */}
                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-4">
                  <RiFolder3Line className="w-4 h-4 text-zinc-500" />
                  <span className="font-mono text-xs truncate">
                    {session.project_path}
                  </span>
                </div>

                {/* Created Date */}
                <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
                  <RiTimeLine className="w-4 h-4" />
                  <span>
                    {formatDistanceToNow(new Date(session.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                {/* Event Stats */}
                {isSessionWithStats(session) && (
                  <div className="space-y-3">
                    {/* Event Count and Duration */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">
                        {session.event_count} event{session.event_count !== 1 ? "s" : ""}
                      </span>
                      <span className="text-zinc-500">
                        {session.duration_minutes} min
                      </span>
                    </div>

                    {/* Event Type Pills */}
                    {Object.keys(session.event_types).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(session.event_types).map(([type, count]) => (
                          <span
                            key={type}
                            className={clsx(
                              "px-2 py-1 text-xs rounded-full",
                              "border",
                              type === "user" && "bg-blue-500/10 border-blue-500/30 text-blue-400",
                              type === "assistant" && "bg-purple-500/10 border-purple-500/30 text-purple-400",
                              type === "summary" && "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            )}
                          >
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
