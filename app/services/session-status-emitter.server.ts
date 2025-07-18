import { EventEmitter } from 'events'

export interface SessionStatusEvent {
  sessionId: string
  status: string
  timestamp: string
}

class SessionStatusEmitter extends EventEmitter {
  private static instance: SessionStatusEmitter

  private constructor() {
    super()
    // Increase max listeners to handle multiple SSE connections
    this.setMaxListeners(100)
  }

  static getInstance(): SessionStatusEmitter {
    if (!SessionStatusEmitter.instance) {
      SessionStatusEmitter.instance = new SessionStatusEmitter()
    }
    return SessionStatusEmitter.instance
  }

  emitStatusChange(sessionId: string, status: string) {
    const event: SessionStatusEvent = {
      sessionId,
      status,
      timestamp: new Date().toISOString()
    }
    
    console.log(`[SessionStatusEmitter] Emitting status change for session ${sessionId}: ${status}`)
    
    // Emit both a general event and a session-specific event
    this.emit('status-change', event)
    this.emit(`session:${sessionId}`, event)
  }

  onSessionStatusChange(sessionId: string, callback: (event: SessionStatusEvent) => void) {
    this.on(`session:${sessionId}`, callback)
  }

  offSessionStatusChange(sessionId: string, callback: (event: SessionStatusEvent) => void) {
    this.off(`session:${sessionId}`, callback)
  }
}

// Export singleton instance
export const sessionStatusEmitter = SessionStatusEmitter.getInstance()