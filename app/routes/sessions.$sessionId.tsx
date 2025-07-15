import type { Route } from "./+types/sessions.$sessionId";
import { useLoaderData } from "react-router";
import { getSession } from "../db/sessions.service";
import { getEventsForSession } from "../db/event-session.service";
import { sendPromptToClaudeCode } from "../services/claude-code.service";
import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { RiSendPlaneFill, RiStopCircleLine } from "react-icons/ri";
import { EventRenderer } from "../components/events/EventRenderer";
import { LoadingIndicator } from "../components/LoadingIndicator";

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.sessionId);
  const events = await getEventsForSession(params.sessionId);
  return { session, events };
}

// The EventRenderer component is already memoized and handles all event types

// Helper function to generate stable keys for message components
const getMessageKey = (message: Record<string, unknown>, index: number): string => {
  if (message.uuid && typeof message.uuid === 'string') {
    return message.uuid;
  }
  // Fallback to stable identifier based on content and timestamp
  if (message.timestamp && message.type && typeof message.timestamp === 'string' && typeof message.type === 'string') {
    return `${message.type}-${message.timestamp}-${index}`;
  }
  // Last resort fallback
  return `message-${index}-${JSON.stringify(message).slice(0, 50)}`;
};

// Helper function to check if a message is a tool result
const isToolResultMessage = (message: Record<string, unknown>): boolean => {
  if (message.type !== 'user') return false;
  
  // Check if message content contains tool_result
  if (message.message && typeof message.message === 'object' && 'content' in message.message) {
    const content = (message.message as { content: unknown }).content;
    if (Array.isArray(content) && content.length > 0) {
      return content.some(item => 
        typeof item === 'object' && 
        item !== null && 
        'type' in item && 
        item.type === 'tool_result'
      );
    }
  }
  
  return false;
};

// Helper function to extract tool result data
const extractToolResult = (message: Record<string, unknown>): { toolUseId: string; result: unknown } | null => {
  if (!isToolResultMessage(message)) return null;
  
  if (message.message && typeof message.message === 'object' && 'content' in message.message) {
    const content = (message.message as { content: unknown }).content;
    if (Array.isArray(content)) {
      const toolResult = content.find(item => 
        typeof item === 'object' && 
        item !== null && 
        'type' in item && 
        item.type === 'tool_result'
      );
      
      if (toolResult && 'tool_use_id' in toolResult) {
        // Check if we have the actual result in toolUseResult field
        if ('toolUseResult' in message && message.toolUseResult) {
          return {
            toolUseId: toolResult.tool_use_id as string,
            result: message.toolUseResult
          };
        }
        // Otherwise use the content field
        return {
          toolUseId: toolResult.tool_use_id as string,
          result: 'content' in toolResult ? toolResult.content : null
        };
      }
    }
  }
  
  return null;
};

