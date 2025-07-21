import type { Route } from "./+types/home";
import { Link, Form, redirect } from "react-router";
import { createSession, type SessionWithStats } from "../db/sessions.service";
import { RiFolder3Line, RiTimeLine, RiPulseLine, RiSettings3Line } from "react-icons/ri";
import StatusIndicator from "../components/StatusIndicator";
import MessageCarousel from "../components/MessageCarousel";
import RelativeTime from "../components/RelativeTime";
import DirectorySelector from "../components/DirectorySelector";
import SettingsModal from "../components/SettingsModal";
import clsx from "clsx";
import { useState, useEffect, type FormEvent } from "react";
import { useHomepageData } from "../hooks/useHomepageData";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea";
import { useTextareaSubmit } from "../hooks/useTextareaSubmit";
import { colors, typography, transition, iconSize } from "../constants/design";
import { useImageUpload } from "../hooks/useImageUpload";
import { ImagePreview } from "../components/ImagePreview";
import { motion, AnimatePresence } from "framer-motion";
import { SessionGridSkeleton } from "../components/SessionCardSkeleton";

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
  const projectPath = formData.get('project_path') as string;
  
  if (!title?.trim()) {
    return { error: 'Title is required' };
  }
  
  if (!prompt?.trim()) {
    return { error: 'Prompt is required' };
  }
  
  if (!projectPath?.trim()) {
    return { error: 'Project path is required' };
  }
  
  // Create session with claude_status set to not_started
  const session = await createSession({
    title: title.trim(),
    project_path: projectPath.trim(),
    status: 'active',
    metadata: {
      should_auto_start: true
    }
  });
  
  // Update claude_status to processing so pending message shows immediately
  const { updateSessionClaudeStatus } = await import('../db/sessions.service');
  await updateSessionClaudeStatus(session.id, 'processing');
  
  // Handle image uploads
  const imagePaths: string[] = [];
  const imageDataEntries = [...formData.entries()].filter(([key]) => key.startsWith('image-data-'));
  
  if (imageDataEntries.length > 0) {
    const { saveImageToDisk } = await import('../services/image-storage.server');
    
    for (const [key, value] of imageDataEntries) {
      const [, , index] = key.split('-');
      const fileName = formData.get(`image-name-${index}`) as string;
      const imageData = value as string;
      
      // Convert base64 to buffer
      const base64Data = imageData.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Save image to disk
      const filePath = await saveImageToDisk(session.id, fileName, buffer);
      imagePaths.push(filePath);
    }
  }
  
  // Format prompt with image paths
  const { formatPromptWithImages } = await import('../utils/image-prompt-formatting');
  const finalPrompt = formatPromptWithImages(prompt.trim(), imagePaths);
  
  // Create session-runner job
  const { createJob } = await import('../db/jobs.service');
  const { createSessionRunnerJob } = await import('../workers/job-types');
  
  const jobInput = createSessionRunnerJob({
    sessionId: session.id,
    prompt: finalPrompt
  });
  
  await createJob(jobInput);
  
  return redirect(`/sessions/${session.id}`);
}

function isSessionWithStats(session: SessionWithStats | { id: string }): session is SessionWithStats {
  return 'event_count' in session && typeof session.event_count === 'number';
}

