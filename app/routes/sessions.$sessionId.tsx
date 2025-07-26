import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useParams, Form, useLoaderData, useNavigation } from "react-router";
import { useSessionEvents } from "../hooks/useSessionEvents";
import { useSessionProcessingState } from "../hooks/useSessionProcessingState";
import { useEventStore } from "../stores/event-store";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { RiFolder3Line, RiSettings3Line } from "react-icons/ri";
import { EventList } from "../components/events/EventList";
import { FloatingPendingIndicator } from "../components/FloatingPendingIndicator";
import { getSession, getSessionSettings } from "../db/sessions.service";
import { useSessionActivity } from "../hooks/useMessageTracking";
import { ArchiveButton } from "../components/ArchiveButton";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea";
import { useTextareaSubmit } from "../hooks/useTextareaSubmit";
import { useImageUpload } from "../hooks/useImageUpload";
import { ImagePreview } from "../components/ImagePreview";
import SettingsModal from "../components/SettingsModal";
import PermissionsBadge from "../components/PermissionsBadge";
import { ContextSummarizationSheet } from "../components/ContextSummarizationSheet";
import clsx from "clsx";
import type { PermissionMode } from "../types/settings";

export async function loader({ params }: LoaderFunctionArgs) {
  const sessionId = params.sessionId;
  
  if (!sessionId) {
    throw new Response("Session ID is required", { status: 400 });
  }
  
  const session = await getSession(sessionId);
  const settings = session ? await getSessionSettings(sessionId) : null;
  // Events are now loaded via React Query, not in the loader
  return { session, settings };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  let prompt = formData.get('prompt') as string || '';
  
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

  // Handle image uploads
  const imagePaths: string[] = [];
  const imageDataEntries = [...formData.entries()].filter(([key]) => key.startsWith('image-data-'));
  
  // Require either prompt or images
  if (!prompt?.trim() && imageDataEntries.length === 0) {
    return { error: 'Please provide a prompt or upload images' };
  }
  
  
  if (imageDataEntries.length > 0) {
    const { saveImageToDisk } = await import('../services/image-storage.server');
    
    for (const [key, value] of imageDataEntries) {
      const index = key.replace('image-data-', '');
      const dataUrl = value as string;
      const fileName = formData.get(`image-name-${index}`) as string;
      
      if (dataUrl && fileName) {
        // Extract base64 data from data URL
        const base64Data = dataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Save image to disk
        const filePath = await saveImageToDisk(sessionId, fileName, buffer);
        imagePaths.push(filePath);
      }
    }
    
    // Format prompt with image paths
    const { formatPromptWithImages } = await import('../utils/image-prompt-formatting');
    prompt = formatPromptWithImages(prompt, imagePaths);
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
  const { session: initialSession, settings: initialSettings } = useLoaderData<typeof loader>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const [isVisible, setIsVisible] = useState(false);
  const [currentPermissionMode, setCurrentPermissionMode] = useState<PermissionMode>(initialSettings?.permissionMode || 'acceptEdits');
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);
  const [pendingPermissionMode, setPendingPermissionMode] = useState<PermissionMode | null>(null);
  const [isPermissionsUpdated, setIsPermissionsUpdated] = useState(false);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Event store actions are no longer needed for aborted sessions
  
  // Track user activity on this session page
  useSessionActivity(sessionId);
  
  // Track active session to prevent green lines while user is present
  useEffect(() => {
    // Mark this session as active
    localStorage.setItem('activeSession', sessionId);
    
    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched away from this tab
        localStorage.removeItem('activeSession');
      } else {
        // User came back to this tab
        localStorage.setItem('activeSession', sessionId);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      localStorage.removeItem('activeSession');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (updateIndicatorTimeoutRef.current) {
        clearTimeout(updateIndicatorTimeoutRef.current);
      }
      // No longer need to clear aborted session
    };
  }, []);
  
  // Autofocus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Use React Query for polling events and Zustand for state management
  const { isLoading: eventsLoading, sessionStatus, refetchPolling } = useSessionEvents(sessionId);
  
  // Get pre-computed data from Zustand store
  const displayEvents = useEventStore(state => state.displayEvents);
  const toolResults = useEventStore(state => state.toolResults);
  
  // Use SSE status if available, otherwise fall back to initial session
  const session = useMemo(() => {
    if (sessionStatus && initialSession) {
      return { ...initialSession, claude_status: sessionStatus };
    }
    return initialSession;
  }, [initialSession, sessionStatus]);
  
  // Track form submission state
  const isSubmitting = navigation.state === "submitting";
  
  // Use unified processing state that includes permissions
  const processingState = useSessionProcessingState({ 
    sessionId,
    isSubmitting 
  });
  
  // State management
  const [prompt, setPrompt] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Approve with specific permission mode setting
  const approveWithSettings = useCallback(async (requestId: string, permissionMode: 'default' | 'acceptEdits') => {
    try {
      // First, update the session permissions mode
      setCurrentPermissionMode(permissionMode);
      setIsUpdatingPermissions(true);
      
      const settingsResponse = await fetch(`/api/session/${sessionId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(initialSettings || {}),
          permissionMode
        })
      });
      
      if (!settingsResponse.ok) {
        throw new Error('Failed to update settings');
      }
      
      // Then approve the permission request
      await processingState.approvePermission(requestId);
    } catch (error) {
      console.error('Failed to approve with settings:', error);
      // Revert permission mode on error
      setCurrentPermissionMode(currentPermissionMode);
      throw error;
    } finally {
      setIsUpdatingPermissions(false);
    }
  }, [processingState, currentPermissionMode, sessionId, initialSettings]);
  
  // Use image upload hook
  const {
    images,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeImage,
    clearImages,
  } = useImageUpload();
  
  // Use custom hooks for textarea functionality
  const { textareaRef: inputRef } = useAutoResizeTextarea(prompt, { maxRows: 5 });
  const handleTextareaKeyDown = useTextareaSubmit(prompt, undefined, images.length > 0);
  

  // Create permissions map by tool_use_id
  const permissionsByToolId = useMemo(() => {
    const map = new Map<string, typeof processingState.permissions[0]>();
    processingState.permissions.forEach(permission => {
      if (permission.tool_use_id) {
        map.set(permission.tool_use_id, permission);
      }
    });
    return map;
  }, [processingState.permissions]);

  // Function to apply permission mode changes - simplified without abort tracking
  const applyPermissionModeChange = useCallback(async (newMode: PermissionMode) => {
    // Store original state for error recovery
    const originalPermissionMode = currentPermissionMode;
    const originalPendingMode = pendingPermissionMode;
    const originalIsUpdating = isUpdatingPermissions;
    
    try {
      // Update session settings
      const response = await fetch(`/api/session/${sessionId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(initialSettings || {}),
          permissionMode: newMode
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      
      // Trigger transition UI if there's an active job
      if (processingState.activeJob) {
        processingState.startTransition();
      }
      
    } catch (error) {
      console.error('Failed to apply permission mode change:', error);
      // Revert to original state on error
      setCurrentPermissionMode(originalPermissionMode);
      setPendingPermissionMode(originalPendingMode);
      setIsUpdatingPermissions(originalIsUpdating);
      return;
    }
    
    // Show success indicator
    setIsUpdatingPermissions(false);
    setIsPermissionsUpdated(true);
    if (updateIndicatorTimeoutRef.current) {
      clearTimeout(updateIndicatorTimeoutRef.current);
    }
    updateIndicatorTimeoutRef.current = setTimeout(() => {
      setIsPermissionsUpdated(false);
    }, 1000);
  }, [sessionId, initialSettings, processingState, currentPermissionMode, pendingPermissionMode, isUpdatingPermissions]);

  // Cycle through permission modes with debouncing
  const cyclePermissionMode = useCallback(() => {
    // Prevent concurrent operations
    if (isUpdatingPermissions && !debounceTimeoutRef.current) {
      // Already applying a change, ignore rapid calls
      return;
    }
    
    const modes: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
    const baseMode = pendingPermissionMode || currentPermissionMode;
    const currentIndex = modes.indexOf(baseMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    // Clear any existing timeouts and reset their associated state
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (updateIndicatorTimeoutRef.current) {
      clearTimeout(updateIndicatorTimeoutRef.current);
      updateIndicatorTimeoutRef.current = null;
    }
    
    // Update UI immediately to show the selected mode
    setCurrentPermissionMode(nextMode);
    setPendingPermissionMode(nextMode);
    setIsUpdatingPermissions(true);
    setIsPermissionsUpdated(false);
    
    // Set debounced timeout to actually apply the change
    debounceTimeoutRef.current = setTimeout(() => {
      applyPermissionModeChange(nextMode);
      setPendingPermissionMode(null);
      debounceTimeoutRef.current = null; // Clear reference after execution
    }, 1000);
  }, [currentPermissionMode, pendingPermissionMode, isUpdatingPermissions, applyPermissionModeChange]);

  // All event processing is now handled by Zustand store selectors
  
  // Handle stop functionality (Escape key only)
  const handleStop = useCallback(async () => {
    // Stop processing state
    processingState.stopProcessing();
    
    // Focus input immediately since we're enabling it
    if (inputRef.current) {
      // Use requestAnimationFrame instead of setTimeout to avoid race conditions
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
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
  }, [sessionId, processingState]);
  
  // Initial positioning - ensure last message is visible WITHOUT visible scrolling
  useEffect(() => {
    // Only do initial scroll if we have events OR if we're showing pending
    if ((displayEvents.length > 0 || processingState.showSpinner) && scrollContainerRef.current && isInitialMount.current) {
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
    } else if (displayEvents.length === 0 && !processingState.showSpinner) {
      setIsVisible(true);
    }
  }, [displayEvents.length, processingState.showSpinner]);
  
  
  // Watch for exit_plan_mode transitions
  useEffect(() => {
    if (!processingState.isProcessing) return;
    
    const unsubscribe = useEventStore.subscribe((state) => {
      const events = Array.from(state.events.values());
      
      // Look for recent exit_plan_mode tool_result
      const recentExitPlanResult = events.find(e => {
        if (e.event_type !== 'user' || !e.data || typeof e.data !== 'object') return false;
        
        const data = e.data as {
          message?: {
            content?: Array<{
              type: string;
              tool_use_id?: string;
              is_error?: boolean;
            }>;
          };
        };
        if (!data.message?.content || !Array.isArray(data.message.content)) return false;
        
        // Check if this is a tool_result for exit_plan_mode
        return data.message.content.some((c) => 
          c.type === 'tool_result' && 
          c.tool_use_id && 
          !c.is_error &&
          // Check timestamp is recent (within last 5 seconds)
          new Date(e.timestamp).getTime() > Date.now() - 5000
        );
      });
      
      if (recentExitPlanResult) {
        // Start transition mode
        processingState.startTransition();
      }
    });
    
    return () => unsubscribe();
  }, [processingState.isProcessing, processingState]);
  
  
  // Track if we should auto-scroll (user is near bottom)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Auto-focus input when processing completes
  useEffect(() => {
    if (!processingState.isProcessing && !processingState.isTransitioning && inputRef.current && shouldAutoScroll) {
      // Refocus input if user isn't actively reading/selecting
      const selection = window.getSelection();
      const hasSelection = selection && selection.toString().length > 0;
      
      if (!hasSelection) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    }
  }, [processingState.isProcessing, processingState.isTransitioning, shouldAutoScroll, inputRef]);
  
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
  
  // Auto-scroll when content changes
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    
    // Use ResizeObserver to detect ANY size change in the content
    const resizeObserver = new ResizeObserver(() => {
      if (shouldAutoScroll) {
        // Always scroll to absolute bottom when content changes
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const maxScroll = scrollHeight - clientHeight;
        
        if (maxScroll > 0 && container.scrollTop < maxScroll) {
          container.scrollTop = maxScroll;
        }
      }
    });
    
    // Observe the container for size changes
    resizeObserver.observe(container);
    
    // Also observe all child elements for size changes
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            resizeObserver.observe(node);
          }
        });
      });
    });
    
    mutationObserver.observe(container, {
      childList: true,
      subtree: true
    });
    
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [shouldAutoScroll]);
  
  // Clear prompt and images on successful submission
  const wasSubmittingRef = useRef(false);
  
  useEffect(() => {
    // Track if we were submitting and start processing state
    if ((navigation.state === "submitting" || navigation.state === "loading") && !wasSubmittingRef.current) {
      processingState.startProcessing();
      refetchPolling();
      wasSubmittingRef.current = true;
    }
    
    // Only clear prompt and images if we just finished submitting
    if (navigation.state === "idle" && wasSubmittingRef.current) {
      if (prompt !== "") {
        setPrompt("");
      }
      if (images.length > 0) {
        clearImages();
      }
      wasSubmittingRef.current = false;
    }
  }, [navigation.state, processingState, refetchPolling, prompt, images.length, clearImages]);

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

  // Determine UI state
  const hasError = session.claude_status === 'error';
  
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Escape key functionality
      if (e.key === 'Escape') {
        // First priority: deny pending permissions
        const pendingPermission = processingState.permissions.find(p => p.status === 'pending');
        if (pendingPermission && !processingState.isProcessingPermission) {
          e.preventDefault();
          await processingState.denyPermission(pendingPermission.id);
          return;
        }
        
        // Second priority: stop processing
        if (processingState.isProcessing) {
          e.preventDefault();
          handleStop();
          return;
        }
      }
      
      // SHIFT+TAB to cycle permission modes
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        
        // Check if permission changes are allowed
        const canChangePermissions = !processingState.isProcessing || 
                                    processingState.permissions.some(p => p.status === 'pending');
        
        if (!canChangePermissions) {
          // Maybe show a visual indicator or log
          console.log('[PERMISSIONS] Cannot change permissions during active processing');
          return;
        }
        
        cyclePermissionMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processingState, handleStop, cyclePermissionMode]);

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Fixed header */}
      <div className="px-4 py-6 border-b border-zinc-800">
        <div className="container mx-auto max-w-7xl">
          <h1 
            className="text-3xl font-semibold text-zinc-100 mb-2 truncate"
            title={session.title || 'Untitled Session'}
          >
            {session.title || 'Untitled Session'}
          </h1>
          <div className="text-sm text-zinc-400 flex items-center justify-between">
            <div className="flex items-center">
              <span className="flex items-center gap-1.5">
                <RiFolder3Line className="w-4 h-4 text-zinc-500" />
                <span className="font-mono">{session.project_path}</span>
              </span>
              <span className="mx-2">•</span>
              <span className="capitalize">{session.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <ArchiveButton
                sessionId={session.id}
                sessionStatus={session.status as 'active' | 'archived'}
              />
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all duration-200"
                aria-label="Session settings"
              >
                <RiSettings3Line className="w-4 h-4" />
                <span>Session settings</span>
              </button>
            </div>
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
      <div className={clsx("flex-1 overflow-y-auto overflow-x-hidden", processingState.showSpinner ? "pb-40" : "pb-32")} ref={scrollContainerRef} style={{ opacity: isVisible ? 1 : 0 }}>
        {eventsLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-500">Loading messages...</p>
          </div>
        ) : displayEvents.length === 0 && !processingState.showSpinner && !isSubmitting && !eventsLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-500">No messages yet. Start by asking something.</p>
          </div>
        ) : (
          <div className="container mx-auto max-w-7xl py-4">
            <EventList
              displayEvents={displayEvents}
              toolResults={toolResults}
              permissionsByToolId={permissionsByToolId}
              onApprovePermission={processingState.approvePermission}
              onDenyPermission={processingState.denyPermission}
              onApprovePermissionWithSettings={approveWithSettings}
              isProcessingPermission={processingState.isProcessingPermission}
            />
          </div>
        )}
      </div>

      {/* Floating input form */}
      <div className="fixed bottom-0 left-0 right-0 pb-7 z-30">
        <div>
          <div className="container mx-auto max-w-7xl">
            <div className="relative">
              {/* Image preview and permissions badge above the input container */}
              <div className={`flex items-end mb-2 ${images.length > 0 ? 'justify-between' : 'justify-end'}`}>
                {images.length > 0 && (
                  <div className="flex-1 mr-4">
                    <ImagePreview images={images} onRemove={removeImage} />
                  </div>
                )}
                <PermissionsBadge 
                  mode={currentPermissionMode}
                  isUpdating={isUpdatingPermissions}
                  isUpdated={isPermissionsUpdated}
                  isDisabled={processingState.isProcessing && !processingState.permissions.some(p => p.status === 'pending')}
                />
              </div>
              <div 
                className={`relative bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border ${isDragging ? 'border-zinc-600' : 'border-zinc-800/50'} p-4 flex items-center gap-3 transition-colors duration-200`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Floating pending indicator */}
                <FloatingPendingIndicator 
                  startTime={processingState.processingStartTime}
                  isVisible={processingState.showSpinner}
                  isTransitioning={processingState.isTransitioning}
                />
                <Form 
                  method="post" 
                  className="flex-1"
                  onSubmit={(e) => {
                    const message = prompt.trim();
                    const hasImages = images.length > 0;
                    
                    // Check if textarea is disabled - if so, prevent submit
                    if (processingState.isInputDisabled) {
                      e.preventDefault();
                      return;
                    }
                    
                    // Prevent submit if no content
                    if (!message && !hasImages) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="flex items-start px-5 py-3.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl focus-within:border-zinc-600 focus-within:bg-zinc-800/80 transition-all duration-200">
                    <span className="text-zinc-500 font-mono mr-4 select-none">{'>'}</span>
                    <textarea
                      ref={inputRef}
                      name="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      disabled={processingState.isInputDisabled}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      rows={1}
                      className="flex-1 bg-transparent text-zinc-100 focus:outline-none disabled:opacity-50 font-mono text-[0.9375rem] resize-none leading-normal"
                      role="textbox"
                      placeholder={processingState.placeholderText}
                      style={{ overflowY: 'hidden' }}
                    />
                  </div>
                  
                  {/* Hidden inputs for image data */}
                  {images.map((image, index) => (
                    <div key={image.id}>
                      <input
                        type="hidden"
                        name={`image-data-${index}`}
                        value={image.preview}
                      />
                      <input
                        type="hidden"
                        name={`image-name-${index}`}
                        value={image.file.name}
                      />
                    </div>
                  ))}
                  
                  {/* Hidden submit button for Enter key handling 
                      React Router forms don't properly submit with form.requestSubmit(), 
                      but clicking a submit button works correctly */}
                  <button type="submit" style={{ display: 'none' }} aria-hidden="true">Submit</button>
                </Form>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mode="session"
        sessionId={sessionId}
        onSettingsChange={(newSettings) => {
          setCurrentPermissionMode(newSettings.permissionMode)
        }}
      />
      
      {/* Context Summarization Sheet */}
      <ContextSummarizationSheet
        isVisible={processingState.isInContextSummarization}
        onCancel={handleStop}
      />
    </div>
  );
}