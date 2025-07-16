import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  status: text('status').notNull(),
  project_path: text('project_path').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  claude_status: text('claude_status').default('not_started')
})

export const events = sqliteTable('events', {
  uuid: text('uuid').primaryKey(),
  session_id: text('session_id').notNull(),
  event_type: text('event_type').notNull(),
  timestamp: text('timestamp').notNull(),
  is_sidechain: integer('is_sidechain', { mode: 'boolean' }).default(false),
  parent_uuid: text('parent_uuid'),
  cwd: text('cwd').notNull(),
  project_name: text('project_name').notNull(),
  data: text('data', { mode: 'json' }).notNull(),
  memva_session_id: text('memva_session_id')
})

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  data: text('data', { mode: 'json' }).notNull(),
  status: text('status').notNull(),
  priority: integer('priority').default(0),
  attempts: integer('attempts').default(0),
  max_attempts: integer('max_attempts').default(3),
  error: text('error'),
  result: text('result', { mode: 'json' }),
  scheduled_at: text('scheduled_at'),
  started_at: text('started_at'),
  completed_at: text('completed_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert