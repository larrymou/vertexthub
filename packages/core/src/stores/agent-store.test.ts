// packages/core/src/stores/agent-store.test.ts
// Agent Store 测试

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SqliteAgentStore } from './agent-store'
import type { Agent, AgentType } from '../types'

describe('SqliteAgentStore', () => {
  let db: Database.Database
  let store: SqliteAgentStore

  beforeEach(() => {
    db = new Database(':memory:')
    store = new SqliteAgentStore(db)
  })

  const createAgentData = (overrides: Partial<Agent> = {}) => ({
    name: 'Test Agent',
    type: 'human' as AgentType,
    email: 'test@example.com',
    avatar_url: null,
    skills: ['typescript', 'react'],
    bio: 'A test agent',
    status: 'active' as const,
    max_concurrent_tasks: 3,
    last_active_at: null,
    ...overrides,
  })

  describe('create', () => {
    it('generates id, sets defaults and timestamps', async () => {
      const agent = await store.create(createAgentData())

      expect(agent.id).toBeTruthy()
      expect(agent.credit_score).toBe(100)
      expect(agent.credit_history).toEqual([])
      expect(agent.tasks_completed).toBe(0)
      expect(agent.tasks_cancelled).toBe(0)
      expect(agent.avg_contribution_score).toBeNull()
      expect(agent.created_at).toBeInstanceOf(Date)
      expect(agent.updated_at).toBeInstanceOf(Date)
      expect(agent.name).toBe('Test Agent')
    })

    it('persists all fields', async () => {
      const data = createAgentData({
        email: null,
        avatar_url: 'https://example.com/avatar.png',
        skills: ['python', 'ml'],
        bio: 'AI researcher',
        status: 'inactive',
        max_concurrent_tasks: 5,
      })
      const agent = await store.create(data)

      expect(agent.email).toBeNull()
      expect(agent.avatar_url).toBe('https://example.com/avatar.png')
      expect(agent.skills).toEqual(['python', 'ml'])
      expect(agent.bio).toBe('AI researcher')
      expect(agent.status).toBe('inactive')
      expect(agent.max_concurrent_tasks).toBe(5)
    })
  })

  describe('get', () => {
    it('returns null for nonexistent agent', async () => {
      const agent = await store.get('nonexistent')
      expect(agent).toBeNull()
    })

    it('returns created agent', async () => {
      const created = await store.create(createAgentData())
      const fetched = await store.get(created.id)

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.name).toBe('Test Agent')
      expect(fetched!.skills).toEqual(['typescript', 'react'])
    })
  })

  describe('update', () => {
    it('updates fields', async () => {
      const agent = await store.create(createAgentData())
      const updated = await store.update(agent.id, { name: 'Updated', bio: 'New bio' })

      expect(updated.name).toBe('Updated')
      expect(updated.bio).toBe('New bio')
    })

    it('updates updated_at timestamp', async () => {
      const agent = await store.create(createAgentData())
      const beforeUpdate = agent.updated_at

      await new Promise(r => setTimeout(r, 10))
      const updated = await store.update(agent.id, { name: 'New' })

      expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
    })

    it('throws for nonexistent agent', async () => {
      await expect(store.update('bad-id', { name: 'x' })).rejects.toThrow('Agent bad-id not found')
    })
  })

  describe('list', () => {
    it('returns all agents', async () => {
      await store.create(createAgentData({ name: 'A' }))
      await store.create(createAgentData({ name: 'B' }))

      const agents = await store.list()
      expect(agents).toHaveLength(2)
    })

    it('filters by status', async () => {
      await store.create(createAgentData({ status: 'active' }))
      await store.create(createAgentData({ status: 'inactive' }))

      const agents = await store.list({ status: 'active' })
      expect(agents).toHaveLength(1)
      expect(agents[0].status).toBe('active')
    })

    it('filters by type', async () => {
      await store.create(createAgentData({ type: 'human' }))
      await store.create(createAgentData({ type: 'ai' }))

      const agents = await store.list({ type: 'ai' })
      expect(agents).toHaveLength(1)
      expect(agents[0].type).toBe('ai')
    })

    it('filters by skill', async () => {
      await store.create(createAgentData({ skills: ['typescript', 'react'] }))
      await store.create(createAgentData({ skills: ['python', 'ml'] }))

      const agents = await store.list({ skill: 'python' })
      expect(agents).toHaveLength(1)
      expect(agents[0].skills).toContain('python')
    })

    it('filters by min_credit', async () => {
      const a = await store.create(createAgentData())
      await store.create(createAgentData())
      await store.adjustCredit(a.id, { task_id: 't1', delta: 50, reason: 'bonus', timestamp: new Date() })

      const agents = await store.list({ min_credit: 120 })
      expect(agents).toHaveLength(1)
      expect(agents[0].credit_score).toBe(150)
    })

    it('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        await store.create(createAgentData({ name: `Agent ${i}` }))
      }

      const agents = await store.list({ limit: 2 })
      expect(agents).toHaveLength(2)
    })
  })

  describe('adjustCredit', () => {
    it('appends to credit_history and updates credit_score', async () => {
      const agent = await store.create(createAgentData())
      const entry = { task_id: 'task-1', delta: 10, reason: 'good work', timestamp: new Date() }

      const updated = await store.adjustCredit(agent.id, entry)

      expect(updated.credit_score).toBe(110)
      expect(updated.credit_history).toHaveLength(1)
      expect(updated.credit_history[0].task_id).toBe('task-1')
      expect(updated.credit_history[0].delta).toBe(10)
    })

    it('clamps credit_score at 200', async () => {
      const agent = await store.create(createAgentData())
      await store.adjustCredit(agent.id, { task_id: 't1', delta: 80, reason: 'x', timestamp: new Date() })
      const updated = await store.adjustCredit(agent.id, { task_id: 't2', delta: 50, reason: 'y', timestamp: new Date() })

      expect(updated.credit_score).toBe(200)
    })

    it('clamps credit_score at 0', async () => {
      const agent = await store.create(createAgentData())
      const updated = await store.adjustCredit(agent.id, { task_id: 't1', delta: -150, reason: 'bad', timestamp: new Date() })

      expect(updated.credit_score).toBe(0)
    })

    it('throws for nonexistent agent', async () => {
      await expect(
        store.adjustCredit('bad-id', { task_id: 't1', delta: 10, reason: 'x', timestamp: new Date() })
      ).rejects.toThrow('Agent bad-id not found')
    })
  })

  describe('findBySkills', () => {
    it('finds agents with overlapping skills', async () => {
      await store.create(createAgentData({ skills: ['typescript', 'react'] }))
      await store.create(createAgentData({ skills: ['python', 'ml'] }))
      await store.create(createAgentData({ skills: ['typescript', 'node'] }))

      const agents = await store.findBySkills(['typescript'])
      expect(agents).toHaveLength(2)
    })

    it('excludes given agent ids', async () => {
      const a1 = await store.create(createAgentData({ skills: ['typescript'] }))
      await store.create(createAgentData({ skills: ['typescript'] }))

      const agents = await store.findBySkills(['typescript'], [a1.id])
      expect(agents).toHaveLength(1)
      expect(agents[0].id).not.toBe(a1.id)
    })

    it('orders by credit_score DESC', async () => {
      const a1 = await store.create(createAgentData({ skills: ['go'] }))
      const a2 = await store.create(createAgentData({ skills: ['go'] }))
      await store.adjustCredit(a1.id, { task_id: 't1', delta: 30, reason: 'x', timestamp: new Date() })

      const agents = await store.findBySkills(['go'])
      expect(agents).toHaveLength(2)
      expect(agents[0].id).toBe(a1.id)
      expect(agents[1].id).toBe(a2.id)
    })

    it('only returns active agents', async () => {
      await store.create(createAgentData({ skills: ['rust'], status: 'active' }))
      await store.create(createAgentData({ skills: ['rust'], status: 'suspended' }))

      const agents = await store.findBySkills(['rust'])
      expect(agents).toHaveLength(1)
      expect(agents[0].status).toBe('active')
    })

    it('returns empty for no skills', async () => {
      await store.create(createAgentData())
      const agents = await store.findBySkills([])
      expect(agents).toEqual([])
    })
  })

  describe('stats', () => {
    it('returns correct counts', async () => {
      await store.create(createAgentData({ type: 'human', status: 'active' }))
      await store.create(createAgentData({ type: 'human', status: 'inactive' }))
      await store.create(createAgentData({ type: 'ai', status: 'active' }))

      const stats = await store.stats()

      expect(stats.total).toBe(3)
      expect(stats.by_type.human).toBe(2)
      expect(stats.by_type.ai).toBe(1)
      expect(stats.by_status.active).toBe(2)
      expect(stats.by_status.inactive).toBe(1)
    })

    it('returns zero stats for empty store', async () => {
      const stats = await store.stats()

      expect(stats.total).toBe(0)
      expect(stats.by_type.human).toBe(0)
      expect(stats.by_type.ai).toBe(0)
      expect(stats.avg_credit_score).toBe(0)
    })

    it('calculates avg credit score', async () => {
      await store.create(createAgentData())
      await store.create(createAgentData())
      await store.create(createAgentData())

      const stats = await store.stats()
      expect(stats.avg_credit_score).toBe(100)
    })
  })
})
