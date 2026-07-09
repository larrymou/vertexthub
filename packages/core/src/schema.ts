// packages/core/src/schema.ts
// SQLite Schema 定义 (Drizzle ORM)

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ═══════════════════════════════════════════════════════════════
// 系统表
// ═══════════════════════════════════════════════════════════════

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  password_hash: text('password_hash'),
  role: text('role').notNull().default('viewer'),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
})

export const connectors = sqliteTable('connectors', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  config: text('config').notNull(),
  credentials_encrypted: text('credentials_encrypted').notNull(),
  schedule: text('schedule').default('*/15 * * * *'),
  enabled: integer('enabled').default(1),
  last_sync_at: text('last_sync_at'),
  last_error: text('last_error'),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
})

export const audit_logs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').references(() => users.id),
  action: text('action').notNull(),
  resource_type: text('resource_type').notNull(),
  resource_id: text('resource_id'),
  details: text('details'),
  timestamp: text('timestamp'),
})

// ═══════════════════════════════════════════════════════════════
// 领域表
// ═══════════════════════════════════════════════════════════════

export const raw_events = sqliteTable('raw_events', {
  id: text('id').primaryKey(),
  connector_id: text('connector_id').notNull(),
  type: text('type').notNull(),
  payload: text('payload').notNull(),  // JSON
  entity_refs: text('entity_refs'),    // JSON array
  checksum: text('checksum'),
  timestamp: text('timestamp'),
  ingested_at: text('ingested_at'),
})

export const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status'),
  attributes: text('attributes'),      // JSON
  consistency_status: text('consistency_status').default('unknown'),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
})

export const entity_mappings = sqliteTable('entity_mappings', {
  entity_id: text('entity_id').references(() => entities.id),
  connector_id: text('connector_id').notNull(),
  external_id: text('external_id').notNull(),
  last_synced: text('last_synced'),
})

export const insights = sqliteTable('insights', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  target_entity_id: text('target_entity_id'),
  content: text('content'),            // JSON
  channel: text('channel'),
  created_at: text('created_at'),
  delivered_at: text('delivered_at'),
})
