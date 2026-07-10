// apps/server/src/index.ts
// VertexHub Server - HTTP API

import Database from 'better-sqlite3'
import { SqliteEventStore, SqliteEntityStore, SqliteInsightStore } from '@vertexhub/core'
import { RuleEngine } from '@vertexhub/core/src/engine/rule-engine'

const PORT = process.env.PORT || 3000
const DB_PATH = process.env.DB_PATH || './data/vertexhub.db'

// 初始化数据库
const db = new Database(DB_PATH)
const eventStore = new SqliteEventStore(db)
const entityStore = new SqliteEntityStore(db)
const insightStore = new SqliteInsightStore(db)
const ruleEngine = new RuleEngine()

// 简单 HTTP 服务器
import http from 'http'

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  try {
    // Health check
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }))
      return
    }

    // Get insights
    if (url.pathname === '/api/insights' && req.method === 'GET') {
      const type = url.searchParams.get('type') || undefined
      const insights = await insightStore.list(type)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ insights }))
      return
    }

    // Get entities
    if (url.pathname === '/api/entities' && req.method === 'GET') {
      const type = url.searchParams.get('type') || undefined
      const entities = await entityStore.list(type)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ entities }))
      return
    }

    // Get events
    if (url.pathname === '/api/events' && req.method === 'GET') {
      const connector_id = url.searchParams.get('connector_id') || undefined
      const type = url.searchParams.get('type') || undefined
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const events = await eventStore.query({ connector_id, type, limit })
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

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  } catch (error) {
    console.error('Error:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
})

server.listen(PORT, () => {
  console.log(`VertexHub server running on http://localhost:${PORT}`)
})
