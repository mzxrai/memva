import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  status: text('status').notNull(),
  project_path: text('project_path').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  claude_status: text('claude_status').default('not_started'),
  settings: text('settings', { mode: 'json' })
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
  memva_session_id: text('memva_session_id'),
  visible: integer('visible', { mode: 'boolean' }).default(true)
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

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default('singleton'),
  config: text('config', { mode: 'json' }).notNull().default('{}'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
})

export const permissionRequests = sqliteTable('permission_requests', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull(),
  tool_name: text('tool_name').notNull(),
  tool_use_id: text('tool_use_id'),
  input: text('input', { mode: 'json' }).notNull(),
  status: text('status').notNull().default('pending'), // pending, approved, denied, timeout, expired, superseded, cancelled
  decision: text('decision'), // allow, deny
  decided_at: text('decided_at'),
  created_at: text('created_at').notNull(),
  expires_at: text('expires_at').notNull()
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
export type Settings = typeof settings.$inferSelect
export type NewSettings = typeof settings.$inferInsert
export type PermissionRequest = typeof permissionRequests.$inferSelect
export type NewPermissionRequest = typeof permissionRequests.$inferInsert