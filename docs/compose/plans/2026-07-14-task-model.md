# Task Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Task model with state machine, SQLite storage, contribution scoring, and HTTP API endpoints.

**Architecture:** Types in `types.ts`, SQLite store following existing `SqliteEventStore` pattern, state machine as a pure logic class in `engine/`, API routes added to existing server.

**Tech Stack:** TypeScript, better-sqlite3, nanoid, vitest

## Global Constraints

- Follow existing code patterns: interface in `types.ts`, SQLite impl in `stores/`, tests alongside source
- Use `nanoid` for ID generation (already a dependency)
- Use `Record<string, unknown>` for any flexible-content fields (not `any`)
- All tests use in-memory SQLite (`:memory:`)
- Chinese comments are acceptable (existing codebase convention)

---

### Task 1: Task Types & Interfaces

**Covers:** [S1], [S2]

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `Task`, `TaskStatus`, `TaskStore`, `TaskFilter`, `TaskStats` types used by all subsequent tasks

- [ ] **Step 1: Add Task types to types.ts**

Append the following to `packages/core/src/types.ts`:

```typescript
// ═══════════════════════════════════════════════════════════════
// Task - 原子任务
// ═══════════════════════════════════════════════════════════════

export type TaskStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'revision'
  | 'done'
  | 'cancelled'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high' | 'urgent'
  type: string

  creator_id: string
  assignee_id: string | null

  created_at: Date
  updated_at: Date
  started_at: Date | null
  completed_at: Date | null
  deadline: Date | null

  entity_refs: string[]
  tags: string[]

  deliverables: string[]
  contribution_score: number | null
  review_notes: string | null
}

export interface TaskFilter {
  status?: TaskStatus
  assignee_id?: string
  creator_id?: string
  priority?: Task['priority']
  type?: string
  limit?: number
}

export interface TaskStats {
  total: number
  by_status: Record<TaskStatus, number>
  avg_completion_hours: number | null
  completion_rate: number
}

export interface TaskStore {
  create(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task>
  get(id: string): Promise<Task | null>
  update(id: string, patch: Partial<Task>): Promise<Task>
  list(filter?: TaskFilter): Promise<Task[]>
  listByAssignee(assigneeId: string, status?: TaskStatus): Promise<Task[]>
  listByStatus(status: TaskStatus): Promise<Task[]>
  stats(): Promise<TaskStats>
}
```

- [ ] **Step 2: Export from index.ts**

Add to `packages/core/src/index.ts`:

```typescript
export type { Task, TaskStatus, TaskFilter, TaskStats, TaskStore } from './types'
```

- [ ] **Step 3: Verify types compile**

Run: `cd packages/core && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat(task): add Task types and interfaces"
```

---

### Task 2: SqliteTaskStore

**Covers:** [S2], [S7]

**Files:**
- Create: `packages/core/src/stores/task-store.ts`
- Create: `packages/core/src/stores/task-store.test.ts`
- Modify: `packages/core/src/stores/index.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Task`, `TaskStatus`, `TaskFilter`, `TaskStats`, `TaskStore` from types.ts
- Produces: `SqliteTaskStore` class used by API routes

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/stores/task-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SqliteTaskStore } from './task-store'
import { Task } from '../types'

