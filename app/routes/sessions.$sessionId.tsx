import type { Route } from "./+types/sessions.$sessionId";
import { useLoaderData } from "react-router";
import { getSession } from "../db/sessions.service";
import { getEventsForSession } from "../db/event-session.service";
import { sendPromptToClaudeCode, type SDKMessage } from "../services/claude-code.service";
import { useState, useRef, useEffect, useCallback, memo } from "react";
import { RiSendPlaneFill, RiStopCircleLine } from "react-icons/ri";

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.sessionId);
  const events = await getEventsForSession(params.sessionId);
  return { session, events };
}

// Memoized message component to prevent re-renders and preserve text selection
const MessageItem = memo(({ message }: { message: any }) => {
  return (
    <div className="px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-4">
          <pre className="bg-zinc-800 p-4 rounded-lg text-zinc-100 font-mono text-xs overflow-x-auto">
            {JSON.stringify(message, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

// Helper function to generate stable keys for message components
const getMessageKey = (message: any, index: number): string => {
  if (message.uuid) {
    return message.uuid;
  }
  // Fallback to stable identifier based on content and timestamp
  if (message.timestamp && message.type) {
    return `${message.type}-${message.timestamp}-${index}`;
  }
  // Last resort fallback
  return `message-${index}-${JSON.stringify(message).slice(0, 50)}`;
};

export default function SessionDetail() {
  const { session, events = [] } = useLoaderData<typeof loader>();
  
  // Initialize messages with historical events (reverse to show oldest-to-newest in DOM for proper chat order)
  const initialMessages = events.map(event => ({
    ...(typeof event.data === 'object' ? event.data : {}),
    uuid: event.uuid,
    memva_session_id: event.memva_session_id || undefined
  })).reverse()
  
  // Debug logging for event ordering
  if (events.length > 0) {
    console.log('[SessionDetail] Loaded events:', {
      count: events.length,
      firstEvent: { uuid: events[0].uuid, timestamp: events[0].timestamp },
      lastEvent: { uuid: events[events.length - 1].uuid, timestamp: events[events.length - 1].timestamp }
    })
  }
  
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Refs for chat behavior
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [contentOverflows, setContentOverflows] = useState(false);
  const isInitialHistoryLoad = initialMessages.length > 0; // Has existing history

  // Intelligent auto-scroll state
  const [autoScrollDisabled, setAutoScrollDisabled] = useState(false);
  const [isProgrammaticScroll, setIsProgrammaticScroll] = useState(false);
  const lastScrollTop = useRef(0);
  const SCROLL_THRESHOLD = 50; // Only disable auto-scroll if user scrolls up more than 50px

  // Check if content overflows container
  const checkContentOverflow = useCallback(() => {
    // Don't change layout while user might be selecting text during streaming
    if (isLoading) return;
    
    const container = messagesContainerRef.current;
    const messagesList = messagesListRef.current;
    
    if (container && messagesList) {
      const containerHeight = container.clientHeight;
      const contentHeight = messagesList.scrollHeight;
      setContentOverflows(contentHeight > containerHeight);
    }
  }, [isLoading]);

  // Check overflow when messages change
  useEffect(() => {
    // Use timeout to ensure DOM has updated
    const timeoutId = setTimeout(checkContentOverflow, 0);
    return () => clearTimeout(timeoutId);
  }, [messages, checkContentOverflow]);

  // Auto-scroll logic (respects user intent to review history)
  useEffect(() => {
    const container = messagesContainerRef.current;
    // RESPECT THE USER: Don't auto-scroll if they've indicated they want to review history
    if (!container || autoScrollDisabled) return;

    const currentMessageCount = messages.length;
    const previousCount = previousMessageCountRef.current;
    const hasNewMessages = currentMessageCount > previousCount;

    const performScroll = (behavior: 'auto' | 'smooth' = 'auto') => {
      // Mark this as programmatic scroll to avoid triggering user scroll detection
      setIsProgrammaticScroll(true);
      
      if (behavior === 'smooth') {
        container.scrollTo({ 
          top: container.scrollHeight, 
          behavior: 'smooth' 
        });
      } else {
        container.scrollTop = container.scrollHeight;
      }
      
      // Reset programmatic scroll flag after a short delay
      setTimeout(() => setIsProgrammaticScroll(false), 100);
    };

    if (previousCount === 0 && currentMessageCount > 0 && isInitialHistoryLoad) {
      // Loading existing history: ALWAYS scroll to bottom to show newest message
      setTimeout(() => performScroll('auto'), 0);
    } else if (hasNewMessages && previousCount > 0) {
      // New messages streaming in: scroll to show them
      performScroll('smooth');
    }
    // For fresh sessions (no initial history), first message naturally appears at top via justify-start

    previousMessageCountRef.current = currentMessageCount;
  }, [messages, isInitialHistoryLoad, contentOverflows, autoScrollDisabled]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) {
        handleStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]);

  // Helper function to check if user has active text selection
  const hasActiveTextSelection = useCallback(() => {
    const selection = window.getSelection();
    return selection && selection.toString().length > 0;
  }, []);

  // Auto-focus input when streaming completes (but preserve text selection)
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      // Small delay to ensure DOM updates are complete
      setTimeout(() => {
        // Only auto-focus if user doesn't have text selected
        if (!hasActiveTextSelection()) {
          inputRef.current?.focus();
        }
      }, 100);
    }
  }, [isLoading, hasActiveTextSelection]);

  // Detect user scrolling up during streaming to disable auto-scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const scrollDistance = lastScrollTop.current - currentScrollTop;
      const isScrollingUp = scrollDistance > 0;
      
      // Only disable auto-scroll if:
      // 1. We're currently streaming messages
      // 2. User scrolled UP more than threshold
      // 3. This isn't a programmatic scroll we triggered
      if (isLoading && isScrollingUp && scrollDistance > SCROLL_THRESHOLD && !isProgrammaticScroll) {
        console.log('👤 User scrolled up during streaming - disabling auto-scroll');
        setAutoScrollDisabled(true);
      }
      
      lastScrollTop.current = currentScrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoading, isProgrammaticScroll, SCROLL_THRESHOLD]);

  // Track if we've already auto-started to prevent duplicates
  const hasAutoStartedRef = useRef(false);

  // Auto-start conversation for new sessions from homepage
  useEffect(() => {
    // New session from homepage: explicitly marked for auto-start + not already started
    if (session?.metadata?.should_auto_start && !hasAutoStartedRef.current) {
      console.log('🚀 Auto-starting conversation with session title:', session.title);
      
      // Reset auto-scroll for auto-started session
      if (autoScrollDisabled) {
        console.log('🔄 Auto-start triggered - resetting auto-scroll');
        setAutoScrollDisabled(false);
      }
      
      hasAutoStartedRef.current = true;
      setIsLoading(true);
      abortControllerRef.current = new AbortController();
      
      // Call Claude Code directly with session title (no form simulation needed)
      sendPromptToClaudeCode({
        prompt: session.title,
        sessionId: session.id,
        onMessage: (message) => {
          console.log('[SessionDetail] New message received:', {
            type: message.type,
            uuid: message.uuid,
            timestamp: message.timestamp || new Date().toISOString()
          });
          
          // Add the message to the end (newest at bottom)
          setMessages(prev => [...prev, message]);
          
          // Stop loading when we get the result message
          if (message.type === 'result') {
            setIsLoading(false);
          }
        },
        onError: (error) => {
          console.error('Error sending prompt to Claude Code:', error);
          setMessages(prev => [...prev, {
            type: 'error',
            content: `Error: ${error.message}`,
            timestamp: new Date().toISOString()
          }]);
          setIsLoading(false);
        },
        signal: abortControllerRef.current.signal
      });
    }
  }, [session?.metadata?.should_auto_start]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim() || isLoading) return;

    const userPrompt = prompt.trim();
    console.log(`[Client] Submitting prompt: "${userPrompt}" for session ${session.id}`);
    
    // Reset auto-scroll for new prompt session
    if (autoScrollDisabled) {
      console.log('🔄 New prompt submitted - resetting auto-scroll');
      setAutoScrollDisabled(false);
    }
    
    setPrompt("");
    setIsLoading(true);

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    sendPromptToClaudeCode({
      prompt: userPrompt,
      sessionId: session.id,
      onMessage: (message) => {
        console.log('[SessionDetail] New message received:', {
          type: message.type,
          uuid: message.uuid,
          timestamp: message.timestamp || new Date().toISOString()
        });
        
        // Add the message to the end (newest at bottom)
        setMessages(prev => [...prev, message]);
        
        // Stop loading when we get the result message
        if (message.type === 'result') {
          setIsLoading(false);
        }
      },
      onError: (error) => {
        console.error('Error sending prompt to Claude Code:', error);
        setMessages(prev => [...prev, {
          type: 'error',
          content: `Error: ${error.message}`,
          timestamp: new Date().toISOString()
        }]);
        setIsLoading(false);
      },
      signal: abortControllerRef.current.signal
    });
  };

  const handleStop = () => {
    const stopClickTime = new Date().toISOString();
    console.log(`[Client] Stop button clicked at ${stopClickTime}`);
    if (abortControllerRef.current) {
      console.log('[Client] Aborting fetch request');
      // This will abort the fetch, triggering the cancel() method on the server
      abortControllerRef.current.abort();
      setIsLoading(false);
      console.log('[Client] Fetch aborted, loading state set to false');
    }
  };

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Fixed header */}
      <div className="px-4 py-6 border-b border-zinc-800">
        <div className="container mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold text-zinc-100 mb-2">{session.title || 'Untitled Session'}</h1>
          <div className="text-sm text-zinc-400">
            <span>Project: {session.project_path}</span>
            <span className="mx-2">•</span>
            <span>Status: {session.status}</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
        style={{ height: '100%' }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-500">No messages yet. Start by asking Claude Code something!</p>
          </div>
        ) : (
          <div 
            ref={messagesListRef}
            className={contentOverflows 
              ? "min-h-full flex flex-col justify-end pb-32"     // Overflow: bottom-anchored (newest at bottom)
              : "min-h-full flex flex-col justify-start pb-32"   // Fits: top-anchored (start from top)
            }>
            {messages.map((message, index) => (
              <MessageItem
                key={getMessageKey(message, index)}
                message={message}
              />
            ))}
          </div>
        )}
      </div>

      {/* Progressive blur gradient overlay */}
      <div className="fixed bottom-0 left-0 right-0 h-48 pointer-events-none z-20">
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent"></div>
        <div className="absolute inset-0 backdrop-blur-gradient"></div>
      </div>

      {/* Floating input form */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 z-30">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800/50 p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask Claude Code anything..."
                disabled={isLoading}
                className="flex-1 px-5 py-3.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:bg-zinc-800/80 transition-all duration-200 disabled:opacity-50"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-6 py-3.5 bg-red-900/90 hover:bg-red-800/90 text-zinc-100 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:bg-red-800/90 flex items-center gap-2 shadow-lg"
                  title="Press Escape to stop"
                >
                  <RiStopCircleLine className="w-5 h-5" />
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="px-6 py-3.5 bg-zinc-700/90 hover:bg-zinc-600/90 text-zinc-100 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:bg-zinc-600/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                >
                  <RiSendPlaneFill className="w-5 h-5" />
                  Send
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}