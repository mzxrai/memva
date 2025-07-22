import React from "react";
import { Link } from "react-router";
import { RiArrowLeftLine, RiInboxUnarchiveLine, RiFolder3Line } from "react-icons/ri";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { SessionGridSkeleton } from "../components/SessionCardSkeleton";
import { ArchiveButton } from "../components/ArchiveButton";
import { colors, typography } from "../constants/design";

type ArchivedSession = {
  id: string;
  title: string | null;
  status: string;
  project_path: string;
  created_at: string;
  updated_at: string;
  claude_status?: string | null;
  event_count: number;
  last_event_at?: string;
  latest_user_message_at?: string | null;
  latestMessage?: {
    uuid: string;
    timestamp: string;
    data: unknown;
  } | null;
};

export function meta() {
  return [
    { title: "Archived Sessions - Memva" },
    { name: "description", content: "View your archived Claude Code sessions" },
  ];
}

function ArchivedSessionCard({ session }: { session: ArchivedSession }) {
  return (
    <motion.div
      layout
      layoutId={session.id}
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        layout: {
          type: "spring",
          stiffness: 200,
          damping: 20,
        },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 }
      }}
    >
      <Link
        to={`/sessions/${session.id}`}
        className={clsx(
          "group relative block p-6 h-full",
          "bg-zinc-900/50 backdrop-blur-sm",
          "border border-zinc-800",
          "rounded-xl",
          "hover:bg-zinc-900/70",
          "hover:border-zinc-700",
          "hover:shadow-lg hover:shadow-zinc-950/50",
          "transform hover:scale-[1.02]",
          "transition-all duration-150",
          "cursor-pointer",
          "h-[200px]",
          "grid grid-rows-[minmax(3rem,_1fr)_1.5rem_1.5rem_1.5rem]",
          "gap-3"
        )}
      >
        {/* Unarchive Button - Bottom Right */}
        <div className="absolute bottom-2 right-2 z-10">
          <ArchiveButton
            sessionId={session.id}
            sessionStatus="archived"
            variant="compact"
          />
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

        {/* Created Date */}
        <div className="text-sm text-zinc-500">
          Archived {new Date(session.updated_at).toLocaleDateString()}
        </div>

        {/* Event Count */}
        <div className="text-sm text-zinc-400">
          {`${session.event_count} event${session.event_count !== 1 ? "s" : ""}`}
        </div>

        {/* Hover Gradient */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-0" />
      </Link>
    </motion.div>
  );
}

export default function ArchivedSessions() {
  const { data, isLoading } = useQuery({
    queryKey: ['archived-sessions'],
    queryFn: async () => {
      const response = await fetch('/api/sessions/archived');
      if (!response.ok) {
        throw new Error('Failed to fetch archived sessions');
      }
      return response.json() as Promise<{ sessions: ArchivedSession[] }>;
    },
    refetchInterval: 5000, // Refetch every 5 seconds to catch unarchived sessions
  });

  const sessions = data?.sessions || [];

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className={clsx(
              "inline-flex items-center gap-2 mb-4",
              "text-zinc-400 hover:text-zinc-300",
              "transition-colors duration-150"
            )}
          >
            <RiArrowLeftLine className="w-4 h-4" />
            <span className="text-sm">Back to active sessions</span>
          </Link>
          
          <h1 className={clsx(
            typography.size.xl,
            typography.weight.semibold,
            colors.text.primary
          )}>
            Archived Sessions
          </h1>
        </div>

        {/* Sessions Grid */}
        {isLoading ? (
          <SessionGridSkeleton count={6} />
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="text-center max-w-md">
              <div className="mb-6 text-zinc-700">
                <RiInboxUnarchiveLine className="w-16 h-16 mx-auto" />
              </div>
              <h2 className="text-xl font-medium text-zinc-300 mb-2">No archived sessions</h2>
              <p className="text-zinc-500">
                Sessions you archive will appear here
              </p>
            </div>
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            layout
          >
            <AnimatePresence mode="popLayout">
              {sessions.map((session) => (
                <ArchivedSessionCard
                  key={session.id}
                  session={session}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}