describe('SqliteTaskStore', () => {
  let db: Database.Database
  let store: SqliteTaskStore

  beforeEach(() => {
    db = new Database(':memory:')
    store = new SqliteTaskStore(db)
  })

  const baseTask = {
    title: 'Test task',
    description: 'A test task',
    status: 'open' as const,
    priority: 'medium' as const,
    type: 'feature',
    creator_id: 'user-1',
    assignee_id: null,
    started_at: null,
    completed_at: null,
    deadline: null,
    entity_refs: [],
    tags: ['frontend'],
    deliverables: [],
    contribution_score: null,
    review_notes: null,
  }

  describe('create', () => {
    it('should create a task with generated id and timestamps', async () => {
      const task = await store.create(baseTask)
      expect(task.id).toBeDefined()
      expect(task.title).toBe('Test task')
      expect(task.status).toBe('open')
      expect(task.created_at).toBeInstanceOf(Date)
      expect(task.updated_at).toBeInstanceOf(Date)
    })
  })

  describe('get', () => {
    it('should return null for non-existent id', async () => {
      const result = await store.get('nonexistent')
      expect(result).toBeNull()
    })

    it('should return the created task', async () => {
      const created = await store.create(baseTask)
      const fetched = await store.get(created.id)
      expect(fetched?.id).toBe(created.id)
      expect(fetched?.title).toBe('Test task')
    })
  })

  describe('update', () => {
    it('should update specified fields', async () => {
      const task = await store.create(baseTask)
      const updated = await store.update(task.id, { title: 'Updated', priority: 'high' })
      expect(updated.title).toBe('Updated')
      expect(updated.priority).toBe('high')
      expect(updated.status).toBe('open') // unchanged
    })

    it('should update the updated_at timestamp', async () => {
      const task = await store.create(baseTask)
      const updated = await store.update(task.id, { title: 'Updated' })
      expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(task.updated_at.getTime())
    })
  })

  describe('list', () => {
    it('should list all tasks', async () => {
      await store.create(baseTask)
      await store.create({ ...baseTask, title: 'Task 2' })
      const tasks = await store.list()
      expect(tasks).toHaveLength(2)
    })

    it('should filter by status', async () => {
      await store.create(baseTask)
      await store.create({ ...baseTask, status: 'done' })
      const open = await store.list({ status: 'open' })
      expect(open).toHaveLength(1)
      expect(open[0].status).toBe('open')
    })

    it('should filter by assignee_id', async () => {
      await store.create(baseTask)
      await store.create({ ...baseTask, assignee_id: 'user-2' })
      const assigned = await store.list({ assignee_id: 'user-2' })
      expect(assigned).toHaveLength(1)
    })

    it('should respect limit', async () => {
      await store.create(baseTask)
      await store.create({ ...baseTask, title: 'Task 2' })
      const tasks = await store.list({ limit: 1 })
      expect(tasks).toHaveLength(1)
    })
  })

  describe('stats', () => {
    it('should return correct stats', async () => {
      await store.create(baseTask)
      await store.create({ ...baseTask, status: 'done', completed_at: new Date() })
      await store.create({ ...baseTask, status: 'in_progress' })
      const stats = await store.stats()
      expect(stats.total).toBe(3)
      expect(stats.by_status.open).toBe(1)
      expect(stats.by_status.done).toBe(1)
      expect(stats.by_status.in_progress).toBe(1)
      expect(stats.completion_rate).toBeCloseTo(1 / 2) // done / (done + cancelled)
    })

    it('should return zero stats for empty store', async () => {
      const stats = await store.stats()
      expect(stats.total).toBe(0)
      expect(stats.completion_rate).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run src/stores/task-store.test.ts`
Expected: FAIL — `Cannot find module './task-store'`

- [ ] **Step 3: Implement SqliteTaskStore**

Create `packages/core/src/stores/task-store.ts`:

```typescript
import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { Task, TaskStatus, TaskFilter, TaskStats, TaskStore } from '../types'

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
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        type TEXT NOT NULL DEFAULT 'feature',
        creator_id TEXT NOT NULL,
        assignee_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        deadline TEXT,
        entity_refs TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        deliverables TEXT DEFAULT '[]',
        contribution_score REAL,
        review_notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id);
    `)
  }

  async create(input: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const id = nanoid()
    const now = new Date()
    const task: Task = { ...input, id, created_at: now, updated_at: now }

    this.db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, type, creator_id, assignee_id,
        created_at, updated_at, started_at, completed_at, deadline, entity_refs, tags,
        deliverables, contribution_score, review_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id, task.title, task.description, task.status, task.priority, task.type,
      task.creator_id, task.assignee_id,
      task.created_at.toISOString(), task.updated_at.toISOString(),
      task.started_at?.toISOString() ?? null, task.completed_at?.toISOString() ?? null,
      task.deadline?.toISOString() ?? null,
      JSON.stringify(task.entity_refs), JSON.stringify(task.tags),
      JSON.stringify(task.deliverables), task.contribution_score, task.review_notes
    )

    return task
  }

  async get(id: string): Promise<Task | null> {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) return null
    return this.rowToTask(row)
  }

  async update(id: string, patch: Partial<Task>): Promise<Task> {
    const existing = await this.get(id)
    if (!existing) throw new Error(`Task ${id} not found`)

    const merged = { ...existing, ...patch, updated_at: new Date() }

    this.db.prepare(`
      UPDATE tasks SET title=?, description=?, status=?, priority=?, type=?,
        creator_id=?, assignee_id=?, updated_at=?, started_at=?, completed_at=?,
        deadline=?, entity_refs=?, tags=?, deliverables=?, contribution_score=?, review_notes=?
      WHERE id=?
    `).run(
      merged.title, merged.description, merged.status, merged.priority, merged.type,
      merged.creator_id, merged.assignee_id,
      merged.updated_at.toISOString(),
      merged.started_at?.toISOString() ?? null, merged.completed_at?.toISOString() ?? null,
      merged.deadline?.toISOString() ?? null,
      JSON.stringify(merged.entity_refs), JSON.stringify(merged.tags),
      JSON.stringify(merged.deliverables), merged.contribution_score, merged.review_notes,
      id
    )

    return merged
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    let sql = 'SELECT * FROM tasks WHERE 1=1'
    const params: unknown[] = []

    if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status) }
    if (filter?.assignee_id) { sql += ' AND assignee_id = ?'; params.push(filter.assignee_id) }
    if (filter?.creator_id) { sql += ' AND creator_id = ?'; params.push(filter.creator_id) }
    if (filter?.priority) { sql += ' AND priority = ?'; params.push(filter.priority) }
    if (filter?.type) { sql += ' AND type = ?'; params.push(filter.type) }

    sql += ' ORDER BY created_at DESC'
    if (filter?.limit) { sql += ' LIMIT ?'; params.push(filter.limit) }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map(r => this.rowToTask(r))
  }

  async listByAssignee(assigneeId: string, status?: TaskStatus): Promise<Task[]> {
    return this.list({ assignee_id: assigneeId, status })
  }

  async listByStatus(status: TaskStatus): Promise<Task[]> {
    return this.list({ status })
  }

  async stats(): Promise<TaskStats> {
    const rows = this.db.prepare(
      `SELECT status, COUNT(*) as count FROM tasks GROUP BY status`
    ).all() as { status: TaskStatus; count: number }[]

    const byStatus = {} as Record<TaskStatus, number>
    const allStatuses: TaskStatus[] = ['open', 'assigned', 'in_progress', 'review', 'revision', 'done', 'cancelled']
    for (const s of allStatuses) byStatus[s] = 0
    let total = 0
    for (const r of rows) { byStatus[r.status] = r.count; total += r.count }

    const completed = byStatus.done
    const terminal = byStatus.done + byStatus.cancelled
    const completionRate = terminal > 0 ? completed / terminal : 0

    const avgRow = this.db.prepare(
      `SELECT AVG((julianday(completed_at) - julianday(started_at)) * 24) as avg_hours
       FROM tasks WHERE status = 'done' AND started_at IS NOT NULL AND completed_at IS NOT NULL`
    ).get() as { avg_hours: number | null }

    return { total, by_status: byStatus, avg_completion_hours: avgRow.avg_hours, completion_rate: completionRate }
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      status: row.status as TaskStatus,
      priority: row.priority as Task['priority'],
      type: row.type as string,
      creator_id: row.creator_id as string,
      assignee_id: row.assignee_id as string | null,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
      started_at: row.started_at ? new Date(row.started_at as string) : null,
      completed_at: row.completed_at ? new Date(row.completed_at as string) : null,
      deadline: row.deadline ? new Date(row.deadline as string) : null,
      entity_refs: JSON.parse((row.entity_refs as string) || '[]'),
      tags: JSON.parse((row.tags as string) || '[]'),
      deliverables: JSON.parse((row.deliverables as string) || '[]'),
      contribution_score: row.contribution_score as number | null,
      review_notes: row.review_notes as string | null,
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/stores/task-store.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Export from stores/index.ts and core/index.ts**

Add to `packages/core/src/stores/index.ts`:
```typescript
export { SqliteTaskStore } from './task-store'
```

Add to `packages/core/src/index.ts`:
```typescript
export { SqliteTaskStore } from './stores/task-store'
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/stores/task-store.ts packages/core/src/stores/task-store.test.ts packages/core/src/stores/index.ts packages/core/src/index.ts
git commit -m "feat(task): add SqliteTaskStore with full CRUD and stats"
```

---

### Task 3: Task State Machine & Contribution Scoring

**Covers:** [S3], [S4], [S7]

**Files:**
- Create: `packages/core/src/engine/task-state-machine.ts`
- Create: `packages/core/src/engine/task-state-machine.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Task`, `TaskStatus` from types.ts
- Produces: `TaskStateMachine` class with `claim`, `start`, `submitForReview`, `approve`, `reject`, `resubmit`, `cancel` methods; `calculateContributionScore` function

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/engine/task-state-machine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { TaskStateMachine, calculateContributionScore } from './task-state-machine'
import { Task } from '../types'

describe('TaskStateMachine', () => {
  const sm = new TaskStateMachine()

  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: 'Test',
    description: '',
    status: 'open',
    priority: 'medium',
    type: 'feature',
    creator_id: 'alice',
    assignee_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    started_at: null,
    completed_at: null,
    deadline: null,
    entity_refs: [],
    tags: [],
    deliverables: [],
    contribution_score: null,
    review_notes: null,
    ...overrides,
  })

  describe('claim', () => {
    it('should transition open → assigned', () => {
      const task = makeTask()
      const result = sm.claim(task, 'bob')
      expect(result.status).toBe('assigned')
      expect(result.assignee_id).toBe('bob')
    })

    it('should reject if not open', () => {
      const task = makeTask({ status: 'assigned' })
      expect(() => sm.claim(task, 'bob')).toThrow('Cannot claim task in assigned status')
    })

    it('should reject if creator claims own task', () => {
      const task = makeTask({ creator_id: 'alice' })
      expect(() => sm.claim(task, 'alice')).toThrow('Creator cannot claim their own task')
    })
  })

  describe('start', () => {
    it('should transition assigned → in_progress and set started_at', () => {
      const task = makeTask({ status: 'assigned', assignee_id: 'bob' })
      const result = sm.start(task, 'bob')
      expect(result.status).toBe('in_progress')
      expect(result.started_at).toBeInstanceOf(Date)
    })

    it('should reject if not assignee', () => {
      const task = makeTask({ status: 'assigned', assignee_id: 'bob' })
      expect(() => sm.start(task, 'charlie')).toThrow('Only assignee can start task')
    })
  })

  describe('submitForReview', () => {
    it('should transition in_progress → review', () => {
      const task = makeTask({ status: 'in_progress', assignee_id: 'bob' })
      const result = sm.submitForReview(task, 'bob')
      expect(result.status).toBe('review')
    })
  })

  describe('approve', () => {
    it('should transition review → done with score', () => {
      const task = makeTask({ status: 'review', assignee_id: 'bob', creator_id: 'alice' })
      const result = sm.approve(task, 'alice', 85, 'Great work')
      expect(result.status).toBe('done')
      expect(result.contribution_score).toBe(85)
      expect(result.review_notes).toBe('Great work')
      expect(result.completed_at).toBeInstanceOf(Date)
    })

    it('should reject if not creator', () => {
      const task = makeTask({ status: 'review', creator_id: 'alice' })
      expect(() => sm.approve(task, 'bob', 85)).toThrow('Only creator can approve')
    })
  })

  describe('reject', () => {
    it('should transition review → revision with notes', () => {
      const task = makeTask({ status: 'review', creator_id: 'alice' })
      const result = sm.reject(task, 'alice', 'Needs more tests')
      expect(result.status).toBe('revision')
      expect(result.review_notes).toBe('Needs more tests')
    })

    it('should require review notes', () => {
      const task = makeTask({ status: 'review', creator_id: 'alice' })
      expect(() => sm.reject(task, 'alice', '')).toThrow('Review notes required')
    })
  })

  describe('resubmit', () => {
    it('should transition revision → review', () => {
      const task = makeTask({ status: 'revision', assignee_id: 'bob' })
      const result = sm.resubmit(task, 'bob')
      expect(result.status).toBe('review')
    })
  })

  describe('cancel', () => {
    it('should transition open → cancelled', () => {
      const task = makeTask({ status: 'open', creator_id: 'alice' })
      const result = sm.cancel(task, 'alice')
      expect(result.status).toBe('cancelled')
    })

    it('should reject cancel from in_progress', () => {
      const task = makeTask({ status: 'in_progress', creator_id: 'alice' })
      expect(() => sm.cancel(task, 'alice')).toThrow('Cannot cancel task in in_progress status')
    })
  })
})

describe('calculateContributionScore', () => {
  it('should return base score of 50 for on-time completion', () => {
    const score = calculateContributionScore({
      started_at: new Date('2026-01-01'),
      completed_at: new Date('2026-01-03'),
      deadline: new Date('2026-01-03'),
      priority: 'medium',
      type: 'feature',
    })
    expect(score).toBe(50)
  })

  it('should add bonus for early completion', () => {
    const score = calculateContributionScore({
      started_at: new Date('2026-01-01'),
      completed_at: new Date('2026-01-01'),
      deadline: new Date('2026-01-05'),
      priority: 'medium',
      type: 'feature',
    })
    expect(score).toBe(70) // 50 + 4*5
  })

  it('should deduct for late completion', () => {
    const score = calculateContributionScore({
      started_at: new Date('2026-01-01'),
      completed_at: new Date('2026-01-05'),
      deadline: new Date('2026-01-03'),
      priority: 'medium',
      type: 'feature',
    })
    expect(score).toBe(40) // 50 - 2*5
  })

  it('should add urgency bonus', () => {
    const score = calculateContributionScore({
      started_at: new Date('2026-01-01'),
      completed_at: new Date('2026-01-03'),
      deadline: new Date('2026-01-03'),
      priority: 'urgent',
      type: 'feature',
    })
    expect(score).toBe(60) // 50 + 10
  })

  it('should add exploration bonus', () => {
    const score = calculateContributionScore({
      started_at: new Date('2026-01-01'),
      completed_at: new Date('2026-01-03'),
      deadline: new Date('2026-01-03'),
      priority: 'medium',
      type: 'exploration',
    })
    expect(score).toBe(60) // 50 + 10
  })

  it('should clamp to 0-100', () => {
    const score = calculateContributionScore({
      started_at: new Date('2026-01-01'),
      completed_at: new Date('2026-01-01'),
      deadline: new Date('2026-01-20'),
      priority: 'urgent',
      type: 'exploration',
    })
    expect(score).toBe(100) // 50 + 20(cap) + 10 + 10 = 90, clamped
  })

  it('should return null if no deadline', () => {
    const score = calculateContributionScore({
      started_at: new Date('2026-01-01'),
      completed_at: new Date('2026-01-03'),
      deadline: null,
      priority: 'medium',
      type: 'feature',
    })
    expect(score).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run src/engine/task-state-machine.test.ts`
Expected: FAIL — `Cannot find module './task-state-machine'`

- [ ] **Step 3: Implement TaskStateMachine and scoring**

Create `packages/core/src/engine/task-state-machine.ts`:

```typescript
import { Task, TaskStatus } from '../types'

export class TaskStateMachine {
  claim(task: Task, userId: string): Task {
    if (task.status !== 'open') throw new Error(`Cannot claim task in ${task.status} status`)
    if (task.creator_id === userId) throw new Error('Creator cannot claim their own task')
    return { ...task, status: 'assigned', assignee_id: userId, updated_at: new Date() }
  }

  start(task: Task, userId: string): Task {
    if (task.status !== 'assigned') throw new Error(`Cannot start task in ${task.status} status`)
    if (task.assignee_id !== userId) throw new Error('Only assignee can start task')
    return { ...task, status: 'in_progress', started_at: new Date(), updated_at: new Date() }
  }

  submitForReview(task: Task, userId: string): Task {
    if (task.status !== 'in_progress') throw new Error(`Cannot submit task in ${task.status} status`)
    if (task.assignee_id !== userId) throw new Error('Only assignee can submit for review')
    return { ...task, status: 'review', updated_at: new Date() }
  }

  approve(task: Task, reviewerId: string, score: number, notes?: string): Task {
    if (task.status !== 'review') throw new Error(`Cannot approve task in ${task.status} status`)
    if (task.creator_id !== reviewerId) throw new Error('Only creator can approve')
    return {
      ...task,
      status: 'done',
      contribution_score: score,
      review_notes: notes ?? null,
      completed_at: new Date(),
      updated_at: new Date(),
    }
  }

  reject(task: Task, reviewerId: string, notes: string): Task {
    if (task.status !== 'review') throw new Error(`Cannot reject task in ${task.status} status`)
    if (task.creator_id !== reviewerId) throw new Error('Only creator can reject')
    if (!notes) throw new Error('Review notes required')
    return { ...task, status: 'revision', review_notes: notes, updated_at: new Date() }
  }

  resubmit(task: Task, userId: string): Task {
    if (task.status !== 'revision') throw new Error(`Cannot resubmit task in ${task.status} status`)
    if (task.assignee_id !== userId) throw new Error('Only assignee can resubmit')
    return { ...task, status: 'review', updated_at: new Date() }
  }

  cancel(task: Task, userId: string): Task {
    const cancellable: TaskStatus[] = ['open', 'assigned']
    if (!cancellable.includes(task.status)) throw new Error(`Cannot cancel task in ${task.status} status`)
    if (task.creator_id !== userId) throw new Error('Only creator can cancel')
    return { ...task, status: 'cancelled', updated_at: new Date() }
  }
}

export function calculateContributionScore(params: {
  started_at: Date | null
  completed_at: Date | null
  deadline: Date | null
  priority: Task['priority']
  type: string
}): number | null {
  if (!params.deadline || !params.started_at || !params.completed_at) return null

  const deadlineMs = params.deadline.getTime()
  const completedMs = params.completed_at.getTime()
  const daysDiff = Math.round((deadlineMs - completedMs) / (1000 * 60 * 60 * 24))

  let score = 50

  // Early/late bonus/penalty
  if (daysDiff > 0) {
    score += Math.min(daysDiff * 5, 20)
  } else if (daysDiff < 0) {
    score += Math.max(daysDiff * 5, -20)
  }

  // Urgency bonus
  if (params.priority === 'urgent') score += 10
  else if (params.priority === 'high') score += 5

  // Exploration bonus
  if (params.type === 'exploration') score += 10

  return Math.max(0, Math.min(100, score))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/engine/task-state-machine.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Export from index.ts**

Add to `packages/core/src/index.ts`:
```typescript
export { TaskStateMachine, calculateContributionScore } from './engine/task-state-machine'
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/core && npx vitest run`
Expected: all tests pass (existing + new)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/engine/task-state-machine.ts packages/core/src/engine/task-state-machine.test.ts packages/core/src/index.ts
git commit -m "feat(task): add TaskStateMachine and contribution scoring"
```

---

### Task 4: Task API Endpoints

**Covers:** [S5], [S7]

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `packages/core/src/index.ts` (if needed)

**Interfaces:**
- Consumes: `SqliteTaskStore`, `TaskStateMachine`, `calculateContributionScore` from core
- Produces: HTTP endpoints listed in S5

- [ ] **Step 1: Add task routes to server**

Modify `apps/server/src/index.ts` — add after the existing entity routes (before the `throw new NotFoundError` line):

```typescript
import { SqliteTaskStore, TaskStateMachine, calculateContributionScore } from '@vertexhub/core'

// Add after entityStore initialization:
const taskStore = new SqliteTaskStore(db)
const taskStateMachine = new TaskStateMachine()

// Add task routes in handleRequest, before the final NotFoundError throw:

// List tasks
if (url.pathname === '/api/tasks' && req.method === 'GET') {
  const params = validateQueryParams(url.searchParams, {
    status: { type: 'string' },
    assignee_id: { type: 'string' },
    creator_id: { type: 'string' },
    priority: { type: 'string' },
    type: { type: 'string' },
    limit: { type: 'number' },
  })
  const tasks = await taskStore.list(params)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ tasks }))
  return
}

// Get task by ID
if (url.pathname.startsWith('/api/tasks/') && !url.pathname.includes('/api/tasks/stats') && req.method === 'GET') {
  const id = url.pathname.split('/')[3]
  const task = await taskStore.get(id)
  if (!task) throw new NotFoundError('Task', id)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ task }))
  return
}

// Task stats
if (url.pathname === '/api/tasks/stats' && req.method === 'GET') {
  const stats = await taskStore.stats()
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(stats))
  return
}

// Create task
if (url.pathname === '/api/tasks' && req.method === 'POST') {
  const body = (req as any).body
  const task = await taskStore.create({
    title: body.title,
    description: body.description || '',
    status: 'open',
    priority: body.priority || 'medium',
    type: body.type || 'feature',
    creator_id: body.creator_id,
    assignee_id: null,
    started_at: null,
    completed_at: null,
    deadline: body.deadline ? new Date(body.deadline) : null,
    entity_refs: body.entity_refs || [],
    tags: body.tags || [],
    deliverables: [],
    contribution_score: null,
    review_notes: null,
  })
  res.writeHead(201, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ task }))
  return
}

// State transitions
const stateTransitionRoutes: Record<string, (body: any, task: any) => any> = {
  'claim': (body, task) => taskStateMachine.claim(task, body.user_id),
  'start': (body, task) => taskStateMachine.start(task, body.user_id),
  'submit': (body, task) => taskStateMachine.submitForReview(task, body.user_id),
  'approve': (body, task) => {
    const score = body.score ?? calculateContributionScore({
      started_at: task.started_at,
      completed_at: new Date(),
      deadline: task.deadline,
      priority: task.priority,
      type: task.type,
    })
    return taskStateMachine.approve(task, body.user_id, score ?? 50, body.notes)
  },
  'reject': (body, task) => taskStateMachine.reject(task, body.user_id, body.notes),
  'resubmit': (body, task) => taskStateMachine.resubmit(task, body.user_id),
  'cancel': (body, task) => taskStateMachine.cancel(task, body.user_id),
}

for (const [action, handler] of Object.entries(stateTransitionRoutes)) {
  if (url.pathname === `/api/tasks/${action}` && req.method === 'POST') {
    // action routes use task_id in body
    const body = (req as any).body
    const task = await taskStore.get(body.task_id)
    if (!task) throw new NotFoundError('Task', body.task_id)
    const updated = handler(body, task)
    await taskStore.update(updated.id, updated)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ task: updated }))
    return
  }
}
```

Note: The state transition routes above use `/api/tasks/:action` with `task_id` in body rather than `/api/tasks/:id/:action` to avoid complex routing with the hand-rolled router. This is a pragmatic MVP choice.

- [ ] **Step 2: Build and verify compilation**

Run: `npm run build`
Expected: all packages compile

- [ ] **Step 3: Manual smoke test**

Run the server and test:
```bash
cd apps/server && npx ts-node src/index.ts &
# Create task
curl -X POST http://localhost:3000/api/tasks -H 'Content-Type: application/json' -d '{"title":"Test task","creator_id":"alice"}'
# List tasks
curl http://localhost:3000/api/tasks
# Stats
curl http://localhost:3000/api/tasks/stats
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat(task): add task API endpoints with state transitions"
```

---

### Task 5: Full Build & Test Verification

**Covers:** [S6]

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: 5/5 packages pass

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: all tests pass, including new task-store and task-state-machine tests

- [ ] **Step 3: Verify test counts**

Run: `cd packages/core && npx vitest run`
Expected: 7 existing test files + 2 new = 9 files; 59 existing + ~25 new = ~84 tests

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "chore(task): verify full build and test suite"
```
