import { EventEmitter } from 'events'
import type { Event } from '../db/schema'

export interface SessionUpdateData {
  status?: string
  title?: string
  updated_at: string
}

export interface MessageData {
  uuid: string
  timestamp: string
  data: unknown
}

export interface HomepageEvent {
  type: 'session_updated' | 'message_created' | 'event_created'
  sessionId: string
  data?: SessionUpdateData | MessageData | Event
  timestamp: string
}

class HomepageEventsEmitter extends EventEmitter {
  private static instance: HomepageEventsEmitter

  private constructor() {
    super()
    this.setMaxListeners(100)
  }

  static getInstance(): HomepageEventsEmitter {
    if (!HomepageEventsEmitter.instance) {
      HomepageEventsEmitter.instance = new HomepageEventsEmitter()
    }
    return HomepageEventsEmitter.instance
  }

  emitSessionUpdate(sessionId: string, data: SessionUpdateData) {
    const event: HomepageEvent = {
      type: 'session_updated',
      sessionId,
      data,
      timestamp: new Date().toISOString()
    }
    
    console.log(`[HomepageEvents] Emitting session update for ${sessionId}`)
    this.emit('homepage_update', event)
  }

  emitMessageCreated(sessionId: string, message: MessageData) {
    const event: HomepageEvent = {
      type: 'message_created',
      sessionId,
      data: message,
      timestamp: new Date().toISOString()
    }
    
    console.log(`[HomepageEvents] Emitting message created for ${sessionId}`)
    this.emit('homepage_update', event)
  }

  emitEventCreated(sessionId: string, event: Event) {
    const homepageEvent: HomepageEvent = {
      type: 'event_created',
      sessionId,
      data: event,
      timestamp: new Date().toISOString()
    }
    
    console.log(`[HomepageEvents] Emitting event created for ${sessionId}`)
    this.emit('homepage_update', homepageEvent)
  }
}

export const homepageEvents = HomepageEventsEmitter.getInstance()