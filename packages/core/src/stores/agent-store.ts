// packages/core/src/stores/agent-store.ts
// SQLite Agent Store 实现

import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import type { Agent, AgentFilter, AgentStats, AgentType, AgentStore, CreditEntry } from '../types'

export class SqliteAgentStore implements AgentStore {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'human',
        email TEXT,
        avatar_url TEXT,
        skills TEXT NOT NULL DEFAULT '[]',
        bio TEXT NOT NULL DEFAULT '',
        credit_score REAL NOT NULL DEFAULT 100,
        credit_history TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        max_concurrent_tasks INTEGER NOT NULL DEFAULT 3,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        tasks_cancelled INTEGER NOT NULL DEFAULT 0,
        avg_contribution_score REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_active_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
    `)
  }

  private rowToAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      type: row.type as AgentType,
      email: row.email,
      avatar_url: row.avatar_url,
      skills: JSON.parse(row.skills || '[]'),
      bio: row.bio,
      credit_score: row.credit_score,
      credit_history: JSON.parse(row.credit_history || '[]').map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
      status: row.status,
      max_concurrent_tasks: row.max_concurrent_tasks,
      tasks_completed: row.tasks_completed,
      tasks_cancelled: row.tasks_cancelled,
      avg_contribution_score: row.avg_contribution_score,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      last_active_at: row.last_active_at ? new Date(row.last_active_at) : null,
    }
  }

  async create(agent: Omit<Agent, 'id' | 'created_at' | 'updated_at' | 'credit_score' | 'credit_history' | 'tasks_completed' | 'tasks_cancelled' | 'avg_contribution_score'>): Promise<Agent> {
    const id = nanoid()
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO agents (id, name, type, email, avatar_url, skills, bio,
        credit_score, credit_history, status, max_concurrent_tasks,
        tasks_completed, tasks_cancelled, avg_contribution_score,
        created_at, updated_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 100, '[]', ?, ?, 0, 0, NULL, ?, ?, ?)
    `)
    stmt.run(
      id,
      agent.name,
      agent.type,
      agent.email ?? null,
      agent.avatar_url ?? null,
      JSON.stringify(agent.skills),
      agent.bio,
      agent.status,
      agent.max_concurrent_tasks,
      now,
      now,
      agent.last_active_at?.toISOString() ?? null,
    )
    return this.get(id) as Promise<Agent>
  }

  async get(id: string): Promise<Agent | null> {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id)
    if (!row) return null
    return this.rowToAgent(row)
  }

  async update(id: string, patch: Partial<Agent>): Promise<Agent> {
    const existing = await this.get(id)
    if (!existing) throw new Error(`Agent ${id} not found`)

    const fields: string[] = []
    const params: any[] = []

    const scalarKeys = ['name', 'type', 'email', 'avatar_url', 'bio', 'status', 'max_concurrent_tasks', 'tasks_completed', 'tasks_cancelled', 'avg_contribution_score', 'credit_score'] as const
    for (const key of scalarKeys) {
      if (key in patch) {
        fields.push(`${key} = ?`)
        params.push(patch[key])
      }
    }

    const dateKeys = ['last_active_at'] as const
    for (const key of dateKeys) {
      if (key in patch) {
        fields.push(`${key} = ?`)
        params.push(patch[key]?.toISOString() ?? null)
      }
    }

    if ('skills' in patch) {
      fields.push('skills = ?')
      params.push(JSON.stringify(patch.skills))
    }

    if ('credit_history' in patch) {
      fields.push('credit_history = ?')
      params.push(JSON.stringify(patch.credit_history))
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    params.push(id)
    this.db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...params)

    return this.get(id) as Promise<Agent>
  }

  async list(filter?: AgentFilter): Promise<Agent[]> {
    let sql = 'SELECT * FROM agents WHERE 1=1'
    const params: any[] = []

    if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status) }
    if (filter?.type) { sql += ' AND type = ?'; params.push(filter.type) }
    if (filter?.skill) { sql += " AND skills LIKE ?"; params.push(`%"${filter.skill}"%`) }
    if (filter?.min_credit != null) { sql += ' AND credit_score >= ?'; params.push(filter.min_credit) }

    sql += ' ORDER BY created_at DESC'

    if (filter?.limit) { sql += ' LIMIT ?'; params.push(filter.limit) }

    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(row => this.rowToAgent(row))
  }

  async adjustCredit(agentId: string, entry: CreditEntry): Promise<Agent> {
    const agent = await this.get(agentId)
    if (!agent) throw new Error(`Agent ${agentId} not found`)

    const newHistory = [...agent.credit_history, entry]
    const newScore = Math.max(0, Math.min(200, agent.credit_score + entry.delta))

    await this.update(agentId, {
      credit_score: newScore,
      credit_history: newHistory,
    })

    return this.get(agentId) as Promise<Agent>
  }

  async findBySkills(skills: string[], excludeAgentIds: string[] = []): Promise<Agent[]> {
    if (skills.length === 0) return []

    const conditions = skills.map(() => 'skills LIKE ?')
    const params: any[] = skills.map(s => `%"${s}"%`)

    let sql = `SELECT * FROM agents WHERE status = 'active' AND (${conditions.join(' OR ')})`

    if (excludeAgentIds.length > 0) {
      const placeholders = excludeAgentIds.map(() => '?').join(', ')
      sql += ` AND id NOT IN (${placeholders})`
      params.push(...excludeAgentIds)
    }

    sql += ' ORDER BY credit_score DESC'

    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(row => this.rowToAgent(row))
  }

  async stats(): Promise<AgentStats> {
    const rows = this.db.prepare(
      'SELECT type, status, COUNT(*) as count FROM agents GROUP BY type, status'
    ).all() as { type: string; status: string; count: number }[]

    const byType: Record<AgentType, number> = { human: 0, ai: 0 }
    const byStatus: Record<string, number> = { active: 0, inactive: 0, suspended: 0 }
    let total = 0

    for (const row of rows) {
      byType[row.type as AgentType] = (byType[row.type as AgentType] || 0) + row.count
      byStatus[row.status] = (byStatus[row.status] || 0) + row.count
      total += row.count
    }

    const avgRow = this.db.prepare(
      'SELECT AVG(credit_score) as avg_credit FROM agents'
    ).get() as { avg_credit: number | null }

    return {
      total,
      by_type: byType,
      by_status: byStatus,
      avg_credit_score: avgRow.avg_credit ?? 0,
    }
  }
}
