import http from 'http'
import Database from 'better-sqlite3'
import { SqliteEventStore, SqliteEntityStore, SqliteInsightStore, SqliteTaskStore, SqliteAgentStore, SqliteSkillStore, MatchEngine, AgentService, TaskStateMachine, calculateContributionScore } from '@vertexhub/core'
import { RuleEngine, generateWeeklyReport, seedDemoData, loadConfig, getLogger, NotFoundError, ValidationError } from '@vertexhub/core'
import { createCorsMiddleware } from './middleware/cors'
import { createRateLimiter } from './middleware/rate-limiter'
import { createRequestLogger } from './middleware/request-logger'
import { createErrorHandler } from './middleware/error-handler'
import { parseBody } from './middleware/body-parser'
import { validateQueryParams } from './middleware/validator'
import { createHealthChecker } from './health'

export function createTestServer() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const eventStore = new SqliteEventStore(db)
  const entityStore = new SqliteEntityStore(db)
  const insightStore = new SqliteInsightStore(db)
  const taskStore = new SqliteTaskStore(db)
  const taskStateMachine = new TaskStateMachine()
  const agentStore = new SqliteAgentStore(db)
  const agentService = new AgentService(agentStore, taskStore, taskStateMachine)
  const skillStore = new SqliteSkillStore(db)
  const matchEngine = new MatchEngine()
  const ruleEngine = new RuleEngine()
  const logger = getLogger('error')
  const healthChecker = createHealthChecker(db, logger)

  const corsMiddleware = createCorsMiddleware({ origin: '*' })
  const rateLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 100 })
  const requestLogger = createRequestLogger(logger)
  const errorHandler = createErrorHandler(logger)

  function avg(nums: number[]): number {
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  }

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', 'http://localhost:0')

    // Health check
    if (url.pathname === '/health' && req.method === 'GET') {
      const health = await healthChecker.getHealth()
      const statusCode = health.status === 'unhealthy' ? 503 : 200
      res.writeHead(statusCode, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(health))
      return
    }

    // API routes require /api prefix
    if (!url.pathname.startsWith('/api/')) {
      throw new NotFoundError('Route', url.pathname)
    }

    // Tasks
    if (url.pathname === '/api/tasks' && req.method === 'GET') {
      const params = validateQueryParams(url.searchParams, {
        status: { type: 'string' },
        assignee_id: { type: 'string' },
        creator_id: { type: 'string' },
        priority: { type: 'string' },
        type: { type: 'string' },
        limit: { type: 'number' },
      })
      const tasks = await taskStore.list({
        status: params.status as any,
        assignee_id: params.assignee_id,
        creator_id: params.creator_id,
        priority: params.priority as any,
        type: params.type,
        limit: params.limit,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ tasks }))
      return
    }
    if (url.pathname === '/api/tasks' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.title) throw new ValidationError('title is required', 'title')
      if (!body.creator_id) throw new ValidationError('creator_id is required', 'creator_id')
      const task = await taskStore.create({
        title: body.title, description: body.description || '', status: 'open',
        priority: body.priority || 'medium', type: body.type || 'task',
        creator_id: body.creator_id, assignee_id: null, started_at: null, completed_at: null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        entity_refs: body.entity_refs || [], tags: body.tags || [],
        deliverables: [], contribution_score: null, review_notes: null,
      })
      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ task }))
      return
    }
    if (url.pathname === '/api/tasks/stats' && req.method === 'GET') {
      const stats = await taskStore.stats()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ stats }))
      return
    }
    if (url.pathname.startsWith('/api/tasks/') && req.method === 'GET') {
      const parts = url.pathname.split('/')
      if (parts.length === 5 && parts[4] === 'skills') {
        const id = parts[3]
        if (!id) throw new ValidationError('Task ID is required', 'id')
        const skills = await skillStore.getTaskSkills(id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ skills }))
        return
      }
      const id = parts[3]
      if (!id) throw new ValidationError('Task ID is required', 'id')
      const task = await taskStore.get(id)
      if (!task) throw new NotFoundError('Task', id)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ task }))
      return
    }
    // Task state transitions
    if (url.pathname === '/api/tasks/claim' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.task_id) throw new ValidationError('task_id is required', 'task_id')
      if (!body.user_id) throw new ValidationError('user_id is required', 'user_id')
      const existing = await taskStore.get(body.task_id)
      if (!existing) throw new NotFoundError('Task', body.task_id)
      const updated = taskStateMachine.claim(existing, body.user_id)
      const saved = await taskStore.update(body.task_id, updated)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ task: saved }))
      return
    }
    if (url.pathname === '/api/tasks/start' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.task_id) throw new ValidationError('task_id is required', 'task_id')
      if (!body.user_id) throw new ValidationError('user_id is required', 'user_id')
      const existing = await taskStore.get(body.task_id)
      if (!existing) throw new NotFoundError('Task', body.task_id)
      const updated = taskStateMachine.start(existing, body.user_id)
      const saved = await taskStore.update(body.task_id, updated)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ task: saved }))
      return
    }
    if (url.pathname === '/api/tasks/submit' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.task_id) throw new ValidationError('task_id is required', 'task_id')
      if (!body.user_id) throw new ValidationError('user_id is required', 'user_id')
      const existing = await taskStore.get(body.task_id)
      if (!existing) throw new NotFoundError('Task', body.task_id)
      const updated = taskStateMachine.submitForReview(existing, body.user_id)
      const saved = await taskStore.update(body.task_id, updated)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ task: saved }))
      return
    }
    if (url.pathname === '/api/tasks/approve' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.task_id) throw new ValidationError('task_id is required', 'task_id')
      if (!body.user_id) throw new ValidationError('user_id is required', 'user_id')
      const existing = await taskStore.get(body.task_id)
      if (!existing) throw new NotFoundError('Task', body.task_id)
      let score = body.score
      if (score === undefined || score === null) {
        if (existing.started_at && existing.deadline) {
          const calculated = calculateContributionScore({
            started_at: existing.started_at,
            completed_at: new Date(),
            deadline: existing.deadline,
            priority: existing.priority,
            type: existing.type,
          })
          score = calculated ?? 50
        } else {
          score = 50
        }
      }
      const updated = taskStateMachine.approve(existing, body.user_id, score, body.notes)
      const saved = await taskStore.update(body.task_id, updated)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ task: saved }))
      return
    }
    if (url.pathname === '/api/tasks/reject' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.task_id) throw new ValidationError('task_id is required', 'task_id')
      if (!body.user_id) throw new ValidationError('user_id is required', 'user_id')
      if (!body.notes) throw new ValidationError('notes is required for rejection', 'notes')
      const existing = await taskStore.get(body.task_id)
      if (!existing) throw new NotFoundError('Task', body.task_id)
      const updated = taskStateMachine.reject(existing, body.user_id, body.notes)
      const saved = await taskStore.update(body.task_id, updated)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ task: saved }))
      return
    }
    if (url.pathname === '/api/tasks/resubmit' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.task_id) throw new ValidationError('task_id is required', 'task_id')
      if (!body.user_id) throw new ValidationError('user_id is required', 'user_id')
      const existing = await taskStore.get(body.task_id)
      if (!existing) throw new NotFoundError('Task', body.task_id)
      const updated = taskStateMachine.resubmit(existing, body.user_id)
      const saved = await taskStore.update(body.task_id, updated)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ task: saved }))
      return
    }
    if (url.pathname === '/api/tasks/cancel' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.task_id) throw new ValidationError('task_id is required', 'task_id')
      if (!body.user_id) throw new ValidationError('user_id is required', 'user_id')
      const existing = await taskStore.get(body.task_id)
      if (!existing) throw new NotFoundError('Task', body.task_id)
      const updated = taskStateMachine.cancel(existing, body.user_id)
      const saved = await taskStore.update(body.task_id, updated)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ task: saved }))
      return
    }

    // Agents
    if (url.pathname === '/api/agents/stats' && req.method === 'GET') {
      const stats = await agentStore.stats()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ stats }))
      return
    }
    if (url.pathname === '/api/agents' && req.method === 'GET') {
      const params = validateQueryParams(url.searchParams, {
        status: { type: 'string' },
        type: { type: 'string' },
        limit: { type: 'number' },
      })
      const agents = await agentStore.list({
        status: params.status as any,
        type: params.type as any,
        limit: params.limit,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ agents }))
      return
    }
    if (url.pathname === '/api/agents' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.name) throw new ValidationError('name is required', 'name')
      if (!body.type) throw new ValidationError('type is required', 'type')
      const agent = await agentStore.create({
        name: body.name, type: body.type, email: body.email || null,
        avatar_url: body.avatar_url || null, skills: body.skills || [], bio: body.bio || '',
        status: body.status || 'active', max_concurrent_tasks: body.max_concurrent_tasks || 3,
        last_active_at: null,
      })
      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ agent }))
      return
    }
    if (url.pathname.match(/^\/api\/agents\/[^/]+$/) && req.method === 'GET') {
      const id = url.pathname.split('/')[3]
      if (!id) throw new ValidationError('Agent ID is required', 'id')
      const agent = await agentStore.get(id)
      if (!agent) throw new NotFoundError('Agent', id)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ agent }))
      return
    }

    // Skills
    if (url.pathname === '/api/skills' && req.method === 'GET') {
      const params = validateQueryParams(url.searchParams, {
        category: { type: 'string' },
        parent_id: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'number' },
      })
      const skills = await skillStore.list({
        category: params.category,
        parent_id: params.parent_id,
        search: params.search,
        limit: params.limit,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ skills }))
      return
    }
    if (url.pathname === '/api/skills' && req.method === 'POST') {
      const body = (req as any).body
      if (!body.name) throw new ValidationError('name is required', 'name')
      if (!body.display_name) throw new ValidationError('display_name is required', 'display_name')
      if (!body.category) throw new ValidationError('category is required', 'category')
      const skill = await skillStore.create({
        name: body.name, display_name: body.display_name, category: body.category,
        description: body.description || '', parent_id: body.parent_id || null,
      })
      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ skill }))
      return
    }

    // Match
    if (url.pathname.match(/^\/api\/tasks\/[^/]+\/match$/) && req.method === 'POST') {
      const taskId = url.pathname.split('/')[3]
      const taskSkills = await skillStore.getTaskSkills(taskId)
      if (taskSkills.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ results: [] }))
        return
      }
      const agents = await agentStore.list({ status: 'active' })
      const agentSkillsMap = new Map()
      for (const a of agents) {
        agentSkillsMap.set(a.id, await skillStore.getAgentSkills(a.id))
      }
      const results = matchEngine.matchAgents(taskSkills, agents, agentSkillsMap)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ results }))
      return
    }

    // Metrics
    if (url.pathname === '/api/metrics/verification' && req.method === 'GET') {
      const tasks = await taskStore.list()
      const agents = await agentStore.list()
      const stats = await taskStore.stats()
      const doneTasks = tasks.filter(t => t.status === 'done')
      const cancelledTasks = tasks.filter(t => t.status === 'cancelled')
      const decisionTimes = tasks.filter(t => t.started_at && t.created_at).map(t => (new Date(t.started_at!).getTime() - new Date(t.created_at).getTime()) / 3600000)
      const deliveryTimes = doneTasks.filter(t => t.started_at && t.completed_at).map(t => (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 3600000)
      const activeAgents = agents.filter(a => a.status === 'active')
      const scores = doneTasks.filter(t => t.contribution_score !== null).map(t => t.contribution_score!)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        efficiency: { avg_decision_hours: avg(decisionTimes), avg_delivery_hours: avg(deliveryTimes), decision_count: decisionTimes.length },
        output: { completion_rate: stats.completion_rate, tasks_per_agent: activeAgents.length > 0 ? doneTasks.length / activeAgents.length : 0, total_done: doneTasks.length },
        health: { avg_contribution_score: avg(scores), cancel_rate: tasks.length > 0 ? cancelledTasks.length / tasks.length : 0, active_agent_count: activeAgents.length, total_agents: agents.length },
      }))
      return
    }

    throw new NotFoundError('Route', url.pathname)
  }

  const server = http.createServer(async (req, res) => {
    if (corsMiddleware(req, res)) return
    if (rateLimiter(req, res)) return
    requestLogger(req, res, Date.now())
    const body = await parseBody(req)
    ;(req as any).body = body
    try {
      await handleRequest(req, res)
    } catch (error) {
      errorHandler(error as Error, req, res)
    }
  })

  return { server, db, stores: { eventStore, entityStore, insightStore, taskStore, agentStore, skillStore } }
}

export function request(server: http.Server, method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address()
    if (!addr || typeof addr === 'object' && addr === null) return reject(new Error('Server not listening'))
    const port = typeof addr === 'object' ? addr.port : 0
    const options = { hostname: '127.0.0.1', port, method, path, headers: { 'Content-Type': 'application/json' } }
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString()
        try { resolve({ status: res.statusCode!, data: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode!, data: raw }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}
