import type { Route } from "./+types/home";
import { redirect, Link, useFetcher } from "react-router";
import { createSession } from "../db/sessions.service";
import { RiSettings3Line } from "react-icons/ri";
import DirectorySelector from "../components/DirectorySelector";
import SettingsModal from "../components/SettingsModal";
import SessionCard from "../components/SessionCard";
import clsx from "clsx";
import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import { useHomepageData } from "../hooks/useHomepageData";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea";
import { useTextareaSubmit } from "../hooks/useTextareaSubmit";
import { colors, typography, transition, iconSize } from "../constants/design";
import { useImageUpload } from "../hooks/useImageUpload";
import { ImagePreview } from "../components/ImagePreview";
import { AnimatePresence, motion } from "framer-motion";
import { SessionGridSkeleton } from "../components/SessionCardSkeleton";
import { useQueryClient } from "@tanstack/react-query";

export function meta(): Array<{ title?: string; name?: string; content?: string }> {
  return [
    { title: "Memva | Session manager" },
    { name: "description", content: "Manage your agent sessions efficiently" },
  ];
}

export async function loader() {
  // Initial load doesn't need to fetch all data since React Query will handle it
  return { sessions: [] };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get('title') as string;
  const prompt = formData.get('prompt') as string || title;
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
  
  // Store user message as an event
  const { storeEvent, createEventFromMessage } = await import('../db/events.service');
  
  const userEvent = createEventFromMessage({
    message: {
      type: 'user',
      content: finalPrompt,
      session_id: '' // Will be populated by Claude Code SDK
    },
    memvaSessionId: session.id,
    projectPath: projectPath.trim(),
    parentUuid: null,
    timestamp: new Date().toISOString()
  });
  
  await storeEvent(userEvent);
  
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
  const queryClient = useQueryClient();
  const fetcher = useFetcher();
  const { sessions, isLoading, archivedCount } = useHomepageData();
  const [sessionTitle, setSessionTitle] = useState("");
  // Don't access localStorage during initial render to prevent hydration errors
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [displayDirectory, setDisplayDirectory] = useState<string>(''); // Client-only shortened path
  const [userHomedir, setUserHomedir] = useState<string>(''); // Cache home directory
  const [isDirectoryLoaded, setIsDirectoryLoaded] = useState(false);
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Use custom hooks for textarea functionality
  const { textareaRef } = useAutoResizeTextarea(sessionTitle, { maxRows: 5 });
  
  // Use image upload hook
  const {
    images,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeImage,
  } = useImageUpload();
  
  // Track previous sort order to detect reordering
  const previousOrderRef = useRef<string[]>([]);
  const [orderChanged, setOrderChanged] = useState(false);
  
  // Memoize sorted sessions to prevent unnecessary re-sorts
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
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
  }, [sessions]);
  
  // Detect if order has changed - only in effect to avoid recalc on every render
  useEffect(() => {
    const currentOrder = sortedSessions.map(s => s.id);
    const hasOrderChanged = previousOrderRef.current.length > 0 && 
      JSON.stringify(previousOrderRef.current) !== JSON.stringify(currentOrder);
    
    if (hasOrderChanged) {
      setOrderChanged(true);
      // Reset after animation completes
      setTimeout(() => setOrderChanged(false), 800);
    }
    
    previousOrderRef.current = currentOrder;
  }, [sortedSessions]);

  // Invalidate query on mount to get fresh data immediately
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['homepage-sessions'] });
  }, [queryClient]);


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

  const handleProgrammaticSubmit = async () => {
    if (!sessionTitle.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // For large prompts, use direct API call to bypass React Router overhead
      const promptSize = new Blob([sessionTitle]).size;
      const isLargePrompt = promptSize > 50000; // 50KB threshold
      
      if (isLargePrompt) {
        // Use direct fetch API for large prompts
        const formData = new FormData();
        formData.set('title', sessionTitle);
        formData.set('prompt', sessionTitle);
        formData.set('project_path', currentDirectory);
        
        // Add image data
        images.forEach((image, index) => {
          formData.set(`image-data-${index}`, image.preview);
          formData.set(`image-name-${index}`, image.file.name);
        });
        
        const response = await fetch('/api/sessions', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Navigate immediately using window.location for instant redirect
          window.location.href = result.redirectUrl;
        } else {
          console.error('Session creation error:', result.error);
          setIsSubmitting(false);
        }
      } else {
        // Normal flow for smaller prompts using React Router
        const formData = new FormData();
        formData.set('title', sessionTitle);
        formData.set('prompt', sessionTitle);
        formData.set('project_path', currentDirectory);
        
        // Add image data
        images.forEach((image, index) => {
          formData.set(`image-data-${index}`, image.preview);
          formData.set(`image-name-${index}`, image.file.name);
        });
        
        fetcher.submit(formData, { method: 'post' });
      }
    } catch (error) {
      console.error('Session creation error:', error);
      setIsSubmitting(false);
    }
  };
  
  // Effect to handle redirect after successful submission
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && !fetcher.data.error) {
      // Action returned successfully, navigate was handled by the action
      setIsSubmitting(false);
    } else if (fetcher.state === 'idle' && fetcher.data?.error) {
      // Handle error
      setIsSubmitting(false);
      console.error('Session creation error:', fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);
  
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleProgrammaticSubmit();
  };
  
  // Define handleKeyDown after handleProgrammaticSubmit is available
  const handleKeyDown = useTextareaSubmit(sessionTitle, handleProgrammaticSubmit);

  const handleDirectorySelect = (directory: string) => {
    setCurrentDirectory(directory);
    setDisplayDirectory(shortenPath(directory, userHomedir)); // Update display version with homedir
    localStorage.setItem('memvaLastDirectory', directory);
    setIsDirectoryModalOpen(false);
  };

  const hasNoSessions = sortedSessions.length === 0;
  // Only center AFTER we've loaded data and confirmed no sessions
  const shouldCenter = hasNoSessions && !isLoading;

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

      <div className={clsx(
        shouldCenter ? "flex items-center justify-center min-h-screen pb-20" : "container mx-auto px-4 py-8 max-w-7xl"
      )}>
        <div className={shouldCenter ? "w-full max-w-5xl mx-auto px-4" : "w-full"}>
          {/* New Session Bar */}
          <div className={shouldCenter ? "" : "mb-8"}>
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
            
            <form 
            onSubmit={handleSubmit}
            className={clsx(
              "p-4 bg-zinc-900/50 backdrop-blur-sm border rounded-xl",
              isDragging ? "border-zinc-500" : "border-zinc-800",
              isSubmitting && "opacity-50 pointer-events-none"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-start gap-2">
              {/* Terminal-style directory prefix */}
              <div className="relative group">
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
                
                {/* Tooltip for empty state */}
                {shouldCenter && sessionTitle.trim() === '' && (
                  <div className={clsx(
                    "absolute -top-6 left-2",
                    "px-3 py-1.5",
                    "bg-zinc-900/90 backdrop-blur-sm",
                    "border border-zinc-800",
                    "rounded-lg",
                    "text-zinc-500",
                    typography.size.xs,
                    "whitespace-nowrap",
                    "pointer-events-none",
                    "animate-bounce-light",
                    "shadow-sm"
                  )}>
                    Select your working directory
                    {/* Arrow using pseudo-element style */}
                    <div className={clsx(
                      "absolute -bottom-[5px] left-4",
                      "w-2 h-2",
                      "bg-zinc-900/90",
                      "border-r border-b border-zinc-800",
                      "transform rotate-45"
                    )} />
                  </div>
                )}
              </div>
              
              {/* Session input */}
              <textarea
                ref={textareaRef}
                name="title"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Start a new session: ask, brainstorm, build"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                autoFocus
                disabled={isSubmitting}
                rows={1}
                className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:bg-zinc-800/70 transition-all duration-200 font-mono text-[0.9375rem] resize-none leading-normal disabled:opacity-50"
                style={{ minHeight: '48px', overflowY: 'hidden' }}
              />
            </div>
          </form>
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
        {!hasNoSessions && (
          isLoading ? (
            <SessionGridSkeleton count={6} />
          ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            layout
          >
            <AnimatePresence mode="popLayout">
              {sortedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  enableLayoutAnimation={orderChanged}
                />
              ))}
            </AnimatePresence>
          </motion.div>
          )
        )}
        
          {/* View Archived Link */}
          {archivedCount > 0 && (
            <div className={clsx(
              shouldCenter ? "mt-6 text-center" : "mt-6"
            )}>
              <Link
                to="/archived"
                className={clsx(
                  "text-sm text-zinc-500 hover:text-zinc-400",
                  "transition-colors duration-150"
                )}
              >
                View archived sessions
              </Link>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 text-center">
        <div className="flex flex-col items-center gap-2">
          {/* Dancing Dog Animation */}
          <div className="relative w-16 h-16 animate-bounce">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full"
              style={{
                animation: 'wiggle 2s ease-in-out infinite'
              }}
            >
              {/* Dog body */}
              <ellipse cx="50" cy="65" rx="25" ry="20" fill="white" stroke="#e5e5e5" strokeWidth="1"/>
              {/* Dog head */}
              <circle cx="50" cy="35" r="18" fill="white" stroke="#e5e5e5" strokeWidth="1"/>
              {/* Ears */}
              <ellipse cx="35" cy="30" rx="8" ry="12" fill="white" stroke="#e5e5e5" strokeWidth="1" transform="rotate(-30 35 30)"/>
              <ellipse cx="65" cy="30" rx="8" ry="12" fill="white" stroke="#e5e5e5" strokeWidth="1" transform="rotate(30 65 30)"/>
              {/* Eyes */}
              <circle cx="43" cy="35" r="2" fill="#333"/>
              <circle cx="57" cy="35" r="2" fill="#333"/>
              {/* Nose */}
              <ellipse cx="50" cy="40" rx="3" ry="2" fill="#333"/>
              {/* Tail wagging */}
              <path 
                d="M 70 60 Q 85 50 80 40" 
                fill="none" 
                stroke="white" 
                strokeWidth="6" 
                strokeLinecap="round" 
                style={{
                  transformOrigin: '70px 60px',
                  animation: 'wag 0.5s ease-in-out infinite'
                }}
              />
              <path 
                d="M 70 60 Q 85 50 80 40" 
                fill="none" 
                stroke="#e5e5e5" 
                strokeWidth="4" 
                strokeLinecap="round"
                style={{
                  transformOrigin: '70px 60px',
                  animation: 'wag 0.5s ease-in-out infinite'
                }}
              />
              {/* Legs */}
              <rect x="38" y="75" width="6" height="10" rx="3" fill="white" stroke="#e5e5e5" strokeWidth="1"/>
              <rect x="56" y="75" width="6" height="10" rx="3" fill="white" stroke="#e5e5e5" strokeWidth="1"/>
              {/* Front paws */}
              <rect 
                x="35" 
                y="58" 
                width="5" 
                height="8" 
                rx="2.5" 
                fill="white" 
                stroke="#e5e5e5" 
                strokeWidth="1"
                style={{
                  transformOrigin: '37.5px 62px',
                  animation: 'pawLeft 1s ease-in-out infinite'
                }}
              />
              <rect 
                x="60" 
                y="58" 
                width="5" 
                height="8" 
                rx="2.5" 
                fill="white" 
                stroke="#e5e5e5" 
                strokeWidth="1"
                style={{
                  transformOrigin: '62.5px 62px',
                  animation: 'pawRight 1s ease-in-out infinite'
                }}
              />
            </svg>
          </div>
          <p className="text-red-500 text-sm">I love Caitlin!</p>
        </div>
        
        <style>{`
          @keyframes wiggle {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(5deg); }
          }
          @keyframes wag {
            0%, 100% { transform: rotate(-20deg); }
            50% { transform: rotate(20deg); }
          }
          @keyframes pawLeft {
            0%, 100% { transform: rotate(-10deg); }
            50% { transform: rotate(10deg) translateY(-3px); }
          }
          @keyframes pawRight {
            0%, 100% { transform: rotate(10deg); }
            50% { transform: rotate(-10deg) translateY(-3px); }
          }
        `}</style>
      </footer>
    </div>
  );
}
