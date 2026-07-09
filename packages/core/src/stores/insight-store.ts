// packages/core/src/stores/insight-store.ts
// SQLite Insight Store 实现

import Database from 'better-sqlite3'
import { Insight, InsightStore } from '../types'

export class SqliteInsightStore implements InsightStore {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS insights (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target_entity_id TEXT,
        content TEXT,
        channel TEXT,
        created_at TEXT,
        delivered_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type, delivered_at);
    `)
  }

  async save(insight: Insight): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO insights (id, type, target_entity_id, content, channel, created_at, delivered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        delivered_at = excluded.delivered_at
    `)

    stmt.run(
      insight.id,
      insight.type,
      insight.target_entity_id,
      JSON.stringify(insight.content),
      insight.channel,
      new Date().toISOString(),
      insight.delivered_at?.toISOString()
    )
  }

  async list(type?: string, limit: number = 50): Promise<Insight[]> {
    let sql = 'SELECT * FROM insights'
    const params: any[] = []

    if (type) {
      sql += ' WHERE type = ?'
      params.push(type)
    }

    sql += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const rows = this.db.prepare(sql).all(...params) as any[]

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      target_entity_id: row.target_entity_id,
      content: JSON.parse(row.content || '{}'),
      channel: row.channel,
      delivered_at: row.delivered_at ? new Date(row.delivered_at) : new Date(),
    }))
  }

  async get(id: string): Promise<Insight | null> {
    const row = this.db.prepare('SELECT * FROM insights WHERE id = ?').get(id) as any
    if (!row) return null

    return {
      id: row.id,
      type: row.type,
      target_entity_id: row.target_entity_id,
      content: JSON.parse(row.content || '{}'),
      channel: row.channel,
      delivered_at: row.delivered_at ? new Date(row.delivered_at) : new Date(),
    }
  }
}
