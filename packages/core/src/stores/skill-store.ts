import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import type { Skill, AgentSkill, TaskSkill, SkillFilter, SkillStats, SkillStore } from '../types'

export class SqliteSkillStore implements SkillStore {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        parent_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_skills (
        agent_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        proficiency REAL NOT NULL DEFAULT 0,
        verified INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (agent_id, skill_id)
      );

      CREATE TABLE IF NOT EXISTS task_skills (
        task_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        min_proficiency REAL NOT NULL DEFAULT 0,
        required INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (task_id, skill_id)
      );
    `)
  }

  private rowToSkill(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      category: row.category,
      description: row.description,
      parent_id: row.parent_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }
  }

  private rowToAgentSkill(row: any): AgentSkill {
    return {
      agent_id: row.agent_id,
      skill_id: row.skill_id,
      proficiency: row.proficiency,
      verified: row.verified === 1,
      updated_at: new Date(row.updated_at),
    }
  }

  private rowToTaskSkill(row: any): TaskSkill {
    return {
      task_id: row.task_id,
      skill_id: row.skill_id,
      min_proficiency: row.min_proficiency,
      required: row.required === 1,
    }
  }

  async create(skill: Omit<Skill, 'id' | 'created_at' | 'updated_at'>): Promise<Skill> {
    const id = nanoid()
    const now = new Date().toISOString()
    this.db.prepare(`
      INSERT INTO skills (id, name, display_name, category, description, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, skill.name, skill.display_name, skill.category, skill.description, skill.parent_id, now, now)
    return this.get(id) as Promise<Skill>
  }

  async get(id: string): Promise<Skill | null> {
    const row = this.db.prepare('SELECT * FROM skills WHERE id = ?').get(id)
    return row ? this.rowToSkill(row) : null
  }

  async getByName(name: string): Promise<Skill | null> {
    const row = this.db.prepare('SELECT * FROM skills WHERE name = ?').get(name)
    return row ? this.rowToSkill(row) : null
  }

  async list(filter?: SkillFilter): Promise<Skill[]> {
    let sql = 'SELECT * FROM skills WHERE 1=1'
    const params: any[] = []

    if (filter?.category) {
      sql += ' AND category = ?'
      params.push(filter.category)
    }
    if (filter?.parent_id !== undefined) {
      sql += ' AND parent_id IS ?'
      params.push(filter.parent_id)
    }
    if (filter?.search) {
      sql += ' AND (name LIKE ? OR display_name LIKE ?)'
      const pattern = `%${filter.search}%`
      params.push(pattern, pattern)
    }

    sql += ' ORDER BY created_at DESC'

    if (filter?.limit) {
      sql += ' LIMIT ?'
      params.push(filter.limit)
    }

    const rows = this.db.prepare(sql).all(...params)
    return rows.map((row) => this.rowToSkill(row))
  }

  async update(id: string, patch: Partial<Skill>): Promise<Skill> {
    const existing = await this.get(id)
    if (!existing) throw new Error(`Skill ${id} not found`)

    const now = new Date().toISOString()
    const scalarKeys = ['name', 'display_name', 'category', 'description'] as const
    const sets: string[] = []
    const params: any[] = []

    for (const key of scalarKeys) {
      if (patch[key] !== undefined) {
        sets.push(`${key} = ?`)
        params.push(patch[key])
      }
    }

    if ('parent_id' in patch) {
      sets.push('parent_id = ?')
      params.push(patch.parent_id)
    }

    if (sets.length === 0) return existing

    sets.push('updated_at = ?')
    params.push(now)
    params.push(id)

    this.db.prepare(`UPDATE skills SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.get(id) as Promise<Skill>
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM agent_skills WHERE skill_id = ?').run(id)
    this.db.prepare('DELETE FROM task_skills WHERE skill_id = ?').run(id)
    this.db.prepare('DELETE FROM skills WHERE id = ?').run(id)
  }

  async addAgentSkill(agentId: string, skillId: string, proficiency: number): Promise<AgentSkill> {
    const now = new Date().toISOString()
    this.db.prepare(`
      INSERT INTO agent_skills (agent_id, skill_id, proficiency, verified, updated_at)
      VALUES (?, ?, ?, 0, ?)
      ON CONFLICT (agent_id, skill_id) DO UPDATE SET
        proficiency = excluded.proficiency,
        updated_at = excluded.updated_at
    `).run(agentId, skillId, proficiency, now)
    const row = this.db.prepare('SELECT * FROM agent_skills WHERE agent_id = ? AND skill_id = ?').get(agentId, skillId)
    return this.rowToAgentSkill(row)
  }

  async removeAgentSkill(agentId: string, skillId: string): Promise<void> {
    this.db.prepare('DELETE FROM agent_skills WHERE agent_id = ? AND skill_id = ?').run(agentId, skillId)
  }

  async getAgentSkills(agentId: string): Promise<AgentSkill[]> {
    const rows = this.db.prepare('SELECT * FROM agent_skills WHERE agent_id = ?').all(agentId)
    return rows.map((row) => this.rowToAgentSkill(row))
  }

  async updateProficiency(agentId: string, skillId: string, proficiency: number): Promise<AgentSkill> {
    const now = new Date().toISOString()
    const result = this.db.prepare(`
      UPDATE agent_skills SET proficiency = ?, updated_at = ?
      WHERE agent_id = ? AND skill_id = ?
    `).run(proficiency, now, agentId, skillId)
    if (result.changes === 0) throw new Error(`AgentSkill (${agentId}, ${skillId}) not found`)
    const row = this.db.prepare('SELECT * FROM agent_skills WHERE agent_id = ? AND skill_id = ?').get(agentId, skillId)
    return this.rowToAgentSkill(row)
  }

  async addTaskSkill(taskId: string, skillId: string, minProficiency: number, required: boolean): Promise<TaskSkill> {
    this.db.prepare(`
      INSERT INTO task_skills (task_id, skill_id, min_proficiency, required)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (task_id, skill_id) DO UPDATE SET
        min_proficiency = excluded.min_proficiency,
        required = excluded.required
    `).run(taskId, skillId, minProficiency, required ? 1 : 0)
    const row = this.db.prepare('SELECT * FROM task_skills WHERE task_id = ? AND skill_id = ?').get(taskId, skillId)
    return this.rowToTaskSkill(row)
  }

  async removeTaskSkill(taskId: string, skillId: string): Promise<void> {
    this.db.prepare('DELETE FROM task_skills WHERE task_id = ? AND skill_id = ?').run(taskId, skillId)
  }

  async getTaskSkills(taskId: string): Promise<TaskSkill[]> {
    const rows = this.db.prepare('SELECT * FROM task_skills WHERE task_id = ?').all(taskId)
    return rows.map((row) => this.rowToTaskSkill(row))
  }

  async stats(): Promise<SkillStats> {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM skills').get() as any).count

    const categoryRows = this.db.prepare('SELECT category, COUNT(*) as count FROM skills GROUP BY category').all() as any[]
    const by_category: Record<string, number> = {}
    for (const row of categoryRows) {
      by_category[row.category] = row.count
    }

    const topRows = this.db.prepare(`
      SELECT s.id as skill_id, s.name, COUNT(a.agent_id) as agent_count
      FROM skills s
      LEFT JOIN agent_skills a ON s.id = a.skill_id
      GROUP BY s.id
      ORDER BY agent_count DESC
      LIMIT 10
    `).all() as any[]
    const top_skills = topRows.map((row) => ({
      skill_id: row.skill_id,
      name: row.name,
      agent_count: row.agent_count,
    }))

    return { total, by_category, top_skills }
  }
}
