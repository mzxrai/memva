import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  status: text('status').notNull(),
  project_path: text('project_path').notNull(),
  metadata: text('metadata', { mode: 'json' })
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

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert