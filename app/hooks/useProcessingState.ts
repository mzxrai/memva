import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Job } from '../db/schema';

interface ProcessingState {
  isProcessing: boolean;
  processingStartTime: number | null;
  activeJob: Job | null;
  isTransitioning: boolean;
}

interface UseProcessingStateOptions {
  sessionId: string;
  pollingInterval?: number;
}

// Track active jobs for a session and provide unified processing state
export function useProcessingState({ sessionId, pollingInterval = 1000 }: UseProcessingStateOptions) {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    processingStartTime: null,
    activeJob: null,
    isTransitioning: false
  });

  // Track when we submit a form to show spinner immediately
  const [optimisticProcessing, setOptimisticProcessing] = useState<number | null>(null);
  
  // Track exit plan mode transitions
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  

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
      const shouldPoll = state.isProcessing || optimisticProcessing !== null;
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
        
        // We have a real job now, no longer need optimistic state
        
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
        // No active job - ensure clean state
        if (prev.isProcessing && !newState.isTransitioning) {
          // Job just finished
          newState.isProcessing = false;
          newState.activeJob = null;
          newState.processingStartTime = null; // Clear the timer
        } else if (!prev.isProcessing && prev.processingStartTime) {
          // Ensure processingStartTime is cleared when not processing
          newState.processingStartTime = null;
        }
        // Clear activeJob when no job exists
        if (prev.activeJob) {
          newState.activeJob = null;
        }
      }

      return newState;
    });
  }, [activeJob, optimisticProcessing]);

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
      processingStartTime: now // Always use current time for new processing
    }));
    // Trigger immediate refetch
    refetch();
  }, [refetch]);

  // Handle exit plan mode transition
  const startTransition = useCallback(() => {
    setState(prev => ({
      ...prev,
      isTransitioning: true,
      isProcessing: false, // No longer processing
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
        processingStartTime: null // Clear timer after transition
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

  const showSpinner = state.isProcessing || state.isTransitioning || optimisticProcessing !== null;
  
  return {
    ...state,
    startProcessing,
    startTransition,
    stopProcessing,
    refetchActiveJob,
    showSpinner
  };
}