import { useMemo } from 'react';
import { useEventStore } from '../stores/event-store';

export function useEventMetadata() {
  // Subscribe to display events for metadata calculation
  const displayEvents = useEventStore(state => state.displayEvents);
  
  // Detect context limit state
  const hasContextLimitEvent = useMemo(() => {
    return displayEvents.some(event => 
      event.event_type === 'system' && 
      event.data && 
      typeof event.data === 'object' && 
      'subtype' in event.data && 
      (event.data.subtype === 'context_limit_reached' || 
       event.data.subtype === 'summarizing_context')
    );
  }, [displayEvents]);
  
  // Check if we're actively summarizing (have context limit but no summary yet)
  const isActivelySummarizing = useMemo(() => {
    const hasContextLimit = displayEvents.some(event => 
      event.event_type === 'system' && 
      event.data && 
      typeof event.data === 'object' && 
      'subtype' in event.data && 
      event.data.subtype === 'context_limit_reached'
    );
    
    const hasSummary = displayEvents.some(event => 
      event.event_type === 'system' && 
      event.data && 
      typeof event.data === 'object' && 
      'subtype' in event.data && 
      event.data.subtype === 'context_summary'
    );
    
    return hasContextLimit && !hasSummary;
  }, [displayEvents]);

  return {
    hasContextLimitEvent,
    isActivelySummarizing,
    eventCount: displayEvents.length
  };
}