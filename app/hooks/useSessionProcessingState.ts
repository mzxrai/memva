import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Job, PermissionRequest } from '../db/schema';
import usePermissionPolling from './usePermissionPolling';

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
  
  // Track exit plan mode transitions
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  
  // Poll for permissions
  const { 
    permissions, 
    pendingCount: pendingPermissionCount,
    approve: approvePermission, 
    deny: denyPermission,
    isProcessing: isProcessingPermission
  } = usePermissionPolling({ 
    enabled: true,
    sessionId,
    pollingInterval
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
      return shouldPoll ? pollingInterval : false;
    },
    enabled: !!sessionId,
    staleTime: 0,
    gcTime: 0,
  });
  
  const activeJob = activeJobData?.job || null;

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
        // No active job - check if we have pending permissions
        if (pendingPermissionCount > 0) {
          // We have pending permissions but no job - keep processing state
          if (!prev.isProcessing) {
            newState.isProcessing = true;
            // Set start time for permission waiting if not already set
            if (!newState.processingStartTime) {
              newState.processingStartTime = currentTime;
            }
          }
        } else {
          // No job and no permissions - ensure clean state
          if (prev.isProcessing && !newState.isTransitioning) {
            // Just finished processing
            newState.isProcessing = false;
            newState.activeJob = null;
            newState.processingStartTime = null;
          } else if (!prev.isProcessing && prev.processingStartTime) {
            // Ensure processingStartTime is cleared when not processing
            newState.processingStartTime = null;
          }
        }
        
        // Clear activeJob when no job exists
        if (prev.activeJob) {
          newState.activeJob = null;
        }
      }

      return newState;
    });
  }, [activeJob, optimisticProcessing, pendingPermissionCount]);

  // Clear optimistic processing after a timeout
  useEffect(() => {
    if (optimisticProcessing) {
      const timeout = setTimeout(() => {
        setOptimisticProcessing(null);
      }, 10000); // Clear after 10 seconds if no job shows up

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [optimisticProcessing]);

  // Start processing optimistically
  const startProcessing = useCallback(() => {
    const now = Date.now();
    setOptimisticProcessing(now);
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
      isProcessing: false,
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
        isTransitioning: false,
        processingStartTime: null
      }));
    }, 3000);
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
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
  }, []);

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
  const showSpinner = state.isProcessing || state.isTransitioning || optimisticProcessing !== null || hasPendingPermissions;
  const isInputDisabled = showSpinner || isSubmitting;
  
  const placeholderText = useMemo(() => {
    if (hasPendingPermissions) {
      return "Awaiting permission... (ESC to deny)";
    }
    if (showSpinner || isSubmitting) {
      return "Processing... (ESC to stop)";
    }
    return "";
  }, [hasPendingPermissions, showSpinner, isSubmitting]);

  return {
    // Core state
    isProcessing: state.isProcessing,
    processingStartTime: state.processingStartTime,
    activeJob: state.activeJob,
    isTransitioning: state.isTransitioning,
    
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