import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

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
  file_path: text('file_path').notNull(),
  line_number: integer('line_number').notNull(),
  synced_at: text('synced_at').default(sql`CURRENT_TIMESTAMP`)
})