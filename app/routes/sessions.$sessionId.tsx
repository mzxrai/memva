import type { Route } from "./+types/sessions.$sessionId";
import { useLoaderData } from "react-router";
import { getSession } from "../db/sessions.service";
import { getEventsForSession } from "../db/event-session.service";
import { sendPromptToClaudeCode, type SDKMessage } from "../services/claude-code.service";
import { useState, useRef, useEffect } from "react";
import { RiSendPlaneFill, RiStopCircleLine } from "react-icons/ri";

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.sessionId);
  const events = await getEventsForSession(params.sessionId);
  return { session, events };
}

export default function SessionDetail() {
  const { session, events = [] } = useLoaderData<typeof loader>();
  
  // Initialize messages with historical events
  const initialMessages = events.map(event => ({
    ...(typeof event.data === 'object' ? event.data : {}),
    uuid: event.uuid,
    memva_session_id: event.memva_session_id || undefined
  }))
  
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) {
        handleStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]);

  // Track if we've already auto-started to prevent duplicates
  const hasAutoStartedRef = useRef(false);

  // Auto-start conversation for new sessions from homepage
  useEffect(() => {
    // New session from homepage: no events + has title + not already started
    if (events.length === 0 && session?.title && !hasAutoStartedRef.current) {
      console.log('🚀 Auto-starting conversation with session title:', session.title);
      
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
          
          // Add the message to the UI
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
  }, [events.length, session?.title]);

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
        
        // Add the message to the UI
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

      {/* Scrollable messages area */}
      <div className="flex-1 relative overflow-y-auto">
        <div className="px-4 pt-6 pb-40">
          <div className="container mx-auto max-w-7xl">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-zinc-500">No messages yet. Start by asking Claude Code something!</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={message.uuid || `${message.type}-${message.timestamp}-${index}`} className="mb-4">
                    <pre className="bg-zinc-800 p-4 rounded-lg text-zinc-100 font-mono text-xs overflow-x-auto">
                      {JSON.stringify(message, null, 2)}
                    </pre>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
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