import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useEventStore } from '../stores/event-store';
import type { Event } from '../db/schema';

interface EventsResponse {
  events: Event[];
  session_status: string | null;
  has_more: boolean;
  latest_event_id: string | null;
  latest_timestamp: string | null;
}

interface UseSessionEventsOptions {
  enabled?: boolean;
  pollingInterval?: number;
}

export function useSessionEvents(
  sessionId: string,
  options: UseSessionEventsOptions = {}
) {
  const { enabled = true, pollingInterval = 1000 } = options;
  const lastEventIdRef = useRef<string | null>(null);
  const lastTimestampRef = useRef<string | null>(null);
  
  
  // Get stable references to store actions
  const setInitialEvents = useEventStore.getState().setInitialEvents;
  const addEvents = useEventStore.getState().addEvents;
  const updateSessionStatus = useEventStore.getState().updateSessionStatus;
  const clearEvents = useEventStore.getState().clearEvents;
  
  // Initial fetch - get all events
  const initialQuery = useQuery({
    queryKey: ['session-events', sessionId, 'initial'],
    queryFn: async () => {
      const response = await fetch(
        `/api/sessions/${sessionId}/events?include_all=true`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      
      const data: EventsResponse = await response.json();
      return data;
    },
    enabled: enabled && !!sessionId,
    staleTime: Infinity, // Initial data doesn't go stale
    gcTime: Infinity, // Keep in cache forever
  });
  
  // State to track if we should poll
  const [shouldPoll, setShouldPoll] = useState(false);
  
  // Polling query - only fetch new events
  const pollingQuery = useQuery({
    queryKey: ['session-events', sessionId, 'polling'], // Stable key
    queryFn: async () => {
      
      let url = `/api/sessions/${sessionId}/events`;
      
      // Only fetch new events if we have a reference point
      if (lastTimestampRef.current) {
        url += `?since_timestamp=${encodeURIComponent(lastTimestampRef.current)}`;
      } else if (lastEventIdRef.current) {
        url += `?since_event_id=${encodeURIComponent(lastEventIdRef.current)}`;
      } else {
        // If no reference point, skip this poll
        return null;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch new events');
      }
      
      const data: EventsResponse = await response.json();
      return data;
    },
    enabled: enabled && !!sessionId && shouldPoll,
    refetchInterval: pollingInterval,
    staleTime: 0, // Always consider polling data stale
    gcTime: 0, // Don't cache polling results
  });
  
  // Update Zustand store when initial data arrives
  useEffect(() => {
    if (initialQuery.data) {
      setInitialEvents(initialQuery.data.events);
      if (initialQuery.data.session_status) {
        updateSessionStatus(initialQuery.data.session_status);
      }
      
      // Update our reference points
      lastEventIdRef.current = initialQuery.data.latest_event_id;
      lastTimestampRef.current = initialQuery.data.latest_timestamp;
      
      // Enable polling now that we have reference points
      if (initialQuery.data.latest_event_id || initialQuery.data.latest_timestamp) {
        setShouldPoll(true);
      }
    }
  }, [initialQuery.data]);
  
  // Update Zustand store when new events arrive from polling
  useEffect(() => {
    if (pollingQuery.data) {
      if (pollingQuery.data.events.length > 0) {
        addEvents(pollingQuery.data.events);
      }
      
      if (pollingQuery.data.session_status) {
        updateSessionStatus(pollingQuery.data.session_status);
      }
      
      // Update our reference points - use the latest values if available
      if (pollingQuery.data.latest_event_id) {
        lastEventIdRef.current = pollingQuery.data.latest_event_id;
      }
      if (pollingQuery.data.latest_timestamp) {
        lastTimestampRef.current = pollingQuery.data.latest_timestamp;
      }
    }
  }, [pollingQuery.data]);
  
  // Clear store ONLY when session actually changes
  useEffect(() => {
    // Clear on mount for new session
    clearEvents();
    
    return () => {
      // Only clear refs on unmount, not on every render
      clearEvents();
      lastEventIdRef.current = null;
      lastTimestampRef.current = null;
    };
  }, [sessionId]); // This should only run when sessionId changes
  
  // Combine loading states
  const isLoading = initialQuery.isLoading;
  const isError = initialQuery.isError || pollingQuery.isError;
  const error = initialQuery.error || pollingQuery.error;
  
  // Manual refetch function
  const refetch = async () => {
    await initialQuery.refetch();
    // Reset reference points to refetch all events
    lastEventIdRef.current = null;
    lastTimestampRef.current = null;
  };
  
  return {
    isLoading,
    isError,
    error,
    refetch,
    // Expose session status from the store
    sessionStatus: useEventStore(state => state.sessionStatus),
  };
}