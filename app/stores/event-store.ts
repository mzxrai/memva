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
        
        return {
          events: eventMap,
          toolResults: extractToolResults(events),
          lastEventTimestamp: lastTimestamp
        }
      }, false, 'setInitialEvents'),

      addEvents: (newEvents) => set((state) => {
        const updatedEvents = new Map(state.events)
        const updatedToolResults = new Map(state.toolResults)
        let lastTimestamp = state.lastEventTimestamp
        
        newEvents.forEach(event => {
          // Only add if not already present
          if (!updatedEvents.has(event.uuid)) {
            updatedEvents.set(event.uuid, event)
            
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
        
        return {
          events: updatedEvents,
          toolResults: updatedToolResults,
          lastEventTimestamp: lastTimestamp
        }
      }, false, 'addEvents'),

      updateToolResult: (toolId, result, isError = false) => set((state) => ({
        toolResults: new Map(state.toolResults).set(toolId, { result, isError })
      }), false, 'updateToolResult'),

      updateSessionStatus: (status) => set({ sessionStatus: status }, false, 'updateSessionStatus'),

      setOptimisticMessage: (message) => set({ optimisticUserMessage: message }, false, 'setOptimisticMessage'),

      clearEvents: () => set({
        events: new Map(),
        toolResults: new Map(),
        sessionStatus: null,
        lastEventTimestamp: null,
        optimisticUserMessage: null
      }, false, 'clearEvents'),

      // Selectors
      getSortedEvents: () => {
        const state = get()
        const events = Array.from(state.events.values())
        
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
            project_name: ''
          }
          
          // Check if real message has arrived
          const hasRealMessage = events.some(e => {
            if (!state.optimisticUserMessage) return false
            return e.event_type === 'user' &&
              !e.uuid?.startsWith('optimistic-') &&
              getUserMessageText(e.data) === state.optimisticUserMessage.content &&
              Math.abs(new Date(e.timestamp).getTime() - state.optimisticUserMessage.timestamp) < 10000
          })
          
          if (!hasRealMessage) {
            events.push(optimisticEvent)
          }
        }
        
        return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      },

      getDisplayEvents: () => {
        const events = get().getSortedEvents()
        
        return events.filter(event => {
          // Always exclude system and result events
          if (event.event_type === 'system' || event.event_type === 'result') {
            return false
          }
          
          // For user events, exclude if they contain only tool_result content
          if (event.event_type === 'user' && event.data && typeof event.data === 'object') {
            const data = event.data as Record<string, unknown>
            if ('message' in data && typeof data.message === 'object' && data.message) {
              const message = data.message as Record<string, unknown>
              if ('content' in message && Array.isArray(message.content)) {
                const hasNonToolResultContent = message.content.some((item: unknown) => 
                  item && typeof item === 'object' && 'type' in item && item.type !== 'tool_result'
                )
                if (!hasNonToolResultContent) {
                  return false
                }
              }
            }
          }
          
          return true
        })
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