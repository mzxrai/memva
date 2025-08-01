import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Event } from '../db/schema'

// Types for our event store
type EventState = {
  // Store events in a Map for O(1) lookups
  events: Map<string, Event>
  // Store tool results separately for efficient updates
  toolResults: Map<string, { result: unknown; isError?: boolean }>
  // Session metadata
  sessionStatus: string | null
  lastEventTimestamp: string | null
  // Optimistic message for immediate UI feedback
  optimisticUserMessage: { content: string; timestamp: number } | null
  // Pre-computed arrays for performance
  sortedEvents: Event[]
  displayEvents: Event[]
}

type EventActions = {
  // Initialize store with events from loader
  setInitialEvents: (events: Event[]) => void
  // Add new events from polling
  addEvents: (newEvents: Event[]) => void
  // Update a specific tool result
  updateToolResult: (toolId: string, result: unknown, isError?: boolean) => void
  // Update session status
  updateSessionStatus: (status: string) => void
  // Set optimistic message
  setOptimisticMessage: (message: { content: string; timestamp: number } | null) => void
  // Clear all events (for session change)
  clearEvents: () => void
}

type EventStore = EventState & EventActions

// Computed selectors for efficient data access
type EventSelectors = {
  // Get sorted events array
  getSortedEvents: () => Event[]
  // Get display events (filtered)
  getDisplayEvents: () => Event[]
  // Get events by type
  getEventsByType: (type: string) => Event[]
  // Get tool result for a specific tool use
  getToolResult: (toolId: string) => { result: unknown; isError?: boolean } | undefined
}

// Helper to extract user message text from event data
const getUserMessageText = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') return undefined
  const obj = data as Record<string, unknown>
  
  if (obj.type === 'user' && typeof obj.content === 'string') {
    return obj.content
  }
  
  return undefined
}

// Helper to compute sorted events
const computeSortedEvents = (eventMap: Map<string, Event>): Event[] => {
  const eventArray = Array.from(eventMap.values());
  
  // Create array with pre-computed timestamps for sorting
  const eventsWithTime = eventArray.map(event => ({
    event,
    time: new Date(event.timestamp).getTime()
  }));
  
  // Sort by timestamp
  eventsWithTime.sort((a, b) => a.time - b.time);
  
  return eventsWithTime.map(({ event }) => event);
}

// Helper to check if a single event should be displayed
const shouldDisplayEvent = (event: Event): boolean => {
  // System and result events are now filtered at the database level (visible = false)
  // So we only need to filter user events that contain only tool_result content
  if (event.event_type === 'user' && event.data && typeof event.data === 'object') {
    const data = event.data as Record<string, unknown>
    if ('message' in data && typeof data.message === 'object' && data.message) {
      const message = data.message as Record<string, unknown>
      if ('content' in message && Array.isArray(message.content)) {
        const hasNonToolResultContent = message.content.some((item: unknown) => 
          item && typeof item === 'object' && 'type' in item && (item as { type: string }).type !== 'tool_result'
        )
        if (!hasNonToolResultContent) {
          return false
        }
      }
    }
  }
  
  return true
}

// Helper to compute display events (filters out system events and empty tool results)
const computeDisplayEvents = (sortedEvents: Event[]): Event[] => {
  return sortedEvents.filter(event => shouldDisplayEvent(event));
}

// Helper to extract tool results from events
const extractToolResults = (events: Event[]): Map<string, { result: unknown; isError?: boolean }> => {
  const toolResults = new Map<string, { result: unknown; isError?: boolean }>()
  
  events.forEach(event => {
    if (event.event_type === 'user' && event.data && typeof event.data === 'object') {
      const data = event.data as Record<string, unknown>
      
      if ('message' in data && typeof data.message === 'object' && data.message) {
        const message = data.message as Record<string, unknown>
        if ('content' in message && Array.isArray(message.content)) {
          message.content.forEach((item: unknown) => {
            if (item && typeof item === 'object' && 'type' in item && item.type === 'tool_result') {
              const toolResult = item as unknown as { tool_use_id: string; content: unknown; is_error?: boolean }
              if (toolResult.tool_use_id) {
                let isError = false
                
                if ('is_error' in toolResult && typeof toolResult.is_error === 'boolean') {
                  isError = toolResult.is_error
                } else if (toolResult.content && typeof toolResult.content === 'object' && 
                         'is_error' in toolResult.content) {
                  const content = toolResult.content as { is_error?: boolean }
                  isError = content.is_error === true
                }
                
                toolResults.set(toolResult.tool_use_id, {
                  result: toolResult,
                  isError
                })
              }
            }
          })
        }
      }
    }
  })
  
  return toolResults
}

