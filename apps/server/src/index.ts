// apps/server/src/index.ts
// VertexHub Server - HTTP API with production-ready features

import http from 'http'
import Database from 'better-sqlite3'
import { SqliteEventStore, SqliteEntityStore, SqliteInsightStore, SqliteTaskStore, SqliteAgentStore, AgentService, TaskStateMachine, calculateContributionScore } from '@vertexhub/core'
import { RuleEngine } from '@vertexhub/core/src/engine/rule-engine'
import { generateWeeklyReport } from '@vertexhub/core/src/ai/weekly-report'
import { seedDemoData } from '@vertexhub/core/src/demo/seed-data'
import { loadConfig } from '@vertexhub/core/src/config'
import { getLogger } from '@vertexhub/core/src/logger'
import { NotFoundError, ValidationError } from '@vertexhub/core/src/errors'
import { createCorsMiddleware } from './middleware/cors'
import { createRateLimiter } from './middleware/rate-limiter'
import { createRequestLogger } from './middleware/request-logger'
import { createErrorHandler } from './middleware/error-handler'
import { createAuthMiddleware } from './middleware/auth'
import { parseBody } from './middleware/body-parser'
import { validate, validateQueryParams } from './middleware/validator'
import { createHealthChecker } from './health'

// Load and validate config
const config = loadConfig()
const logger = getLogger(config.LOG_LEVEL)

// Initialize database
const db = new Database(config.DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const eventStore = new SqliteEventStore(db)
const entityStore = new SqliteEntityStore(db)
const insightStore = new SqliteInsightStore(db)
const taskStore = new SqliteTaskStore(db)
const taskStateMachine = new TaskStateMachine()
const agentStore = new SqliteAgentStore(db)
const agentService = new AgentService(agentStore, taskStore, taskStateMachine)
const ruleEngine = new RuleEngine()
const healthChecker = createHealthChecker(db, logger)

// Seed demo data on first startup (non-production only)
if (config.NODE_ENV !== 'production') {
  const seedResult = seedDemoData(db)
  if (seedResult.seeded) {
    logger.info(`Seeded demo data: ${seedResult.events} events`)
  } else {
    logger.info(`Demo data already exists: ${seedResult.events} events`)
  }
}

// Auto-generate weekly report on startup
;(async () => {
  try {
    const events = await eventStore.query({ limit: 1000 })
    const weeklyReport = generateWeeklyReport(events)
    await insightStore.save(weeklyReport)
    logger.info('Weekly report generated', { id: weeklyReport.id })
  } catch (err) {
    logger.error('Failed to generate weekly report', { error: String(err) })
  }
})()

// Create middleware
const corsMiddleware = createCorsMiddleware({ origin: config.CORS_ORIGIN })
const rateLimiter = createRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
})
const authMiddleware = createAuthMiddleware({
  apiKey: config.API_KEY,
  publicPaths: ['/health'],
})
const requestLogger = createRequestLogger(logger)
const errorHandler = createErrorHandler(logger)

