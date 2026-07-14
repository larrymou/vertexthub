import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import { createTestServer, request } from './test-helper'

describe('VertexHub Server', () => {
  let server: http.Server
  let db: any
  let stores: any

  beforeAll(async () => {
    const test = createTestServer()
    server = test.server
    db = test.db
    stores = test.stores
    await new Promise<void>(resolve => server.listen(0, resolve))
  })

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
    db.close()
  })

  describe('Health', () => {
    it('GET /health returns healthy status', async () => {
      const res = await request(server, 'GET', '/health')
      expect(res.status).toBe(200)
      expect(res.data.status).toBe('healthy')
      expect(res.data.version).toBeDefined()
      expect(res.data.checks).toBeDefined()
      expect(res.data.checks.database.status).toBe('pass')
    })
  })

  describe('Tasks', () => {
    it('POST /api/tasks creates a task', async () => {
      const res = await request(server, 'POST', '/api/tasks', {
        title: 'Test task', creator_id: 'alice', priority: 'high', type: 'feature',
      })
      expect(res.status).toBe(201)
      expect(res.data.task.title).toBe('Test task')
      expect(res.data.task.status).toBe('open')
      expect(res.data.task.priority).toBe('high')
      expect(res.data.task.type).toBe('feature')
      expect(res.data.task.creator_id).toBe('alice')
      expect(res.data.task.id).toBeDefined()
    })

    it('POST /api/tasks validates required fields', async () => {
      const noTitle = await request(server, 'POST', '/api/tasks', { creator_id: 'alice' })
      expect(noTitle.status).toBe(400)
      expect(noTitle.data.error.code).toBe('VALIDATION_ERROR')

      const noCreator = await request(server, 'POST', '/api/tasks', { title: 'Test' })
      expect(noCreator.status).toBe(400)
    })

    it('GET /api/tasks lists tasks', async () => {
      await request(server, 'POST', '/api/tasks', { title: 'List test', creator_id: 'alice' })
      const res = await request(server, 'GET', '/api/tasks')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.tasks)).toBe(true)
      expect(res.data.tasks.length).toBeGreaterThan(0)
    })

    it('GET /api/tasks supports status filter', async () => {
      const res = await request(server, 'GET', '/api/tasks?status=open')
      expect(res.status).toBe(200)
      for (const task of res.data.tasks) {
        expect(task.status).toBe('open')
      }
    })

    it('GET /api/tasks/:id returns a task', async () => {
      const create = await request(server, 'POST', '/api/tasks', { title: 'Detail task', creator_id: 'alice' })
      const res = await request(server, 'GET', `/api/tasks/${create.data.task.id}`)
      expect(res.status).toBe(200)
      expect(res.data.task.title).toBe('Detail task')
      expect(res.data.task.id).toBe(create.data.task.id)
    })

    it('GET /api/tasks/:id returns 404 for nonexistent', async () => {
      const res = await request(server, 'GET', '/api/tasks/nonexistent')
      expect(res.status).toBe(404)
      expect(res.data.error.code).toBe('NOT_FOUND')
    })

    it('POST /api/tasks/claim assigns a task', async () => {
      const create = await request(server, 'POST', '/api/tasks', { title: 'Claim test', creator_id: 'alice' })
      const res = await request(server, 'POST', '/api/tasks/claim', { task_id: create.data.task.id, user_id: 'bob' })
      expect(res.status).toBe(200)
      expect(res.data.task.status).toBe('assigned')
      expect(res.data.task.assignee_id).toBe('bob')
    })

    it('POST /api/tasks/claim validates required fields', async () => {
      const res = await request(server, 'POST', '/api/tasks/claim', { user_id: 'bob' })
      expect(res.status).toBe(400)
    })

    it('POST /api/tasks/full lifecycle works', async () => {
      const create = await request(server, 'POST', '/api/tasks', { title: 'Lifecycle', creator_id: 'alice' })
      const taskId = create.data.task.id

      await request(server, 'POST', '/api/tasks/claim', { task_id: taskId, user_id: 'bob' })

      const start = await request(server, 'POST', '/api/tasks/start', { task_id: taskId, user_id: 'bob' })
      expect(start.data.task.status).toBe('in_progress')

      const submit = await request(server, 'POST', '/api/tasks/submit', { task_id: taskId, user_id: 'bob' })
      expect(submit.data.task.status).toBe('review')

      const approve = await request(server, 'POST', '/api/tasks/approve', { task_id: taskId, user_id: 'alice', score: 85 })
      expect(approve.data.task.status).toBe('done')
      expect(approve.data.task.contribution_score).toBe(85)
    })

    it('POST /api/tasks/reject and resubmit works', async () => {
      const create = await request(server, 'POST', '/api/tasks', { title: 'Reject test', creator_id: 'alice' })
      const taskId = create.data.task.id
      await request(server, 'POST', '/api/tasks/claim', { task_id: taskId, user_id: 'bob' })
      await request(server, 'POST', '/api/tasks/start', { task_id: taskId, user_id: 'bob' })
      await request(server, 'POST', '/api/tasks/submit', { task_id: taskId, user_id: 'bob' })

      const reject = await request(server, 'POST', '/api/tasks/reject', { task_id: taskId, user_id: 'alice', notes: 'Needs work' })
      expect(reject.data.task.status).toBe('revision')
      expect(reject.data.task.review_notes).toBe('Needs work')

      const resubmit = await request(server, 'POST', '/api/tasks/resubmit', { task_id: taskId, user_id: 'bob' })
      expect(resubmit.data.task.status).toBe('review')
    })

    it('POST /api/tasks/reject requires notes', async () => {
      const create = await request(server, 'POST', '/api/tasks', { title: 'No notes reject', creator_id: 'alice' })
      const taskId = create.data.task.id
      await request(server, 'POST', '/api/tasks/claim', { task_id: taskId, user_id: 'bob' })
      await request(server, 'POST', '/api/tasks/start', { task_id: taskId, user_id: 'bob' })
      await request(server, 'POST', '/api/tasks/submit', { task_id: taskId, user_id: 'bob' })

      const res = await request(server, 'POST', '/api/tasks/reject', { task_id: taskId, user_id: 'alice' })
      expect(res.status).toBe(400)
    })

    it('POST /api/tasks/cancel cancels a task', async () => {
      const create = await request(server, 'POST', '/api/tasks', { title: 'Cancel test', creator_id: 'alice' })
      const taskId = create.data.task.id
      const res = await request(server, 'POST', '/api/tasks/cancel', { task_id: taskId, user_id: 'alice' })
      expect(res.status).toBe(200)
      expect(res.data.task.status).toBe('cancelled')
    })

    it('GET /api/tasks/stats returns statistics', async () => {
      const res = await request(server, 'GET', '/api/tasks/stats')
      expect(res.status).toBe(200)
      expect(res.data.stats).toBeDefined()
      expect(res.data.stats.total).toBeGreaterThan(0)
      expect(res.data.stats.by_status).toBeDefined()
    })
  })

  describe('Agents', () => {
    it('POST /api/agents creates an agent', async () => {
      const res = await request(server, 'POST', '/api/agents', { name: 'Alice', type: 'human', skills: ['typescript', 'react'] })
      expect(res.status).toBe(201)
      expect(res.data.agent.name).toBe('Alice')
      expect(res.data.agent.type).toBe('human')
      expect(res.data.agent.skills).toEqual(['typescript', 'react'])
      expect(res.data.agent.status).toBe('active')
      expect(res.data.agent.id).toBeDefined()
    })

    it('POST /api/agents validates required fields', async () => {
      const noName = await request(server, 'POST', '/api/agents', { type: 'human' })
      expect(noName.status).toBe(400)

      const noType = await request(server, 'POST', '/api/agents', { name: 'Test' })
      expect(noType.status).toBe(400)
    })

    it('GET /api/agents lists agents', async () => {
      await request(server, 'POST', '/api/agents', { name: 'ListAgent', type: 'human' })
      const res = await request(server, 'GET', '/api/agents')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.agents)).toBe(true)
      expect(res.data.agents.length).toBeGreaterThan(0)
    })

    it('GET /api/agents/:id returns an agent', async () => {
      const create = await request(server, 'POST', '/api/agents', { name: 'Bob', type: 'human' })
      const res = await request(server, 'GET', `/api/agents/${create.data.agent.id}`)
      expect(res.status).toBe(200)
      expect(res.data.agent.name).toBe('Bob')
    })

    it('GET /api/agents/:id returns 404 for nonexistent', async () => {
      const res = await request(server, 'GET', '/api/agents/nonexistent')
      expect(res.status).toBe(404)
    })

    it('GET /api/agents/stats returns statistics', async () => {
      const res = await request(server, 'GET', '/api/agents/stats')
      expect(res.status).toBe(200)
      expect(res.data.stats).toBeDefined()
      expect(res.data.stats.total).toBeGreaterThan(0)
    })
  })

  describe('Skills', () => {
    it('POST /api/skills creates a skill', async () => {
      const res = await request(server, 'POST', '/api/skills', {
        name: 'typescript', display_name: 'TypeScript', category: 'frontend',
      })
      expect(res.status).toBe(201)
      expect(res.data.skill.name).toBe('typescript')
      expect(res.data.skill.display_name).toBe('TypeScript')
      expect(res.data.skill.category).toBe('frontend')
    })

    it('POST /api/skills validates required fields', async () => {
      const noName = await request(server, 'POST', '/api/skills', { display_name: 'Test', category: 'general' })
      expect(noName.status).toBe(400)

      const noDisplayName = await request(server, 'POST', '/api/skills', { name: 'test', category: 'general' })
      expect(noDisplayName.status).toBe(400)

      const noCategory = await request(server, 'POST', '/api/skills', { name: 'test', display_name: 'Test' })
      expect(noCategory.status).toBe(400)
    })

    it('GET /api/skills lists skills', async () => {
      await request(server, 'POST', '/api/skills', { name: 'react', display_name: 'React', category: 'frontend' })
      const res = await request(server, 'GET', '/api/skills')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.skills)).toBe(true)
      expect(res.data.skills.length).toBeGreaterThan(0)
    })
  })

  describe('Metrics', () => {
    it('GET /api/metrics/verification returns metrics', async () => {
      const res = await request(server, 'GET', '/api/metrics/verification')
      expect(res.status).toBe(200)
      expect(res.data.efficiency).toBeDefined()
      expect(typeof res.data.efficiency.avg_decision_hours).toBe('number')
      expect(typeof res.data.efficiency.avg_delivery_hours).toBe('number')
      expect(typeof res.data.efficiency.decision_count).toBe('number')
      expect(res.data.output).toBeDefined()
      expect(typeof res.data.output.completion_rate).toBe('number')
      expect(res.data.health).toBeDefined()
      expect(typeof res.data.health.active_agent_count).toBe('number')
    })
  })

  describe('Error handling', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(server, 'GET', '/api/nonexistent')
      expect(res.status).toBe(404)
      expect(res.data.error).toBeDefined()
      expect(res.data.error.code).toBe('NOT_FOUND')
    })

    it('returns 404 for non-API routes', async () => {
      const res = await request(server, 'GET', '/something')
      expect(res.status).toBe(404)
    })

    it('returns proper error format', async () => {
      const res = await request(server, 'GET', '/api/unknown')
      expect(res.data).toHaveProperty('error')
      expect(res.data.error).toHaveProperty('code')
      expect(res.data.error).toHaveProperty('message')
    })
  })
})
