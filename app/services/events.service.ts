import { v4 as uuidv4 } from 'uuid'
import { db, events, type NewEvent } from '../db'
import type { SDKMessage } from '@anthropic-ai/claude-code'

interface CreateEventOptions {
  message: SDKMessage
  sessionId: string
  memvaSessionId: string
  projectPath: string
  parentUuid: string | null
}

export function createEventFromMessage({
  message,
  sessionId,
  memvaSessionId,
  projectPath,
  parentUuid
}: CreateEventOptions): NewEvent {
  const pathParts = projectPath.split('/')
  const projectName = pathParts[pathParts.length - 1] || 'root'

  return {
    uuid: uuidv4(),
    session_id: sessionId,
    event_type: message.type,
    timestamp: message.timestamp || new Date().toISOString(),
    is_sidechain: false,
    parent_uuid: parentUuid,
    cwd: projectPath,
    project_name: projectName,
    data: message,
    memva_session_id: memvaSessionId
  }
}

export async function storeEvent(event: NewEvent): Promise<void> {
  await db.insert(events).values(event).execute()
}