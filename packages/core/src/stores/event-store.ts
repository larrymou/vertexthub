// packages/core/src/stores/event-store.ts
// SQLite Event Store 实现

import Database from 'better-sqlite3'
import { RawEvent, EventFilter, EventStore } from '../types'

export class SqliteEventStore implements EventStore {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS raw_events (
        id TEXT PRIMARY KEY,
        connector_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        entity_refs TEXT,
        checksum TEXT,
        timestamp TEXT,
        ingested_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_events_connector ON raw_events(connector_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON raw_events(type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON raw_events(timestamp);
    `)
  }

  async append(event: RawEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO raw_events (id, connector_id, type, payload, entity_refs, checksum, timestamp, ingested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      event.id,
      event.connector_id,
      event.type,
      JSON.stringify(event.payload),
      JSON.stringify(event.entity_refs),
      event.checksum,
      event.timestamp.toISOString(),
      event.ingested_at.toISOString()
    )
  }

  async query(filter: EventFilter): Promise<RawEvent[]> {
    let sql = 'SELECT * FROM raw_events WHERE 1=1'
    const params: any[] = []

    if (filter.connector_id) {
      sql += ' AND connector_id = ?'
      params.push(filter.connector_id)
    }

    if (filter.type) {
      sql += ' AND type = ?'
      params.push(filter.type)
    }

    if (filter.since) {
      sql += ' AND timestamp >= ?'
      params.push(filter.since.toISOString())
    }

    if (filter.until) {
      sql += ' AND timestamp <= ?'
      params.push(filter.until.toISOString())
    }

    sql += ' ORDER BY timestamp DESC'

    if (filter.limit) {
      sql += ' LIMIT ?'
      params.push(filter.limit)
    }

    const rows = this.db.prepare(sql).all(...params) as any[]

    return rows.map(row => ({
      id: row.id,
      connector_id: row.connector_id,
      type: row.type,
      payload: JSON.parse(row.payload),
      entity_refs: JSON.parse(row.entity_refs || '[]'),
      checksum: row.checksum,
      timestamp: new Date(row.timestamp),
      ingested_at: new Date(row.ingested_at),
    }))
  }
}
