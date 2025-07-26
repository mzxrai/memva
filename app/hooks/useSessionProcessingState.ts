import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Job, PermissionRequest } from '../db/schema';
import usePermissionPolling from './usePermissionPolling';
import { useEventStore } from '../stores/event-store';

interface SessionProcessingState {
  // Core state
  isProcessing: boolean;
  processingStartTime: number | null;
  activeJob: Job | null;
  isTransitioning: boolean;
  
  // Permission state
  permissions: PermissionRequest[];
  pendingPermissionCount: number;
  
  // Combined state
  showSpinner: boolean;
  isInputDisabled: boolean;
  placeholderText: string;
}

interface UseSessionProcessingStateOptions {
  sessionId: string;
  pollingInterval?: number;
  isSubmitting?: boolean;
}

// How long to continue polling after startProcessing is called
const GRACE_PERIOD_MS = 5000;

// How long to wait before clearing optimistic processing state
const OPTIMISTIC_TIMEOUT_MS = 10000;

// How long to show transition state after exit plan mode
const TRANSITION_TIMEOUT_MS = 3000;

// Unified hook that manages all processing-related state for a session
export function useSessionProcessingState({ 
  sessionId, 
  pollingInterval = 1000,
  isSubmitting = false 
}: UseSessionProcessingStateOptions) {
  const [state, setState] = useState<Omit<SessionProcessingState, 'permissions' | 'pendingPermissionCount' | 'showSpinner' | 'isInputDisabled' | 'placeholderText'>>({
    isProcessing: false,
    processingStartTime: null,
    activeJob: null,
    isTransitioning: false
  });

  // Track when we submit a form to show spinner immediately
  const [optimisticProcessing, setOptimisticProcessing] = useState<number | null>(null);
  
  // Track when we last started processing to maintain polling
  const lastProcessingStartRef = useRef<number>(0);
  
  // Track exit plan mode transitions
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  
  // Only poll for permissions during active session runs
  const shouldPollPermissions = state.isProcessing || state.isTransitioning || !!state.activeJob || optimisticProcessing !== null;
  
  // Create a ref to hold the stopProcessing function
  const stopProcessingRef = useRef<(() => void) | null>(null);
  
  // Poll for permissions
  const { 
    permissions, 
    pendingCount: pendingPermissionCount,
    approve: approvePermission, 
    deny: denyPermission,
    isProcessing: isProcessingPermission
  } = usePermissionPolling({ 
    enabled: shouldPollPermissions,
    sessionId,
    pollingInterval,
    onPermissionsCleared: useCallback(() => {
      // When all permissions are cleared and there's no active job, stop processing
      if (!state.activeJob && stopProcessingRef.current) {
        stopProcessingRef.current();
      }
    }, [state.activeJob])
  });

  // Poll for active jobs
  const { data: activeJobData, refetch } = useQuery<{ job: Job | null }>({
    queryKey: ['active-job', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/${sessionId}/active-job`);
      if (!response.ok) return { job: null };
      const data = await response.json();
      return {
        job: data.job as Job | null
      };
    },
    refetchInterval: () => {
      // Poll faster when we know we're processing
      const shouldPoll = state.isProcessing || optimisticProcessing !== null || pendingPermissionCount > 0;
      
      // Also keep polling for grace period after startProcessing was called
      // This ensures we catch new jobs even if we get null responses initially
      const timeSinceStart = Date.now() - lastProcessingStartRef.current;
      const inGracePeriod = lastProcessingStartRef.current > 0 && timeSinceStart < GRACE_PERIOD_MS;
      
      return (shouldPoll || inGracePeriod) ? pollingInterval : false;
    },
    enabled: !!sessionId,
    staleTime: 0,
    gcTime: 0,
  });
  
  const activeJob = activeJobData?.job || null;

  // Check if we're in context summarization state by looking at recent events
  const isInContextSummarization = useEventStore(state => {
    const events = Array.from(state.events.values());
    const recentEvents = events.filter(e => 
      new Date(e.timestamp).getTime() > Date.now() - 30000 // Last 30 seconds
    );
    
    // Look for context limit or summarizing events
    return recentEvents.some(e => {
      if (e.event_type !== 'system' || !e.data || typeof e.data !== 'object') return false;
      const data = e.data as { subtype?: string };
      return data.subtype === 'context_limit_reached' || 
             data.subtype === 'summarizing_context';
    }) && !recentEvents.some(e => {
      // Check if summarization is complete
      if (e.event_type !== 'system' || !e.data || typeof e.data !== 'object') return false;
      const data = e.data as { subtype?: string };
      return data.subtype === 'context_summary';
    });
  });

  // Update state based on active job
  useEffect(() => {
    const hasActiveJob = !!activeJob;
    const currentTime = Date.now();
    
    // Clear optimistic processing when we have a real job
    if (hasActiveJob && optimisticProcessing) {
      setOptimisticProcessing(null);
    }

    setState(prev => {
      const newState = { ...prev };

      if (hasActiveJob) {
        // We have an active job
        newState.isProcessing = true;
        newState.activeJob = activeJob;
        
        // Set start time if not already set
        if (!newState.processingStartTime) {
          // Use optimistic time if available and recent (within 5 seconds)
          if (optimisticProcessing && currentTime - optimisticProcessing < 5000) {
            newState.processingStartTime = optimisticProcessing;
          } else {
            // Otherwise use job start time or current time
            newState.processingStartTime = activeJob.started_at 
              ? new Date(activeJob.started_at).getTime()
              : currentTime;
          }
        }
      } else if (!hasActiveJob) {
        // No active job - check if we're in optimistic processing period
        if (optimisticProcessing) {
          // We're in optimistic processing - maintain processing state
          newState.isProcessing = true;
          if (!newState.processingStartTime) {
            newState.processingStartTime = optimisticProcessing;
          }
        } else if (pendingPermissionCount > 0) {
          // We have pending permissions but no job - keep processing state
          if (!prev.isProcessing) {
            newState.isProcessing = true;
            // Set start time for permission waiting if not already set
            if (!newState.processingStartTime) {
              newState.processingStartTime = currentTime;
            }
          }
        } else if (isInContextSummarization) {
          // We're in context summarization - maintain processing state
          newState.isProcessing = true;
          if (!newState.processingStartTime) {
            newState.processingStartTime = currentTime;
          }
        } else {
          // No job, no optimistic processing, no permissions, and not summarizing - immediately clear processing state
          // Don't wait for grace period when permissions are handled
          if (prev.isProcessing && !newState.isTransitioning) {
            // Just finished processing
            newState.isProcessing = false;
            newState.activeJob = null;
            newState.processingStartTime = null;
            // Clear the grace period tracking to prevent it from re-enabling
            lastProcessingStartRef.current = 0;
          } else if (!prev.isProcessing && prev.processingStartTime) {
            // Ensure processingStartTime is cleared when not processing
            newState.processingStartTime = null;
          }
        }
        
        // Clear activeJob when no job exists (only if not already cleared above)
        if (prev.activeJob && newState.activeJob !== null) {
          newState.activeJob = null;
        }
      }

      return newState;
    });
  }, [activeJob, optimisticProcessing, pendingPermissionCount, isInContextSummarization]);

  // Clear optimistic processing after a timeout
  useEffect(() => {
    if (optimisticProcessing) {
      const timeout = setTimeout(() => {
        setOptimisticProcessing(null);
      }, OPTIMISTIC_TIMEOUT_MS);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [optimisticProcessing]);

  // Start processing optimistically
  const startProcessing = useCallback(() => {
    const now = Date.now();
    setOptimisticProcessing(now);
    lastProcessingStartRef.current = now; // Track when we started
    setState(prev => ({
      ...prev,
      isProcessing: true,
      processingStartTime: now
    }));
    // Trigger immediate refetch
    refetch();
  }, [refetch]);

  // Handle exit plan mode transition
  const startTransition = useCallback(() => {
    setState(prev => ({
      ...prev,
      isTransitioning: true,
      // Keep isProcessing true during transition for seamless loading state
      isProcessing: true,
      activeJob: null
      // Keep processingStartTime during transition for smooth UI
    }));

    // Clear transition state after a timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    transitionTimeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isTransitioning: false
        // Keep processingStartTime and isProcessing - they will be updated when new job arrives
      }));
    }, TRANSITION_TIMEOUT_MS);
  }, []);

  // Stop processing (ESC key)
  const stopProcessing = useCallback(() => {
    setState({
      isProcessing: false,
      processingStartTime: null,
      activeJob: null,
      isTransitioning: false
    });
    setOptimisticProcessing(null);
    lastProcessingStartRef.current = 0; // Reset grace period tracking
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
  }, []);
  
  // Update the ref whenever stopProcessing changes
  useEffect(() => {
    stopProcessingRef.current = stopProcessing;
  }, [stopProcessing]);

  // Force refetch active job
  const refetchActiveJob = useCallback(() => {
    refetch();
  }, [refetch]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Compute derived state
  const hasPendingPermissions = pendingPermissionCount > 0;
  const showSpinner = state.isProcessing || state.isTransitioning || optimisticProcessing !== null || hasPendingPermissions || isInContextSummarization;
  
  // Disable input when processing OR when submitting
  const isInputDisabled = showSpinner || isSubmitting;
  
  
  const placeholderText = useMemo(() => {
    if (hasPendingPermissions) {
      return "Awaiting permission... (ESC to deny)";
    }
    if (isInContextSummarization) {
      return "Creating conversation summary...";
    }
    if (showSpinner || isSubmitting) {
      return "Processing... (ESC to stop)";
    }
    return "";
  }, [hasPendingPermissions, showSpinner, isSubmitting, isInContextSummarization]);

  return {
    // Core state
    isProcessing: state.isProcessing,
    processingStartTime: state.processingStartTime,
    activeJob: state.activeJob,
    isTransitioning: state.isTransitioning,
    isInContextSummarization,
    
    // Permission state
    permissions,
    pendingPermissionCount,
    approvePermission,
    denyPermission,
    isProcessingPermission,
    
    // Combined state
    showSpinner,
    isInputDisabled,
    placeholderText,
    
    // Actions
    startProcessing,
    startTransition,
    stopProcessing,
    refetchActiveJob
  };
}