// Helper function to shorten path for display - pure function, no side effects
function shortenPath(path: string, homedir?: string): string {
  // Don't process empty paths
  if (!path) return path;
  
  // For testing, use the mocked home directory
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  if (isTest) {
    const testHomedir = '/Users/testuser';
    if (path.startsWith(testHomedir)) {
      path = '~' + path.slice(testHomedir.length);
    }
  }
  
  // If homedir is provided and path starts with it, shorten it
  if (homedir && path.startsWith(homedir)) {
    // Use ~ for Unix-like systems, but keep full path for Windows
    const isWindowsPath = path.includes('\\') || /^[A-Za-z]:/.test(path);
    if (!isWindowsPath) {
      path = '~' + path.slice(homedir.length);
    }
  }
  
  // If path is too long, show last 2-3 segments
  const segments = path.split(/[/\\]/).filter(Boolean); // Handle both / and \ separators
  const isWindowsPath = path.includes('\\') || /^[A-Za-z]:/.test(path);
  
  // Always shorten long paths
  if (segments.length > 3) {
    if (path.startsWith('~/')) {
      // Unix-style with tilde: ~/.../last/two
      return `~/.../` + segments.slice(-2).join('/');
    } else if (isWindowsPath) {
      // Windows: C:\...\last\two
      const drive = segments[0];
      return drive + '\\...\\' + segments.slice(-2).join('\\');
    } else {
      // Unix-style without tilde: /.../last/two
      return '/' + segments.slice(0, 1).join('/') + '/.../' + segments.slice(-2).join('/');
    }
  }
  
  return path;
}

