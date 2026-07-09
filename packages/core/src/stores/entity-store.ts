// packages/core/src/stores/entity-store.ts
// SQLite Entity Store 实现

import Database from 'better-sqlite3'
import { Entity, EntityStore } from '../types'

export class SqliteEntityStore implements EntityStore {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT,
        attributes TEXT,
        consistency_status TEXT DEFAULT 'unknown',
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS entity_mappings (
        entity_id TEXT,
        connector_id TEXT NOT NULL,
        external_id TEXT NOT NULL,
        last_synced TEXT,
        PRIMARY KEY (entity_id, connector_id),
        FOREIGN KEY (entity_id) REFERENCES entities(id)
      );

      CREATE TABLE IF NOT EXISTS entity_evidence (
        id TEXT PRIMARY KEY,
        entity_id TEXT,
        source TEXT NOT NULL,
        confidence REAL,
        raw_event_id TEXT,
        FOREIGN KEY (entity_id) REFERENCES entities(id)
      );

      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);
      CREATE INDEX IF NOT EXISTS idx_mappings_external ON entity_mappings(connector_id, external_id);
    `)
  }

  async upsert(entity: Entity): Promise<void> {
    const now = new Date().toISOString()

    // Upsert entity
    const stmt = this.db.prepare(`
      INSERT INTO entities (id, type, status, attributes, consistency_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        status = excluded.status,
        attributes = excluded.attributes,
        consistency_status = excluded.consistency_status,
        updated_at = excluded.updated_at
    `)

    stmt.run(
      entity.id,
      entity.type,
      entity.consistency.status,
      JSON.stringify(entity.attributes),
      entity.consistency.status,
      now,
      now
    )

    // Upsert mappings
    const mappingStmt = this.db.prepare(`
      INSERT INTO entity_mappings (entity_id, connector_id, external_id, last_synced)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(entity_id, connector_id) DO UPDATE SET
        external_id = excluded.external_id,
        last_synced = excluded.last_synced
    `)

    for (const mapping of entity.source_mappings) {
      mappingStmt.run(
        entity.id,
        mapping.connector_id,
        mapping.external_id,
        mapping.last_synced.toISOString()
      )
    }

    // Upsert evidence
    const evidenceStmt = this.db.prepare(`
      INSERT INTO entity_evidence (id, entity_id, source, confidence, raw_event_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        confidence = excluded.confidence
    `)

    for (const evidence of entity.evidence) {
      evidenceStmt.run(
        `${entity.id}-${evidence.source}-${evidence.raw_event_id}`,
        entity.id,
        evidence.source,
        evidence.confidence,
        evidence.raw_event_id
      )
    }
  }

  async get(id: string): Promise<Entity | null> {
    const row = this.db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as any
    if (!row) return null

    const mappings = this.db.prepare(
      'SELECT * FROM entity_mappings WHERE entity_id = ?'
    ).all(id) as any[]

    const evidence = this.db.prepare(
      'SELECT * FROM entity_evidence WHERE entity_id = ?'
    ).all(id) as any[]

    return {
      id: row.id,
      type: row.type,
      attributes: JSON.parse(row.attributes || '{}'),
      source_mappings: mappings.map(m => ({
        connector_id: m.connector_id,
        external_id: m.external_id,
        last_synced: new Date(m.last_synced),
      })),
      evidence: evidence.map(e => ({
        source: e.source,
        confidence: e.confidence,
        raw_event_id: e.raw_event_id,
      })),
      consistency: {
        status: row.consistency_status || 'unknown',
        conflicts: [],
        last_checked: new Date(row.updated_at),
      },
    }
  }

  async search(query: string): Promise<Entity[]> {
    const rows = this.db.prepare(
      "SELECT * FROM entities WHERE attributes LIKE ? LIMIT 50"
    ).all(`%${query}%`) as any[]

    return Promise.all(rows.map(r => this.get(r.id))) as Promise<Entity[]>
  }

  async list(type?: string): Promise<Entity[]> {
    let sql = 'SELECT id FROM entities'
    const params: any[] = []

    if (type) {
      sql += ' WHERE type = ?'
      params.push(type)
    }

    sql += ' ORDER BY updated_at DESC LIMIT 100'

    const rows = this.db.prepare(sql).all(...params) as any[]
    return Promise.all(rows.map(r => this.get(r.id))) as Promise<Entity[]>
  }
}
