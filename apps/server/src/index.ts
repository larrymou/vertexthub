// apps/server/src/index.ts
// VertexHub Server - HTTP API with production-ready features

import http from 'http'
import Database from 'better-sqlite3'
import { SqliteEventStore, SqliteEntityStore, SqliteInsightStore } from '@vertexhub/core'
import { RuleEngine } from '@vertexhub/core/src/engine/rule-engine'
import { loadConfig } from '@vertexhub/core/src/config'
import { getLogger } from '@vertexhub/core/src/logger'
import { NotFoundError, ValidationError } from '@vertexhub/core/src/errors'
import { createCorsMiddleware } from './middleware/cors'
import { createRateLimiter } from './middleware/rate-limiter'
import { createRequestLogger } from './middleware/request-logger'
import { createErrorHandler } from './middleware/error-handler'
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
const ruleEngine = new RuleEngine()
const healthChecker = createHealthChecker(db, logger)

// Create middleware
const corsMiddleware = createCorsMiddleware({ origin: config.CORS_ORIGIN })
const rateLimiter = createRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
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
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503
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

  throw new NotFoundError('Route', url.pathname)
}

// Create server
const server = http.createServer(async (req, res) => {
  const startTime = Date.now()

  // CORS
  if (corsMiddleware(req, res)) return

  // Rate limiting
  if (rateLimiter(req, res)) return

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
