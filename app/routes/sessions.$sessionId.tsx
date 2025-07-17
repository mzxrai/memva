import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useParams, Form, useLoaderData, useNavigation } from "react-router";
import { useSSEEvents } from "../hooks/useSSEEvents";
import { useSessionStatus } from "../hooks/useSessionStatus";
import { useState, useMemo, useEffect, useRef } from "react";
import { RiFolder3Line } from "react-icons/ri";
import { EventRenderer } from "../components/events/EventRenderer";
import { PendingMessage } from "../components/PendingMessage";
import { getSession } from "../db/sessions.service";
import { getEventsForSession } from "../db/event-session.service";
import type { AnyEvent } from "../types/events";

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
  
  // Poll for session status updates
  const { session: polledSession } = useSessionStatus(sessionId);
  const session = polledSession || initialSession;
  
  // Use SSE for real-time new events
  const { newEvents } = useSSEEvents(sessionId);
  
  // Track when form submission started for PendingMessage
  const submissionStartTime = useRef<number | null>(null);
  
  // Combine initial events from loader with new events from SSE
  // Remove duplicates by uuid and sort by timestamp
  const { displayEvents, toolResults } = useMemo(() => {
    const combined = [...initialEvents, ...newEvents];
    const unique = combined.filter((event, index, arr) => 
      arr.findIndex(e => e.uuid === event.uuid) === index
    );
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
                const toolResult = item as unknown as { tool_use_id: string; content: unknown };
                if (toolResult.tool_use_id) {
                  // Map the tool_use_id to the result for lookup by AssistantMessageEvent
                  // Wrap tool result content in standardized format that components expect
                  const standardizedResult = {
                    content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content),
                    is_error: false
                  };
                  
                  toolResults.set(toolResult.tool_use_id, {
                    result: standardizedResult,
                    isError: false
                  });
                }
              }
            });
          }
        }
      }
    });
    
    return { displayEvents, toolResults };
  }, [initialEvents, newEvents]);
  
  const [prompt, setPrompt] = useState("");
  
  // Track form submission state
  const isSubmitting = navigation.state === "submitting" && navigation.formAction === `/sessions/${sessionId}`;
  
  // Set submission start time when form is submitted or when status becomes processing
  useEffect(() => {
    if ((isSubmitting || session?.claude_status === 'processing') && !submissionStartTime.current) {
      submissionStartTime.current = Date.now();
    }
  }, [isSubmitting, session?.claude_status]);
  
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
  
  // Reset submission start time when processing completes
  useEffect(() => {
    if (session.claude_status !== 'processing' && submissionStartTime.current) {
      submissionStartTime.current = null;
    }
  }, [session.claude_status]);

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
        {displayEvents.length === 0 && !isProcessing && !isSubmitting ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-500">No messages yet. Start by asking Claude Code something!</p>
          </div>
        ) : (
          <div className="min-h-full flex flex-col justify-start pt-6 pb-32">
            {displayEvents.map((event) => (
              <EventRenderer
                key={event.uuid}
                event={event as AnyEvent}
                toolResults={toolResults}
                isStreaming={false}
              />
            ))}
            {/* Show PendingMessage when processing */}
            {(() => {
              // Check if we have a result event which signals completion
              const hasResultEvent = displayEvents.some(e => e.event_type === 'result');
              return (isProcessing || isSubmitting) && !hasResultEvent && submissionStartTime.current && (
                <PendingMessage 
                  tokenCount={0}
                  startTime={submissionStartTime.current}
                />
              );
            })()}
          </div>
        )}
      </div>

      {/* Floating input form */}
      <div className="fixed bottom-0 left-0 right-0 pb-7 z-30">
        <div className="px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="relative">
              <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800/50 p-4">
                <Form method="post">
                  <div className="flex items-center px-5 py-3.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl focus-within:border-zinc-600 focus-within:bg-zinc-800/80 transition-all duration-200">
                    <span className="text-zinc-500 font-mono mr-4 select-none">{'>'}</span>
                    <input
                      name="prompt"
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isProcessing || isSubmitting}
                      className="flex-1 bg-transparent text-zinc-100 focus:outline-none disabled:opacity-50 font-mono text-[0.9375rem]"
                      role="textbox"
                      placeholder={isProcessing || isSubmitting ? "Processing..." : "Ask Claude Code anything..."}
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