// Route handler
async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost:${config.PORT}`)

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    const health = await healthChecker.getHealth()
    const statusCode = health.status === 'unhealthy' ? 503 : 200
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(health))
    return
  }

  // System metrics
  if (url.pathname === '/metrics' && req.method === 'GET') {
    const metrics = healthChecker.getSystemMetrics()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(metrics))
    return
  }

  // API routes require /api prefix
  if (!url.pathname.startsWith('/api/')) {
    throw new NotFoundError('Route', url.pathname)
  }

  // Get insights
  if (url.pathname === '/api/insights' && req.method === 'GET') {
    const params = validateQueryParams(url.searchParams, {
      type: { type: 'string' },
    })
    const insights = await insightStore.list(params.type)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ insights }))
    return
  }

  // Get entities
  if (url.pathname === '/api/entities' && req.method === 'GET') {
    const params = validateQueryParams(url.searchParams, {
      type: { type: 'string' },
    })
    const entities = await entityStore.list(params.type)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ entities }))
    return
  }

  // Get events
  if (url.pathname === '/api/events' && req.method === 'GET') {
    const params = validateQueryParams(url.searchParams, {
      connector_id: { type: 'string' },
      type: { type: 'string' },
      limit: { type: 'number' },
    })
    const events = await eventStore.query({
      connector_id: params.connector_id,
      type: params.type,
      limit: params.limit || 50,
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ events }))
    return
  }

  // Generate daily summary
  if (url.pathname === '/api/insights/daily' && req.method === 'POST') {
    const events = await eventStore.query({ limit: 1000 })
    const insight = ruleEngine.generateDailySummary(events)
    await insightStore.save(insight)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ insight }))
    return
  }

  // Generate weekly report (rule-based, no AI)
  if (url.pathname === '/api/insights/weekly' && req.method === 'POST') {
    const events = await eventStore.query({ limit: 1000 })
    const insight = generateWeeklyReport(events)
    await insightStore.save(insight)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ insight }))
    return
  }

  // Agent routes

  // GET /api/agents/stats — must come before :id route
  if (url.pathname === '/api/agents/stats' && req.method === 'GET') {
    const stats = await agentStore.stats()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ stats }))
    return
  }

  // GET /api/agents — list agents with optional filters
  if (url.pathname === '/api/agents' && req.method === 'GET') {
    const params = validateQueryParams(url.searchParams, {
      status: { type: 'string' },
      type: { type: 'string' },
      skill: { type: 'string' },
      min_credit: { type: 'number' },
      limit: { type: 'number' },
    })
    const agents = await agentStore.list({
      status: params.status as any,
      type: params.type as any,
      skill: params.skill,
      min_credit: params.min_credit,
      limit: params.limit,
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ agents }))
    return
  }

  // GET /api/agents/:id/tasks — must come before :id route
  if (url.pathname.startsWith('/api/agents/') && req.method === 'GET') {
    const parts = url.pathname.split('/')
    if (parts.length === 5 && parts[4] === 'tasks') {
      const id = parts[3]
      if (!id) throw new ValidationError('Agent ID is required', 'id')
      const tasks = await agentService.getAgentTasks(id)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ tasks }))
      return
    }
  }

  // GET /api/agents/:id/credit — must come before :id route
  if (url.pathname.startsWith('/api/agents/') && req.method === 'GET') {
    const parts = url.pathname.split('/')
    if (parts.length === 5 && parts[4] === 'credit') {
      const id = parts[3]
      if (!id) throw new ValidationError('Agent ID is required', 'id')
      const agent = await agentStore.get(id)
      if (!agent) throw new NotFoundError('Agent', id)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ credit_history: agent.credit_history }))
      return
    }
  }

  // POST /api/agents/match — must come before :id route
  if (url.pathname === '/api/agents/match' && req.method === 'POST') {
    const body = (req as any).body
    if (!body.skills || !Array.isArray(body.skills)) {
      throw new ValidationError('skills array is required', 'skills')
    }
    const agents = await agentStore.findBySkills(body.skills, body.exclude)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ agents }))
    return
  }

  // GET /api/agents/:id
  if (url.pathname.startsWith('/api/agents/') && req.method === 'GET') {
    const id = url.pathname.split('/')[3]
    if (!id) throw new ValidationError('Agent ID is required', 'id')
    const agent = await agentStore.get(id)
    if (!agent) throw new NotFoundError('Agent', id)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ agent }))
    return
  }

  // POST /api/agents — create agent
  if (url.pathname === '/api/agents' && req.method === 'POST') {
    const body = (req as any).body
    if (!body.name) throw new ValidationError('name is required', 'name')
    if (!body.type) throw new ValidationError('type is required', 'type')
    const agent = await agentStore.create({
      name: body.name,
      type: body.type,
      email: body.email || null,
      avatar_url: body.avatar_url || null,
      skills: body.skills || [],
      bio: body.bio || '',
      max_concurrent_tasks: body.max_concurrent_tasks || 3,
      status: body.status || 'active',
      last_active_at: null,
    })
    res.writeHead(201, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ agent }))
    return
  }

  // PATCH /api/agents/:id — update agent
  if (url.pathname.startsWith('/api/agents/') && req.method === 'PATCH') {
    const id = url.pathname.split('/')[3]
    if (!id) throw new ValidationError('Agent ID is required', 'id')
    const body = (req as any).body
    const agent = await agentStore.update(id, body)
    if (!agent) throw new NotFoundError('Agent', id)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ agent }))
    return
  }

  // Task routes

  // GET /api/tasks/stats — must come before :id route
  if (url.pathname === '/api/tasks/stats' && req.method === 'GET') {
    const stats = await taskStore.stats()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ stats }))
    return
  }

  // GET /api/tasks — list tasks with optional filters
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

  // GET /api/tasks/:id
  if (url.pathname.startsWith('/api/tasks/') && req.method === 'GET') {
    const id = url.pathname.split('/')[3]
    if (!id) throw new ValidationError('Task ID is required', 'id')
    const task = await taskStore.get(id)
    if (!task) throw new NotFoundError('Task', id)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ task }))
    return
  }

  // POST /api/tasks — create task
  if (url.pathname === '/api/tasks' && req.method === 'POST') {
    const body = (req as any).body
    if (!body.title) throw new ValidationError('title is required', 'title')
    if (!body.creator_id) throw new ValidationError('creator_id is required', 'creator_id')
    const task = await taskStore.create({
      title: body.title,
      description: body.description || '',
      status: 'open',
      priority: body.priority || 'medium',
      type: body.type || 'task',
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

  // POST /api/tasks/claim
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

  // POST /api/tasks/start
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

  // POST /api/tasks/submit
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

  // POST /api/tasks/approve
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

  // POST /api/tasks/reject
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

  // POST /api/tasks/resubmit
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

  // POST /api/tasks/cancel
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

  throw new NotFoundError('Route', url.pathname)
}

// Create server
const server = http.createServer(async (req, res) => {
  const startTime = Date.now()

  // CORS
  if (corsMiddleware(req, res)) return

  // Rate limiting
  if (rateLimiter(req, res)) return

  // Auth
  if (authMiddleware(req, res)) return

  // Body parsing
  const body = await parseBody(req)
  ;(req as any).body = body

  // Request logging
  requestLogger(req, res, startTime)

  try {
    await handleRequest(req, res)
  } catch (error) {
    errorHandler(error as Error, req, res)
  }
})

// Graceful shutdown
let isShuttingDown = false

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true

  logger.info(`Received ${signal}, starting graceful shutdown`)

  server.close(() => {
    logger.info('HTTP server closed')
    db.close()
    logger.info('Database connection closed')
    process.exit(0)
  })

  // Force close after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack })
  gracefulShutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) })
})

// Start server
server.listen(config.PORT, () => {
  logger.info(`VertexHub server running on http://localhost:${config.PORT}`, {
    port: config.PORT,
    env: config.NODE_ENV,
    dbPath: config.DB_PATH,
  })
})

export { server }
