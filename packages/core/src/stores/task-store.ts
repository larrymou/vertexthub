// packages/core/src/stores/task-store.ts
// SQLite Task Store 实现

import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import type { Task, TaskFilter, TaskStats, TaskStatus, TaskStore } from '../types'

export class SqliteTaskStore implements TaskStore {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        type TEXT NOT NULL DEFAULT 'task',
        creator_id TEXT NOT NULL,
        assignee_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        deadline TEXT,
        entity_refs TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        deliverables TEXT NOT NULL DEFAULT '[]',
        contribution_score REAL,
        review_notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id);
    `)
  }

  private rowToTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status as TaskStatus,
      priority: row.priority,
      type: row.type,
      creator_id: row.creator_id,
      assignee_id: row.assignee_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      started_at: row.started_at ? new Date(row.started_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      deadline: row.deadline ? new Date(row.deadline) : null,
      entity_refs: JSON.parse(row.entity_refs || '[]'),
      tags: JSON.parse(row.tags || '[]'),
      deliverables: JSON.parse(row.deliverables || '[]'),
      contribution_score: row.contribution_score,
      review_notes: row.review_notes,
    }
  }

  async create(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const id = nanoid()
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, type, creator_id, assignee_id,
        created_at, updated_at, started_at, completed_at, deadline,
        entity_refs, tags, deliverables, contribution_score, review_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.type,
      task.creator_id,
      task.assignee_id,
      now,
      now,
      task.started_at?.toISOString() ?? null,
      task.completed_at?.toISOString() ?? null,
      task.deadline?.toISOString() ?? null,
      JSON.stringify(task.entity_refs),
      JSON.stringify(task.tags),
      JSON.stringify(task.deliverables),
      task.contribution_score,
      task.review_notes,
    )
    return this.get(id) as Promise<Task>
  }

  async get(id: string): Promise<Task | null> {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    if (!row) return null
    return this.rowToTask(row)
  }

  async update(id: string, patch: Partial<Task>): Promise<Task> {
    const existing = await this.get(id)
    if (!existing) throw new Error(`Task ${id} not found`)

    const fields: string[] = []
    const params: any[] = []

    const scalarKeys = ['title', 'description', 'status', 'priority', 'type', 'creator_id', 'assignee_id', 'contribution_score', 'review_notes'] as const
    for (const key of scalarKeys) {
      if (key in patch) {
        fields.push(`${key} = ?`)
        params.push(patch[key])
      }
    }

    const dateKeys = ['started_at', 'completed_at', 'deadline'] as const
    for (const key of dateKeys) {
      if (key in patch) {
        fields.push(`${key} = ?`)
        params.push(patch[key]?.toISOString() ?? null)
      }
    }

    const jsonKeys = ['entity_refs', 'tags', 'deliverables'] as const
    for (const key of jsonKeys) {
      if (key in patch) {
        fields.push(`${key} = ?`)
        params.push(JSON.stringify(patch[key]))
      }
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    params.push(id)
    this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params)

    return this.get(id) as Promise<Task>
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    let sql = 'SELECT * FROM tasks WHERE 1=1'
    const params: any[] = []

    if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status) }
    if (filter?.assignee_id) { sql += ' AND assignee_id = ?'; params.push(filter.assignee_id) }
    if (filter?.creator_id) { sql += ' AND creator_id = ?'; params.push(filter.creator_id) }
    if (filter?.priority) { sql += ' AND priority = ?'; params.push(filter.priority) }
    if (filter?.type) { sql += ' AND type = ?'; params.push(filter.type) }

    sql += ' ORDER BY created_at DESC'

    if (filter?.limit) { sql += ' LIMIT ?'; params.push(filter.limit) }

    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(row => this.rowToTask(row))
  }

  async listByAssignee(assigneeId: string, status?: TaskStatus): Promise<Task[]> {
    return this.list({ assignee_id: assigneeId, status })
  }

  async listByStatus(status: TaskStatus): Promise<Task[]> {
    return this.list({ status })
  }

  async stats(): Promise<TaskStats> {
    const rows = this.db.prepare(
      'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
    ).all() as { status: TaskStatus; count: number }[]

    const byStatus: Record<TaskStatus, number> = {
      open: 0, assigned: 0, in_progress: 0, review: 0, revision: 0, done: 0, cancelled: 0,
    }
    for (const row of rows) {
      byStatus[row.status] = row.count
    }

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0)

    const avgRow = this.db.prepare(`
      SELECT AVG((julianday(completed_at) - julianday(created_at)) * 24) as avg_hours
      FROM tasks WHERE completed_at IS NOT NULL
    `).get() as { avg_hours: number | null }

    const doneCount = byStatus.done + byStatus.cancelled
    const completionRate = doneCount > 0 ? byStatus.done / doneCount : 0

    return {
      total,
      by_status: byStatus,
      avg_completion_hours: avgRow.avg_hours,
      completion_rate: completionRate,
    }
  }
}