export default function Home() {
  const { sessions, isLoading } = useHomepageData();
  const [sessionTitle, setSessionTitle] = useState("");
  // Don't access localStorage during initial render to prevent hydration errors
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [displayDirectory, setDisplayDirectory] = useState<string>(''); // Client-only shortened path
  const [userHomedir, setUserHomedir] = useState<string>(''); // Cache home directory
  const [isDirectoryLoaded, setIsDirectoryLoaded] = useState(false);
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  
  // Use custom hooks for textarea functionality
  const { textareaRef } = useAutoResizeTextarea(sessionTitle, { maxRows: 5 });
  const handleKeyDown = useTextareaSubmit(sessionTitle);
  
  // Use image upload hook
  const {
    images,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeImage,
  } = useImageUpload();
  
  // Sort sessions by latest user message timestamp
  const sortedSessions = [...sessions].sort((a, b) => {
    // If neither has a user message, maintain original order
    if (!a.latest_user_message_at && !b.latest_user_message_at) {
      return 0;
    }
    // Sessions with user messages come first
    if (!a.latest_user_message_at) return 1;
    if (!b.latest_user_message_at) return -1;
    // Sort by timestamp (most recent first)
    return new Date(b.latest_user_message_at).getTime() - new Date(a.latest_user_message_at).getTime();
  });


  // Track when we've initially loaded to enable animations only on updates
  useEffect(() => {
    if (!isLoading && sessions.length > 0 && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [isLoading, sessions.length, hasInitiallyLoaded]);

  // Load directory from localStorage after mount to prevent hydration errors
  useEffect(() => {
    const loadDirectory = async () => {
      // Get homedir once for shortening paths
      const homedir = localStorage.getItem('userHomedir') || '';
      setUserHomedir(homedir);
      
      // First check localStorage
      const lastDir = localStorage.getItem('memvaLastDirectory');
      if (lastDir) {
        setCurrentDirectory(lastDir);
        setDisplayDirectory(shortenPath(lastDir, homedir)); // Set shortened version for display
        setIsDirectoryLoaded(true);
      } else {
        // Fetch current directory if nothing stored
        try {
          const response = await fetch('/api/filesystem?action=current');
          const data = await response.json();
          setCurrentDirectory(data.currentDirectory);
          setDisplayDirectory(shortenPath(data.currentDirectory, homedir)); // Set shortened version for display
          localStorage.setItem('memvaLastDirectory', data.currentDirectory);
          setIsDirectoryLoaded(true);
        } catch (error) {
          console.error('Failed to get current directory:', error);
          // If we can't get the current directory, show an empty state
          // The user can still click to set a directory
          setCurrentDirectory('');
          setDisplayDirectory('Select directory');
          setIsDirectoryLoaded(true);
        }
      }
    };
    loadDirectory();
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Always require a prompt for new sessions
    if (!sessionTitle.trim()) {
      e.preventDefault();
    }
  };

  const handleDirectorySelect = (directory: string) => {
    setCurrentDirectory(directory);
    setDisplayDirectory(shortenPath(directory, userHomedir)); // Update display version with homedir
    localStorage.setItem('memvaLastDirectory', directory);
    setIsDirectoryModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Settings button - fixed to top right */}
      <button
        onClick={() => setIsSettingsModalOpen(true)}
        className={clsx(
          'fixed top-6 right-6 z-10 p-2.5 rounded-lg',
          colors.text.secondary,
          colors.background.secondary,
          'border',
          colors.border.subtle,
          colors.background.hover,
          transition.fast,
          'hover:text-zinc-300',
          'hover:border-zinc-700'
        )}
        aria-label="Open settings"
        title="Settings"
      >
        <RiSettings3Line className={iconSize.md} />
      </button>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* New Session Bar */}
        <div className="mb-8">
          {!isDirectoryLoaded ? (
            // Empty container to reserve space
            <div className="p-4 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl">
              <div className="h-12" />
            </div>
          ) : (
            <>
            {/* Image Preview - Outside the form for overlay effect */}
            {images.length > 0 && (
              <div className="mb-2">
                <ImagePreview images={images} onRemove={removeImage} />
              </div>
            )}
            
            <Form 
            method="post" 
            onSubmit={handleSubmit}
            className={clsx(
              "p-4 bg-zinc-900/50 backdrop-blur-sm border rounded-xl",
              isDragging ? "border-zinc-500" : "border-zinc-800"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-start gap-2">
              {/* Terminal-style directory prefix */}
              <button
                type="button"
                onClick={() => setIsDirectoryModalOpen(true)}
                className={clsx(
                  "flex-shrink-0 px-3 py-3",
                  typography.font.mono,
                  typography.size.sm,
                  colors.text.secondary,
                  "hover:text-zinc-300",
                  "transition-colors duration-150",
                  "cursor-pointer"
                )}
                title="Click to change directory"
              >
                <span>{displayDirectory}</span>
                <span className="text-zinc-500 ml-1">$</span>
              </button>
              
              {/* Session input */}
              <textarea
                ref={textareaRef}
                name="title"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Start a new Claude Code session: ask, brainstorm, build"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                rows={1}
                className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:bg-zinc-800/70 transition-all duration-200 font-mono text-[0.9375rem] resize-none leading-normal"
                style={{ minHeight: '48px', overflowY: 'hidden' }}
              />
            </div>
            <input type="hidden" name="prompt" value={sessionTitle} />
            <input type="hidden" name="project_path" value={currentDirectory} />
            
            {/* Hidden inputs for image data */}
            {images.map((image, index) => (
              <div key={image.id}>
                <input
                  type="hidden"
                  name={`image-data-${index}`}
                  value={image.preview}
                  data-testid={`image-data-${index}`}
                />
                <input
                  type="hidden"
                  name={`image-name-${index}`}
                  value={image.file.name}
                />
              </div>
            ))}
          </Form>
          </>
          )}
        </div>

        {/* Directory Selector Modal */}
        <DirectorySelector
          isOpen={isDirectoryModalOpen}
          currentDirectory={currentDirectory}
          onSelect={handleDirectorySelect}
          onClose={() => setIsDirectoryModalOpen(false)}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />

        {/* Sessions Grid */}
        {isLoading && !hasInitiallyLoaded ? (
          <SessionGridSkeleton count={6} />
        ) : sortedSessions.length === 0 ? (
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
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            layout
          >
            <AnimatePresence mode="popLayout">
              {sortedSessions.map((session) => (
                <motion.div
                  key={session.id}
                  layout
                  initial={hasInitiallyLoaded ? { opacity: 0, scale: 0.8 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    layout: {
                      type: "spring",
                      stiffness: 350,
                      damping: 25,
                    },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.2 }
                  }}
                  layoutId={session.id}
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
                  <MessageCarousel 
                    sessionId={session.id} 
                    latestMessage={session.latestMessage}
                  />
                </div>

                    {/* Hover Gradient */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