export default function SessionDetail() {
  const { session, events = [] } = useLoaderData<typeof loader>();
  
  // Initialize messages with historical events (reverse to show oldest-to-newest in DOM for proper chat order)
  const initialMessages = events.map(event => ({
    ...(typeof event.data === 'object' ? event.data : {}),
    uuid: event.uuid,
    memva_session_id: event.memva_session_id || undefined
  })).reverse()
  
  // Extract initial tool results from historical messages
  const initialToolResults = new Map<string, unknown>();
  initialMessages.forEach(message => {
    const result = extractToolResult(message);
    if (result) {
      initialToolResults.set(result.toolUseId, result.result);
    }
  });
  
  // Debug logging for event ordering
  if (events.length > 0) {
    console.log('[SessionDetail] Loaded events:', {
      count: events.length,
      firstEvent: { uuid: events[0].uuid, timestamp: events[0].timestamp },
      lastEvent: { uuid: events[events.length - 1].uuid, timestamp: events[events.length - 1].timestamp }
    })
  }
  
  const [messages, setMessages] = useState<Record<string, unknown>[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [toolResults, setToolResults] = useState<Map<string, unknown>>(initialToolResults);
  const [tokenCount, setTokenCount] = useState(0);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
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

  // Calculate scrollbar width
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const calculateScrollbarWidth = () => {
      const hasScrollbar = container.scrollHeight > container.clientHeight;
      if (hasScrollbar) {
        // Calculate actual scrollbar width
        const width = container.offsetWidth - container.clientWidth;
        setScrollbarWidth(width);
      } else {
        setScrollbarWidth(0);
      }
    };

    calculateScrollbarWidth();
    
    // Recalculate when messages change
    const resizeObserver = new ResizeObserver(calculateScrollbarWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [messages]);

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
    // New session from homepage: explicitly marked for auto-start + not already started + no existing events
    if (!session) return
    
    const metadata = (session.metadata as unknown) as { should_auto_start?: boolean } | null
    if (metadata?.should_auto_start && !hasAutoStartedRef.current && events.length === 0) {
      console.log('🚀 Auto-starting conversation with session title:', session.title);
      
      // Reset auto-scroll for auto-started session
      if (autoScrollDisabled) {
        console.log('🔄 Auto-start triggered - resetting auto-scroll');
        setAutoScrollDisabled(false);
      }
      
      hasAutoStartedRef.current = true;
      setIsLoading(true);
      setTokenCount(0);
      setLoadingStartTime(Date.now());
      abortControllerRef.current = new AbortController();
      
      // Call Claude Code directly with session title (no form simulation needed)
      sendPromptToClaudeCode({
        prompt: session.title || 'Untitled Session',
        sessionId: session.id,
        onMessage: (message) => {
          console.log('[SessionDetail] New message received:', {
            type: message.type,
            uuid: message.uuid,
            timestamp: message.timestamp || new Date().toISOString()
          });
          
          // Check if this is a tool result message
          const result = extractToolResult(message);
          if (result) {
            // Store the tool result
            setToolResults(prev => new Map(prev).set(result.toolUseId, result.result));
            // Don't add tool result messages to the visible messages
            return;
          }
          
          // Add the message to the end (newest at bottom)
          setMessages(prev => [...prev, message]);
          
          // Count tokens from assistant messages
          if (message.type === 'assistant') {
            // Check if usage info is directly on message or nested
            const messageWithUsage = message as { 
              usage?: { input_tokens?: number; output_tokens?: number };
              message?: { usage?: { input_tokens?: number; output_tokens?: number } };
            };
            const usage = messageWithUsage.usage || messageWithUsage.message?.usage;
            if (usage) {
              // Only count output tokens for the streaming effect
              const outputTokens = usage.output_tokens || 0;
              if (outputTokens > 0) {
                setTokenCount(outputTokens);
              }
            }
          }
          
          // Stop loading when we get the result message
          if (message.type === 'result') {
            setIsLoading(false);
            setLoadingStartTime(null);
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
          setLoadingStartTime(null);
        },
        signal: abortControllerRef.current.signal
      });
    }
  }, [session?.metadata, events.length]);

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

  const handleSubmit = async (e: FormEvent) => {
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
    setTokenCount(0);
    setLoadingStartTime(Date.now());

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
        
        // Check if this is a tool result message
        const result = extractToolResult(message);
        if (result) {
          // Store the tool result
          setToolResults(prev => new Map(prev).set(result.toolUseId, result.result));
          // Don't add tool result messages to the visible messages
          return;
        }
        
        // Add the message to the end (newest at bottom)
        setMessages(prev => [...prev, message]);
        
        // Count tokens from assistant messages
        if (message.type === 'assistant') {
          // Check if usage info is directly on message or nested
          const messageWithUsage = message as { 
            usage?: { input_tokens?: number; output_tokens?: number };
            message?: { usage?: { input_tokens?: number; output_tokens?: number } };
          };
          const usage = messageWithUsage.usage || messageWithUsage.message?.usage;
          if (usage) {
            // Only count output tokens for the streaming effect
            // Input tokens are usually known upfront and don't change
            const outputTokens = usage.output_tokens || 0;
            if (outputTokens > 0) {
              setTokenCount(outputTokens);
            }
          }
        }
        
        // Stop loading when we get the result message
        if (message.type === 'result') {
          setIsLoading(false);
          setLoadingStartTime(null);
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
        setLoadingStartTime(null);
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
      setLoadingStartTime(null);
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
        className="flex-1 overflow-y-auto overflow-x-hidden"
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
              ? `min-h-full flex flex-col justify-end pt-6 ${isLoading ? 'pb-40' : 'pb-32'}`     // Overflow: bottom-anchored (newest at bottom)
              : `min-h-full flex flex-col justify-start pt-6 ${isLoading ? 'pb-40' : 'pb-32'}`   // Fits: top-anchored (start from top)
            }>
            {messages
              .filter(message => !isToolResultMessage(message))
              .map((message, index) => (
                <EventRenderer
                  key={getMessageKey(message, index)}
                  event={message}
                  toolResults={toolResults}
                />
              ))}
          </div>
        )}
      </div>

      {/* Progressive blur gradient overlay */}
      <div className="fixed bottom-0 left-0 right-0 h-40 pointer-events-none z-20">
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent"></div>
        <div className="absolute inset-0 backdrop-blur-gradient"></div>
      </div>

      {/* Floating input form */}
      <div className="fixed bottom-0 left-0 right-0 pb-7 z-30">
        <div className="px-4" style={{ paddingRight: `${16 + scrollbarWidth}px` }}>
          <div className="container mx-auto max-w-7xl">
            <div className="relative">
              {/* Loading indicator */}
              {isLoading && loadingStartTime && (
                <div className="mb-2">
                  <LoadingIndicator
                    tokenCount={tokenCount}
                    startTime={loadingStartTime}
                    isLoading={isLoading}
                  />
                </div>
              )}
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
      </div>
    </div>
  );
}