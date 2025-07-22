import React, { memo } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { RiFolder3Line, RiTimeLine } from 'react-icons/ri'
import clsx from 'clsx'
import StatusIndicator from './StatusIndicator'
import MessageCarousel from './MessageCarousel'
import RelativeTime from './RelativeTime'
import { ArchiveButton } from './ArchiveButton'
import type { SessionWithStats } from '../db/sessions.service'

type EnhancedSession = SessionWithStats & {
  latest_user_message_at?: string | null
  pendingPermissionsCount?: number
  latestMessage?: {
    uuid: string
    timestamp: string
    data: unknown
  } | null
}

interface SessionCardProps {
  session: EnhancedSession
  enableLayoutAnimation?: boolean
}

function isSessionWithStats(session: EnhancedSession | { id: string }): session is EnhancedSession {
  return 'event_count' in session && typeof session.event_count === 'number'
}

const SessionCard = memo(function SessionCard({ session, enableLayoutAnimation = false }: SessionCardProps) {
  return (
    <motion.div
      layout={enableLayoutAnimation}
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
          "h-[280px]",
          "grid grid-rows-[minmax(3rem,_1fr)_1.5rem_1.5rem_1.5rem_4rem]",
          "gap-3"
        )}
      >
        {/* Status Indicator */}
        <div className="absolute top-4 right-4">
          <StatusIndicator session={session} />
        </div>
        
        {/* Archive Button - Bottom Right */}
        <div className="absolute bottom-2 right-2 z-10">
          <ArchiveButton
            sessionId={session.id}
            sessionStatus={session.status as 'active' | 'archived'}
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

        {/* Message Carousel - fixed height to prevent layout shift */}
        <div className="h-16">
          {session.status === 'active' && (
            <MessageCarousel 
              sessionId={session.id} 
              latestMessage={session.latestMessage}
            />
          )}
        </div>

        {/* Hover Gradient */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-0" />
      </Link>
    </motion.div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Only re-render if relevant data changed
  const areEqual = (
    prevProps.session.id === nextProps.session.id &&
    prevProps.session.title === nextProps.session.title &&
    prevProps.session.status === nextProps.session.status &&
    prevProps.session.claude_status === nextProps.session.claude_status &&
    prevProps.session.event_count === nextProps.session.event_count &&
    prevProps.session.last_event_at === nextProps.session.last_event_at &&
    prevProps.session.latest_user_message_at === nextProps.session.latest_user_message_at &&
    prevProps.session.pendingPermissionsCount === nextProps.session.pendingPermissionsCount &&
    prevProps.session.latestMessage?.uuid === nextProps.session.latestMessage?.uuid &&
    prevProps.session.latestMessage?.timestamp === nextProps.session.latestMessage?.timestamp &&
    prevProps.enableLayoutAnimation === nextProps.enableLayoutAnimation
  );
  
  return areEqual;
})

export default SessionCard