export const useEventStore = create<EventStore & EventSelectors>()(
  devtools(
    (set, get) => ({
      // Initial state
      events: new Map(),
      toolResults: new Map(),
      sessionStatus: null,
      lastEventTimestamp: null,
      optimisticUserMessage: null,
      sortedEvents: [],
      displayEvents: [],

      // Actions
      setInitialEvents: (events) => set(() => {
        const eventMap = new Map<string, Event>()
        let lastTimestamp: string | null = null
        
        events.forEach(event => {
          eventMap.set(event.uuid, event)
          if (!lastTimestamp || new Date(event.timestamp) > new Date(lastTimestamp)) {
            lastTimestamp = event.timestamp
          }
        })
        
        // Pre-compute sorted and display events
        const sortedEvents = computeSortedEvents(eventMap);
        const displayEvents = computeDisplayEvents(sortedEvents);
        
        return {
          events: eventMap,
          toolResults: extractToolResults(events),
          lastEventTimestamp: lastTimestamp,
          sortedEvents,
          displayEvents
        }
      }, false, 'setInitialEvents'),

      addEvents: (newEvents) => set((state) => {
        // If no new events, return early
        if (newEvents.length === 0) {
          return state;
        }
        
        const updatedEvents = new Map(state.events)
        const updatedToolResults = new Map(state.toolResults)
        let lastTimestamp = state.lastEventTimestamp
        const actuallyNewEvents: Event[] = []
        
        newEvents.forEach(event => {
          // Only add if not already present
          if (!updatedEvents.has(event.uuid)) {
            updatedEvents.set(event.uuid, event)
            actuallyNewEvents.push(event)
            
            // Update last timestamp
            if (!lastTimestamp || new Date(event.timestamp) > new Date(lastTimestamp)) {
              lastTimestamp = event.timestamp
            }
            
            // Extract tool results from this event
            const eventResults = extractToolResults([event])
            eventResults.forEach((value, key) => {
              updatedToolResults.set(key, value)
            })
          }
        })
        
        // If no actually new events were added, return current state
        if (actuallyNewEvents.length === 0) return state;
        
        // For incremental updates, we can optimize by inserting new events
        // into the already-sorted arrays instead of re-sorting everything
        
        // Sort just the new events
        const sortedNewEvents = actuallyNewEvents.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        // No longer need to track aborted sessions client-side
        
        // Helper function for binary search to find insertion point
        // Uses < instead of <= to ensure stable ordering for identical timestamps
        const binarySearchInsertIndex = (arr: Event[], targetTime: number): number => {
          let left = 0;
          let right = arr.length;
          
          while (left < right) {
            const mid = Math.floor((left + right) / 2);
            if (new Date(arr[mid].timestamp).getTime() < targetTime) {
              left = mid + 1;
            } else {
              right = mid;
            }
          }
          
          return left;
        };
        
        // Build new sorted events array immutably
        let sortedEvents = state.sortedEvents;
        let displayEvents = state.displayEvents;
        
        for (const newEvent of sortedNewEvents) {
          const newEventTime = new Date(newEvent.timestamp).getTime();
          
          // Use binary search for better performance with large arrays
          const insertIndex = binarySearchInsertIndex(sortedEvents, newEventTime);
          
          // Create new array with event inserted at correct position
          sortedEvents = [
            ...sortedEvents.slice(0, insertIndex),
            newEvent,
            ...sortedEvents.slice(insertIndex)
          ];
          
          // Check if this event should be displayed
          if (shouldDisplayEvent(newEvent)) {
            const displayInsertIndex = binarySearchInsertIndex(displayEvents, newEventTime);
            
            // Create new display array with event inserted
            displayEvents = [
              ...displayEvents.slice(0, displayInsertIndex),
              newEvent,
              ...displayEvents.slice(displayInsertIndex)
            ];
          }
        }
        
        return {
          events: updatedEvents,
          toolResults: updatedToolResults,
          lastEventTimestamp: lastTimestamp,
          sortedEvents,
          displayEvents
        }
      }, false, 'addEvents'),

      updateToolResult: (toolId, result, isError = false) => set((state) => ({
        toolResults: new Map(state.toolResults).set(toolId, { result, isError })
      }), false, 'updateToolResult'),

      updateSessionStatus: (status) => set((state) => {
        if (state.sessionStatus === status) {
          return state;
        }
        return { sessionStatus: status };
      }, false, 'updateSessionStatus'),

      setOptimisticMessage: (message) => {
        set({ optimisticUserMessage: message }, false, 'setOptimisticMessage');
      },

      clearEvents: () => {
        set({
          events: new Map(),
          toolResults: new Map(),
          sessionStatus: null,
          lastEventTimestamp: null,
          optimisticUserMessage: null,
          sortedEvents: [],
          displayEvents: []
        }, false, 'clearEvents');
      },

      // Selectors
      getSortedEvents: () => {
        const state = get()
        
        // Add optimistic message if present
        if (state.optimisticUserMessage) {
          const optimisticEvent: Event = {
            uuid: `optimistic-${state.optimisticUserMessage.timestamp}`,
            event_type: 'user',
            timestamp: new Date(state.optimisticUserMessage.timestamp).toISOString(),
            data: {
              type: 'user',
              content: state.optimisticUserMessage.content,
              session_id: ''
            },
            memva_session_id: '',
            session_id: '',
            is_sidechain: false,
            parent_uuid: null,
            cwd: '',
            project_name: '',
            visible: true
          }
          
          // Check if real message has arrived
          const hasRealMessage = state.sortedEvents.some(e => {
            if (!state.optimisticUserMessage) return false
            
            // Skip if not a user event or if it's another optimistic message
            if (e.event_type !== 'user' || e.uuid?.startsWith('optimistic-')) {
              return false;
            }
            
            const messageText = getUserMessageText(e.data);
            const optimisticContent = state.optimisticUserMessage.content;
            
            // Check for exact content match
            if (messageText !== optimisticContent) {
              return false;
            }
            
            // Check if the timestamp is reasonably close (within 30 seconds)
            // This accounts for network delays and processing time
            const timeDiff = Math.abs(new Date(e.timestamp).getTime() - state.optimisticUserMessage.timestamp);
            const MAX_TIME_DIFF = 30000; // 30 seconds
            
            return timeDiff < MAX_TIME_DIFF;
          })
          
          if (!hasRealMessage) {
            // Return sorted events with optimistic message appended
            return [...state.sortedEvents, optimisticEvent]
          }
        }
        
        return state.sortedEvents
      },

      getDisplayEvents: () => {
        const state = get()
        
        // Handle optimistic message if needed
        if (state.optimisticUserMessage) {
          const hasRealMessage = state.displayEvents.some(e => {
            if (!state.optimisticUserMessage) return false
            
            // Skip if not a user event or if it's another optimistic message
            if (e.event_type !== 'user' || e.uuid?.startsWith('optimistic-')) {
              return false;
            }
            
            const messageText = getUserMessageText(e.data);
            const optimisticContent = state.optimisticUserMessage.content;
            
            // Check for exact content match
            if (messageText !== optimisticContent) {
              return false;
            }
            
            // Check if the timestamp is reasonably close (within 30 seconds)
            const timeDiff = Math.abs(new Date(e.timestamp).getTime() - state.optimisticUserMessage.timestamp);
            const MAX_TIME_DIFF = 30000; // 30 seconds
            
            return timeDiff < MAX_TIME_DIFF;
          })
          
          if (!hasRealMessage) {
            const optimisticEvent: Event = {
              uuid: `optimistic-${state.optimisticUserMessage.timestamp}`,
              event_type: 'user',
              timestamp: new Date(state.optimisticUserMessage.timestamp).toISOString(),
              data: {
                type: 'user',
                content: state.optimisticUserMessage.content,
                session_id: ''
              },
              memva_session_id: '',
              session_id: '',
              is_sidechain: false,
              parent_uuid: null,
              cwd: '',
              project_name: '',
              visible: true
            }
            return [...state.displayEvents, optimisticEvent]
          }
        }
        
        return state.displayEvents
      },

      getEventsByType: (type) => {
        const state = get()
        return Array.from(state.events.values())
          .filter(event => event.event_type === type)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      },

      getToolResult: (toolId) => {
        return get().toolResults.get(toolId)
      }
    }),
    {
      name: 'event-store'
    }
  )
)