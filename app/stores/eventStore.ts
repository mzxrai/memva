import { create } from 'zustand'
import type { Event } from '../db/schema'

interface ToolResultData {
  result: { tool_use_id: string; content: unknown; is_error?: boolean }
  isError: boolean
}

export interface EventStore {
  // State
  events: Map<string, Event[]> // sessionId -> events array
  toolResults: Map<string, ToolResultData> // tool_use_id -> tool_result data
  sessionStatus: Map<string, string> // sessionId -> status

  // Actions
  setInitialEvents: (sessionId: string, events: Event[]) => void
  addEvent: (sessionId: string, event: Event) => void
  addEvents: (sessionId: string, events: Event[]) => void
  setSessionStatus: (sessionId: string, status: string) => void
  clearSession: (sessionId: string) => void

  // Selectors
  getSessionEvents: (sessionId: string) => Event[]
  getToolResult: (toolUseId: string) => Event | undefined
  getSessionStatus: (sessionId: string) => string | undefined
}

export const useEventStore = create<EventStore>((set, get) => ({
  // State
  events: new Map(),
  toolResults: new Map(),
  sessionStatus: new Map(),

  // Actions
  setInitialEvents: (sessionId: string, events: Event[]) => {
    set((state) => {
      const newEventsMap = new Map(state.events)
      const newToolResults = new Map(state.toolResults)

      // Store events by session
      newEventsMap.set(sessionId, events)

      // Extract tool results
      events.forEach(event => {
        if (event.event_type === 'tool_result' && event.tool_use_id) {
          newToolResults.set(event.tool_use_id, event)
        }
      })

      return {
        events: newEventsMap,
        toolResults: newToolResults
      }
    })
  },

  addEvent: (sessionId: string, event: Event) => {
    set((state) => {
      const newEventsMap = new Map(state.events)
      const newToolResults = new Map(state.toolResults)

      // Get existing events for this session
      const existingEvents = newEventsMap.get(sessionId) || []

      // Check for duplicates
      const isDuplicate = existingEvents.some(existing => existing.uuid === event.uuid)
      if (isDuplicate) {
        return state // No change if duplicate
      }

      // Add new event
      const updatedEvents = [...existingEvents, event]
      newEventsMap.set(sessionId, updatedEvents)

      // Update tool results if this is a tool result
      if (event.event_type === 'tool_result' && event.tool_use_id) {
        newToolResults.set(event.tool_use_id, event)
      }

      return {
        events: newEventsMap,
        toolResults: newToolResults
      }
    })
  },

  addEvents: (sessionId: string, newEvents: Event[]) => {
    set((state) => {
      const newEventsMap = new Map(state.events)
      const newToolResults = new Map(state.toolResults)

      // Get existing events for this session
      const existingEvents = newEventsMap.get(sessionId) || []
      const existingUUIDs = new Set(existingEvents.map(e => e.uuid))

      // Filter out duplicates
      const uniqueNewEvents = newEvents.filter(event => !existingUUIDs.has(event.uuid))

      if (uniqueNewEvents.length === 0) {
        return state // No new events to add
      }

      // Add new events
      const updatedEvents = [...existingEvents, ...uniqueNewEvents]
      newEventsMap.set(sessionId, updatedEvents)

      // Update tool results
      uniqueNewEvents.forEach(event => {
        if (event.event_type === 'tool_result' && event.tool_use_id) {
          newToolResults.set(event.tool_use_id, event)
        }
      })

      return {
        events: newEventsMap,
        toolResults: newToolResults
      }
    })
  },

  setSessionStatus: (sessionId: string, status: string) => {
    set((state) => {
      const newSessionStatus = new Map(state.sessionStatus)
      newSessionStatus.set(sessionId, status)
      return { sessionStatus: newSessionStatus }
    })
  },

  clearSession: (sessionId: string) => {
    set((state) => {
      const newEventsMap = new Map(state.events)
      const newSessionStatus = new Map(state.sessionStatus)

      newEventsMap.delete(sessionId)
      newSessionStatus.delete(sessionId)

      // Note: We're not clearing tool results as they might be referenced by other sessions
      // In practice, tool_use_ids should be unique across sessions anyway

      return {
        events: newEventsMap,
        sessionStatus: newSessionStatus
      }
    })
  },

  // Selectors
  getSessionEvents: (sessionId: string) => {
    const state = get()
    return state.events.get(sessionId) || []
  },

  getToolResult: (toolUseId: string) => {
    const state = get()
    return state.toolResults.get(toolUseId)
  },

  getSessionStatus: (sessionId: string) => {
    const state = get()
    return state.sessionStatus.get(sessionId)
  }
}))

// Selector hooks for better performance
export const useSessionEvents = (sessionId: string) =>
  useEventStore(state => state.events.get(sessionId) || [])

export const useToolResult = (toolUseId: string | undefined) =>
  useEventStore(state => toolUseId ? state.toolResults.get(toolUseId) : undefined)

export const useSessionStatus = (sessionId: string) =>
  useEventStore(state => state.sessionStatus.get(sessionId)) 