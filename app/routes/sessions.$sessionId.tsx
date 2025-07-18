import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useParams, Form, useLoaderData, useNavigation } from "react-router";
import { useSSEEvents } from "../hooks/useSSEEvents";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { RiFolder3Line } from "react-icons/ri";
import { EventRenderer } from "../components/events/EventRenderer";
import { PendingMessage } from "../components/PendingMessage";
import { getSession } from "../db/sessions.service";
import { getEventsForSession } from "../db/event-session.service";
import { useNewMessageTracking } from "../hooks/useNewMessageTracking";

export async function loader({ params }: LoaderFunctionArgs) {
  const sessionId = params.sessionId;
  
  if (!sessionId) {
    throw new Response("Session ID is required", { status: 400 });
  }
  
  const session = await getSession(sessionId);
  const events = await getEventsForSession(sessionId);
  return { session, events };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const prompt = formData.get('prompt') as string;
  
  if (!prompt?.trim()) {
    return { error: 'Prompt is required' };
  }

  const sessionId = params.sessionId;
  
  if (!sessionId) {
    throw new Response("Session ID is required", { status: 400 });
  }

  // Get session for project path
  const { getSession } = await import('../db/sessions.service');
  const session = await getSession(sessionId);
  
  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  // Store user message as an event
  const { storeEvent, createEventFromMessage } = await import('../db/events.service');
  
  const userEvent = createEventFromMessage({
    message: {
      type: 'user',
      content: prompt.trim(),
      session_id: '' // Will be populated by Claude Code SDK
    },
    memvaSessionId: sessionId,
    projectPath: session.project_path,
    parentUuid: null,
    timestamp: new Date().toISOString()
  });
  
  await storeEvent(userEvent);

  // Update session status to processing
  const { updateSession } = await import('../db/sessions.service');
  await updateSession(sessionId, { status: 'active' });

  // Update claude_status to processing
  const { updateSessionClaudeStatus } = await import('../db/sessions.service');
  await updateSessionClaudeStatus(sessionId, 'processing');

  // Create session-runner job
  const { createJob } = await import('../db/jobs.service');
  const { createSessionRunnerJob } = await import('../workers/job-types');
  
  const jobInput = createSessionRunnerJob({
    sessionId: sessionId,
    prompt: prompt.trim()
  });
  
  await createJob(jobInput);
  
  return { success: true };
}

// The EventRenderer component is already memoized and handles all event types

