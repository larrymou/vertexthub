// packages/core/src/stores/task-store.test.ts
// Task Store 测试

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SqliteTaskStore } from './task-store'
import type { Task, TaskStatus } from '../types'

describe('SqliteTaskStore', () => {
  let db: Database.Database
  let store: SqliteTaskStore

  beforeEach(() => {
    db = new Database(':memory:')
    store = new SqliteTaskStore(db)
  })

  const createTaskData = (overrides: Partial<Task> = {}) => ({
    title: 'Test Task',
    description: 'A test task',
    status: 'open' as TaskStatus,
    priority: 'medium' as const,
    type: 'task',
    creator_id: 'user-1',
    assignee_id: null,
    started_at: null,
    completed_at: null,
    deadline: null,
    entity_refs: ['entity-1'],
    tags: ['test'],
    deliverables: ['deliverable-1'],
    contribution_score: null,
    review_notes: null,
    ...overrides,
  })

  describe('create', () => {
    it('generates id and sets timestamps', async () => {
      const task = await store.create(createTaskData())

      expect(task.id).toBeTruthy()
      expect(task.created_at).toBeInstanceOf(Date)
      expect(task.updated_at).toBeInstanceOf(Date)
      expect(task.title).toBe('Test Task')
    })

    it('persists all fields', async () => {
      const data = createTaskData({
        entity_refs: ['ref-1', 'ref-2'],
        tags: ['urgent', 'backend'],
        deliverables: ['doc.md'],
        contribution_score: 5.5,
        review_notes: 'Looks good',
      })
      const task = await store.create(data)

      expect(task.entity_refs).toEqual(['ref-1', 'ref-2'])
      expect(task.tags).toEqual(['urgent', 'backend'])
      expect(task.deliverables).toEqual(['doc.md'])
      expect(task.contribution_score).toBe(5.5)
      expect(task.review_notes).toBe('Looks good')
    })
  })

  describe('get', () => {
    it('returns null for nonexistent task', async () => {
      const task = await store.get('nonexistent')
      expect(task).toBeNull()
    })

    it('returns created task', async () => {
      const created = await store.create(createTaskData())
      const fetched = await store.get(created.id)

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.title).toBe('Test Task')
    })
  })

  describe('update', () => {
    it('updates fields', async () => {
      const task = await store.create(createTaskData())
      const updated = await store.update(task.id, { title: 'Updated', status: 'in_progress' })

      expect(updated.title).toBe('Updated')
      expect(updated.status).toBe('in_progress')
    })

    it('updates updated_at timestamp', async () => {
      const task = await store.create(createTaskData())
      const beforeUpdate = task.updated_at

      // small delay to ensure timestamp differs
      await new Promise(r => setTimeout(r, 10))
      const updated = await store.update(task.id, { title: 'New' })

      expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
    })

    it('throws for nonexistent task', async () => {
      await expect(store.update('bad-id', { title: 'x' })).rejects.toThrow('Task bad-id not found')
    })
  })

  describe('list', () => {
    it('returns all tasks', async () => {
      await store.create(createTaskData({ title: 'A' }))
      await store.create(createTaskData({ title: 'B' }))

      const tasks = await store.list()
      expect(tasks).toHaveLength(2)
    })

    it('filters by status', async () => {
      await store.create(createTaskData({ status: 'open' }))
      await store.create(createTaskData({ status: 'done' }))

      const tasks = await store.list({ status: 'open' })
      expect(tasks).toHaveLength(1)
      expect(tasks[0].status).toBe('open')
    })

    it('filters by assignee_id', async () => {
      await store.create(createTaskData({ assignee_id: 'user-1' }))
      await store.create(createTaskData({ assignee_id: 'user-2' }))

      const tasks = await store.list({ assignee_id: 'user-1' })
      expect(tasks).toHaveLength(1)
      expect(tasks[0].assignee_id).toBe('user-1')
    })

    it('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        await store.create(createTaskData({ title: `Task ${i}` }))
      }

      const tasks = await store.list({ limit: 2 })
      expect(tasks).toHaveLength(2)
    })
  })

  describe('stats', () => {
    it('returns correct counts', async () => {
      await store.create(createTaskData({ status: 'open' }))
      await store.create(createTaskData({ status: 'open' }))
      await store.create(createTaskData({ status: 'done' }))

      const stats = await store.stats()

      expect(stats.total).toBe(3)
      expect(stats.by_status.open).toBe(2)
      expect(stats.by_status.done).toBe(1)
      expect(stats.by_status.cancelled).toBe(0)
    })

    it('returns zero stats for empty store', async () => {
      const stats = await store.stats()

      expect(stats.total).toBe(0)
      expect(stats.by_status.open).toBe(0)
      expect(stats.avg_completion_hours).toBeNull()
      expect(stats.completion_rate).toBe(0)
    })

    it('calculates completion rate', async () => {
      await store.create(createTaskData({ status: 'done' }))
      await store.create(createTaskData({ status: 'done' }))
      await store.create(createTaskData({ status: 'cancelled' }))

      const stats = await store.stats()
      expect(stats.completion_rate).toBeCloseTo(2 / 3)
    })
  })
})
