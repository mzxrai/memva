#!/usr/bin/env tsx

import { createSession, updateSession } from '../app/db/sessions.service'
import { db, events } from '../app/db'
import { v4 as uuidv4 } from 'uuid'

async function createDummySessions() {
  console.log('Creating dummy sessions...')

  // Session 1: Active session with many events
  const session1 = await createSession({
    title: 'Implementing Dark Mode Feature',
    project_path: '/Users/dev/projects/awesome-app',
    metadata: {
      framework: 'React',
      description: 'Adding dark mode support to the application'
      // Note: No should_auto_start flag - this is a dummy session, not from homepage
    }
  })
  console.log('Created session 1:', session1.id)

  // Add some events to session 1
  const baseTime1 = new Date('2025-01-13T10:00:00Z')
  for (let i = 0; i < 15; i++) {
    await db.insert(events).values({
      uuid: uuidv4(),
      session_id: `claude-session-${session1.id}`,
      memva_session_id: session1.id,
      event_type: i % 3 === 0 ? 'user' : i % 3 === 1 ? 'assistant' : 'summary',
      timestamp: new Date(baseTime1.getTime() + i * 5 * 60 * 1000).toISOString(),
      is_sidechain: false,
      cwd: session1.project_path,
      project_name: 'awesome-app',
      data: { content: `Event ${i + 1}` }
    }).execute()
  }

  // Session 2: Quick bug fix session
  const session2 = await createSession({
    title: 'Fix Authentication Bug',
    project_path: '/Users/dev/projects/auth-service',
    metadata: {
      issue_number: '#1234',
      priority: 'high'
      // Note: No should_auto_start flag - this is a dummy session, not from homepage
    }
  })
  console.log('Created session 2:', session2.id)

  // Add a few events to session 2
  const baseTime2 = new Date('2025-01-13T14:30:00Z')
  for (let i = 0; i < 5; i++) {
    await db.insert(events).values({
      uuid: uuidv4(),
      session_id: `claude-session-${session2.id}`,
      memva_session_id: session2.id,
      event_type: i % 2 === 0 ? 'user' : 'assistant',
      timestamp: new Date(baseTime2.getTime() + i * 2 * 60 * 1000).toISOString(),
      is_sidechain: false,
      cwd: session2.project_path,
      project_name: 'auth-service',
      data: { content: `Fix event ${i + 1}` }
    }).execute()
  }

  // Session 3: Untitled session (no title)
  const session3 = await createSession({
    project_path: '/Users/dev/projects/experiment'
  })
  console.log('Created session 3:', session3.id)

  // Add events to session 3
  const baseTime3 = new Date('2025-01-12T16:00:00Z')
  for (let i = 0; i < 8; i++) {
    await db.insert(events).values({
      uuid: uuidv4(),
      session_id: `claude-session-${session3.id}`,
      memva_session_id: session3.id,
      event_type: i % 2 === 0 ? 'user' : 'assistant',
      timestamp: new Date(baseTime3.getTime() + i * 10 * 60 * 1000).toISOString(),
      is_sidechain: i === 4,
      cwd: session3.project_path,
      project_name: 'experiment',
      data: { content: `Experiment ${i + 1}` }
    }).execute()
  }

  // Session 4: Database migration session
  const session4 = await createSession({
    title: 'Database Schema Migration',
    project_path: '/Users/dev/projects/backend-api',
    metadata: {
      database: 'PostgreSQL',
      migration_version: 'v2.0'
      // Note: No should_auto_start flag - this is a dummy session, not from homepage
    }
  })
  console.log('Created session 4:', session4.id)

  // Add events to session 4
  const baseTime4 = new Date('2025-01-11T09:00:00Z')
  for (let i = 0; i < 20; i++) {
    await db.insert(events).values({
      uuid: uuidv4(),
      session_id: `claude-session-${session4.id}`,
      memva_session_id: session4.id,
      event_type: i % 4 === 0 ? 'user' : i % 4 === 1 ? 'assistant' : 'summary',
      timestamp: new Date(baseTime4.getTime() + i * 3 * 60 * 1000).toISOString(),
      is_sidechain: false,
      cwd: session4.project_path,
      project_name: 'backend-api',
      data: { content: `Migration step ${i + 1}` }
    }).execute()
  }

  // Session 5: Empty session (no events) - this was causing the auto-resume bug!
  const session5 = await createSession({
    title: 'Planning New Feature',
    project_path: '/Users/dev/projects/mobile-app',
    metadata: {
      platform: 'React Native',
      target: 'iOS and Android'
      // Note: No should_auto_start flag - this is a dummy session, not from homepage
    }
  })
  console.log('Created session 5:', session5.id)

  // Session 6: Archived session
  const session6 = await createSession({
    title: 'Legacy Code Refactoring',
    project_path: '/Users/dev/projects/legacy-system',
    metadata: {
      completed: true,
      lines_refactored: 1500
      // Note: No should_auto_start flag - this is a dummy session, not from homepage
    }
  })
  
  // Update session 6 to archived status
  await updateSession(session6.id, { status: 'archived' })
  
  console.log('Created session 6 (archived):', session6.id)

  // Add events to session 6
  const baseTime6 = new Date('2025-01-10T11:00:00Z')
  for (let i = 0; i < 12; i++) {
    await db.insert(events).values({
      uuid: uuidv4(),
      session_id: `claude-session-${session6.id}`,
      memva_session_id: session6.id,
      event_type: i % 2 === 0 ? 'user' : 'assistant',
      timestamp: new Date(baseTime6.getTime() + i * 7 * 60 * 1000).toISOString(),
      is_sidechain: false,
      cwd: session6.project_path,
      project_name: 'legacy-system',
      data: { content: `Refactor ${i + 1}` }
    }).execute()
  }

  console.log('\nSuccessfully created 6 dummy sessions!')
  console.log('- 5 active sessions')
  console.log('- 1 archived session')
  console.log('- Various event counts and types')
  
  process.exit(0)
}

createDummySessions().catch(error => {
  console.error('Error creating dummy sessions:', error)
  process.exit(1)
})