export default function SessionDetail() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const navigation = useNavigation();
  const { session: initialSession, events: initialEvents } = useLoaderData<typeof loader>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Clear new message indicator when visiting session detail
  const { clearNewMessage } = useNewMessageTracking(sessionId);
  useEffect(() => {
    clearNewMessage();
  }, [clearNewMessage]);
  
  // Use SSE for real-time new events and session status
  const { newEvents, sessionStatus } = useSSEEvents(sessionId);
  
  // Use SSE status if available, otherwise fall back to initial session
  const session = useMemo(() => {
    if (sessionStatus && initialSession) {
      return { ...initialSession, claude_status: sessionStatus };
    }
    return initialSession;
  }, [initialSession, sessionStatus]);
  
  // State management
  const [prompt, setPrompt] = useState("");
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [isStopInProgress, setIsStopInProgress] = useState(false);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<{
    content: string;
    timestamp: number;
  } | null>(null);
  
  // Track form submission state
  const isSubmitting = navigation.state === "submitting";
  
  // Define visibility states
  const showPending = processingStartTime !== null;
  
  // Helper to extract user message text from event data
  const getUserMessageText = (data: unknown): string | undefined => {
    if (!data || typeof data !== 'object') return undefined;
    const obj = data as Record<string, unknown>;
    
    // For user events, content is directly on data
    if (obj.type === 'user' && typeof obj.content === 'string') {
      return obj.content;
    }
    
    return undefined;
  };

  // Combine events and handle optimistic message
  const { displayEvents, toolResults } = useMemo(() => {
    let allEvents = [...initialEvents, ...newEvents];
    
    // Add optimistic message if present
    if (optimisticUserMessage) {
      const optimisticEvent = {
        uuid: `optimistic-${optimisticUserMessage.timestamp}`,
        event_type: 'user' as const,
        timestamp: new Date(optimisticUserMessage.timestamp).toISOString(),
        data: {
          type: 'user',
          content: optimisticUserMessage.content,
          session_id: ''
        },
        // Required fields for EventRenderer
        memva_session_id: sessionId,
        session_id: '',
        is_sidechain: false,
        parent_uuid: null,
        cwd: session?.project_path || '',
        project_name: session?.project_path?.split('/').pop() || 'Unknown'
      };
      allEvents = [...allEvents, optimisticEvent];
    }
    
    
    // Remove duplicates, including optimistic if real message arrived
    const unique = allEvents.filter((event, index, arr) => {
      // For optimistic user message, check if replaced by real event
      if (event.uuid?.startsWith('optimistic-') && optimisticUserMessage) {
        return !arr.some(e => 
          e.event_type === 'user' &&
          !e.uuid?.startsWith('optimistic-') &&
          getUserMessageText(e.data) === optimisticUserMessage.content &&
          Math.abs(new Date(e.timestamp).getTime() - optimisticUserMessage.timestamp) < 10000 // 10s window
        );
      }
      
      
      // Regular deduplication
      return arr.findIndex(e => e.uuid === event.uuid) === index;
    });
    
    const sorted = unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Filter out system, result events, and user events that contain only tool results from display
    const displayEvents = sorted.filter(event => {
      // Always exclude system and result events
      if (event.event_type === 'system' || event.event_type === 'result') {
        return false;
      }
      
      // For user events, exclude if they contain only tool_result content (not actual user messages)
      if (event.event_type === 'user' && event.data && typeof event.data === 'object') {
        const data = event.data as Record<string, unknown>;
        if ('message' in data && typeof data.message === 'object' && data.message) {
          const message = data.message as Record<string, unknown>;
          if ('content' in message && Array.isArray(message.content)) {
            // Check if this user event contains only tool_result items (no text content)
            const hasNonToolResultContent = message.content.some((item: unknown) => 
              item && typeof item === 'object' && 'type' in item && item.type !== 'tool_result'
            );
            // Exclude if it only has tool_result content
            if (!hasNonToolResultContent) {
              return false;
            }
          }
        }
      }
      
      return true;
    });
    
    // Build tool results map by linking tool calls to their results
    const toolResults = new Map<string, { result: unknown; isError?: boolean }>();
    
    // Extract tool results from user events that contain tool_result content
    sorted.forEach(event => {
      if (event.event_type === 'user' && event.data && typeof event.data === 'object') {
        const data = event.data as Record<string, unknown>;
        
        // Check if this user event has a message with content array containing tool results
        if ('message' in data && typeof data.message === 'object' && data.message) {
          const message = data.message as Record<string, unknown>;
          if ('content' in message && Array.isArray(message.content)) {
            // Look for tool_result content items
            message.content.forEach((item: unknown) => {
              if (item && typeof item === 'object' && 'type' in item && item.type === 'tool_result') {
                const toolResult = item as unknown as { tool_use_id: string; content: unknown; is_error?: boolean };
                if (toolResult.tool_use_id) {
                  // Detect if this is an error result
                  let isError = false;
                  
                  // Check if the tool result itself has an is_error field
                  if ('is_error' in toolResult && typeof toolResult.is_error === 'boolean') {
                    isError = toolResult.is_error;
                  }
                  // Also check if the content has is_error (for standardized format)
                  else if (toolResult.content && typeof toolResult.content === 'object' && 
                           'is_error' in toolResult.content) {
                    const content = toolResult.content as { is_error?: boolean };
                    isError = content.is_error === true;
                  }
                  
                  toolResults.set(toolResult.tool_use_id, {
                    result: toolResult,
                    isError
                  });
                }
              }
            });
          }
        }
      }
    });
    
    return { displayEvents, toolResults };
  }, [initialEvents, newEvents, optimisticUserMessage, sessionId, session?.project_path]);
  
  // Handle stop functionality (Escape key only)
  const handleStop = useCallback(async () => {
    // Set stop in progress
    setIsStopInProgress(true);
    
    // Clear pending state immediately for better UX
    setProcessingStartTime(null);
    setOptimisticUserMessage(null);
    
    // Focus input immediately since we're enabling it
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
    
    // Simple retry logic
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/stop`, {
          method: 'DELETE'
        });
        if (response.ok) break;
      } catch {
        // Continue to next attempt
      }
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }, [sessionId]);
  
  // Initial positioning - ensure last message is visible WITHOUT visible scrolling
  useEffect(() => {
    // Only do initial scroll if we have events OR if we're showing pending
    if ((displayEvents.length > 0 || showPending) && scrollContainerRef.current && isInitialMount.current) {
      const container = scrollContainerRef.current;
      
      // Use ResizeObserver to detect when content stops changing
      let resizeTimeout: ReturnType<typeof setTimeout>;
      let lastHeight = 0;
      
      const scrollToBottom = () => {
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const maxScroll = scrollHeight - clientHeight;
        
        if (maxScroll > 0) {
          container.scrollTop = maxScroll;
        }
      };
      
      const observer = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        
        const currentHeight = container.scrollHeight;
        if (currentHeight !== lastHeight) {
          lastHeight = currentHeight;
          scrollToBottom();
          
          // Wait for stability
          resizeTimeout = setTimeout(() => {
            scrollToBottom();
            setIsVisible(true);
            isInitialMount.current = false;
            observer.disconnect();
          }, 100);
        }
      });
      
      // Start observing
      observer.observe(container);
      
      // Initial scroll
      scrollToBottom();
      
      // Cleanup
      return () => {
        clearTimeout(resizeTimeout);
        observer.disconnect();
      };
    } else if (displayEvents.length === 0 && !showPending) {
      setIsVisible(true);
    }
  }, [displayEvents.length, showPending]);
  
  
  // Initialize processing time when session is processing
  useEffect(() => {
    if (session?.claude_status === 'processing' && !processingStartTime && !isStopInProgress) {
      // Find the most recent user message
      const allEvents = [...initialEvents, ...newEvents];
      const lastUserEvent = allEvents
        .filter(e => e.event_type === 'user')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      if (lastUserEvent) {
        setProcessingStartTime(new Date(lastUserEvent.timestamp).getTime());
      }
    }
  }, [session?.claude_status, processingStartTime, initialEvents, newEvents, isStopInProgress]);
  
  // Track if we should auto-scroll (user is near bottom)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Clear on result event OR when cancelled - but ensure messages are rendered first
  useEffect(() => {
    if (processingStartTime) {
      // Check for result event
      const resultEvent = newEvents.find(e => 
        e.event_type === 'result' && 
        new Date(e.timestamp).getTime() > processingStartTime
      );
      
      // Check for cancellation event
      const hasNewCancellation = newEvents.some(e => 
        e.event_type === 'user_cancelled' && 
        new Date(e.timestamp).getTime() > processingStartTime
      );
      
      if (resultEvent) {
        // For result events, ensure we have a corresponding assistant message in displayEvents
        // The result event comes after the assistant message, so we check if there's an assistant
        // message that came after our processing start time
        const hasAssistantMessage = displayEvents.some(e => 
          e.event_type === 'assistant' && 
          new Date(e.timestamp).getTime() > processingStartTime &&
          new Date(e.timestamp).getTime() <= new Date(resultEvent.timestamp).getTime()
        );
        
        if (hasAssistantMessage) {
          // Assistant message is rendered, safe to clear
          setProcessingStartTime(null);
          setOptimisticUserMessage(null);
          setIsStopInProgress(false);
          
          // Refocus input if user isn't actively reading/selecting
          if (inputRef.current && shouldAutoScroll) {
            // Check if user has selected text
            const selection = window.getSelection();
            const hasSelection = selection && selection.toString().length > 0;
            
            if (!hasSelection) {
              // Small delay to ensure UI has updated
              setTimeout(() => {
                inputRef.current?.focus();
              }, 100);
            }
          }
        }
        // If no assistant message yet, wait for it to arrive and render
      } else if (hasNewCancellation) {
        // For cancellations, only clear isStopInProgress since pending states were already cleared optimistically
        setIsStopInProgress(false);
      }
    }
  }, [newEvents, displayEvents, processingStartTime, shouldAutoScroll]);
  
  // Check if user is near bottom whenever they scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Auto-scroll when content changes (new messages, pending state, etc)
  useEffect(() => {
    if (!isInitialMount.current && scrollContainerRef.current && shouldAutoScroll) {
      const container = scrollContainerRef.current;
      
      // Scroll to bottom whenever content changes and we should auto-scroll
      requestAnimationFrame(() => {
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const maxScroll = scrollHeight - clientHeight;
        
        if (maxScroll > 0) {
          container.scrollTop = maxScroll;
        }
      });
    }
  }, [displayEvents.length, showPending, shouldAutoScroll, newEvents.length]);
  
  // Clear form when submission completes
  useEffect(() => {
    if (navigation.state === "idle" && prompt !== "") {
      setPrompt("");
    }
  }, [navigation.state]);

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
  
  // Handle Escape key to stop processing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && processingStartTime && !isStopInProgress) {
        handleStop();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processingStartTime, isStopInProgress, handleStop]);

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
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-32" ref={scrollContainerRef} style={{ opacity: isVisible ? 1 : 0 }}>
        {displayEvents.length === 0 && !isProcessing && !isSubmitting && !showPending ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-500">No messages yet. Start by asking Claude Code something!</p>
          </div>
        ) : (
          <div className="container mx-auto max-w-7xl py-4">
            {displayEvents.map((event) => (
              <div key={event.uuid} className="message-container">
                <EventRenderer
                  event={event}
                  toolResults={toolResults}
                  isStreaming={false}
                />
              </div>
            ))}
            {showPending && (
              <div className="message-container">
                <PendingMessage 
                  tokenCount={0}
                  startTime={processingStartTime}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating input form */}
      <div className="fixed bottom-0 left-0 right-0 pb-7 z-30">
        <div>
          <div className="container mx-auto max-w-7xl">
            <div className="relative">
              <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800/50 p-4 flex items-center gap-3">
                <Form 
                  method="post" 
                  className="flex-1"
                  onSubmit={() => {
                    const message = prompt.trim();
                    if (message) {
                      const now = Date.now();
                      setProcessingStartTime(now);
                      setOptimisticUserMessage({ content: message, timestamp: now });
                    }
                  }}
                >
                  <div className="flex items-center px-5 py-3.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl focus-within:border-zinc-600 focus-within:bg-zinc-800/80 transition-all duration-200">
                    <span className="text-zinc-500 font-mono mr-4 select-none">{'>'}</span>
                    <input
                      ref={inputRef}
                      name="prompt"
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={(isProcessing && !isStopInProgress) || isSubmitting}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      className="flex-1 bg-transparent text-zinc-100 focus:outline-none disabled:opacity-50 font-mono text-[0.9375rem]"
                      role="textbox"
                      placeholder={isProcessing || isSubmitting ? "Processing... (ESC to stop)" : "Ask Claude Code anything..."}
                    />
                  </div>
                </Form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}