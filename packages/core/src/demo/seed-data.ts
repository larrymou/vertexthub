// packages/core/src/demo/seed-data.ts
// 预置 Demo 数据 - 模拟 hermes 项目真实 GitHub 数据

import Database from 'better-sqlite3'
import { RawEvent } from '../types'

const AUTHORS = ['alice', 'bob', 'charlie', 'diana', 'eve', 'frank']
const PROJECT = 'hermes'

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60), 0, 0)
  return d
}

function generatePREvents(): RawEvent[] {
  const prs = [
    { number: 201, title: 'feat: implement OAuth2 authentication flow', author: 'alice', state: 'merged', merged: true, createdDaysAgo: 6, mergedDaysAgo: 4, labels: ['feature', 'auth'] },
    { number: 202, title: 'fix: resolve race condition in session manager', author: 'bob', state: 'merged', merged: true, createdDaysAgo: 5, mergedDaysAgo: 3, labels: ['bug', 'urgent'] },
    { number: 203, title: 'refactor: extract database connection pool', author: 'charlie', state: 'merged', merged: true, createdDaysAgo: 4, mergedDaysAgo: 2, labels: ['refactor'] },
    { number: 204, title: 'feat: add rate limiting middleware', author: 'diana', state: 'merged', merged: true, createdDaysAgo: 3, mergedDaysAgo: 1, labels: ['feature', 'security'] },
    { number: 205, title: 'fix: memory leak in WebSocket handler', author: 'alice', state: 'merged', merged: true, createdDaysAgo: 2, mergedDaysAgo: 0, labels: ['bug', 'performance'] },
    { number: 206, title: 'feat: implement user profile API endpoints', author: 'eve', state: 'open', merged: false, createdDaysAgo: 2, labels: ['feature'] },
    { number: 207, title: 'docs: update API documentation for v2', author: 'frank', state: 'open', merged: false, createdDaysAgo: 1, labels: ['docs'] },
    { number: 208, title: 'feat: add batch export functionality', author: 'bob', state: 'open', merged: false, createdDaysAgo: 1, labels: ['feature'] },
    { number: 209, title: 'fix: pagination offset bug in list queries', author: 'charlie', state: 'open', merged: false, createdDaysAgo: 0, labels: ['bug'] },
    { number: 210, title: 'chore: upgrade dependencies to latest versions', author: 'diana', state: 'closed', merged: false, createdDaysAgo: 7, labels: ['chore'] },
    { number: 211, title: 'feat: add webhook notification system', author: 'alice', state: 'merged', merged: true, createdDaysAgo: 7, mergedDaysAgo: 5, labels: ['feature'] },
    { number: 212, title: 'fix: resolve CSS import ordering issue', author: 'frank', state: 'merged', merged: true, createdDaysAgo: 5, mergedDaysAgo: 4, labels: ['bug', 'frontend'] },
    { number: 213, title: 'feat: implement search autocomplete', author: 'eve', state: 'open', merged: false, createdDaysAgo: 0, labels: ['feature', 'frontend'] },
    { number: 214, title: 'perf: optimize N+1 query in dashboard', author: 'bob', state: 'merged', merged: true, createdDaysAgo: 6, mergedDaysAgo: 5, labels: ['performance'] },
    { number: 215, title: 'feat: add dark mode toggle', author: 'charlie', state: 'open', merged: false, createdDaysAgo: 3, labels: ['feature', 'frontend'] },
  ]

  return prs.flatMap((pr, idx) => {
    const events: RawEvent[] = []
    const created = daysAgo(pr.createdDaysAgo)

    events.push({
      id: `pr-${pr.number}-created`,
      connector_id: 'github',
      timestamp: created,
      ingested_at: created,
      type: 'pull_request',
      payload: {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.author,
        merged: false,
        action: 'opened',
        labels: pr.labels,
        repository: PROJECT,
      },
      entity_refs: [`pr-${pr.number}`, `repo-${PROJECT}`],
      checksum: `pr-${pr.number}-created`,
    })

    if (pr.merged) {
      events.push({
        id: `pr-${pr.number}-merged`,
        connector_id: 'github',
        timestamp: daysAgo(pr.mergedDaysAgo!),
        ingested_at: daysAgo(pr.mergedDaysAgo!),
        type: 'pull_request',
        payload: {
          number: pr.number,
          title: pr.title,
          state: 'merged',
          author: pr.author,
          merged: true,
          action: 'merged',
          labels: pr.labels,
          repository: PROJECT,
        },
        entity_refs: [`pr-${pr.number}`, `repo-${PROJECT}`],
        checksum: `pr-${pr.number}-merged`,
      })
    }

    return events
  })
}

function generateIssueEvents(): RawEvent[] {
  const issues = [
    { number: 301, title: 'Login fails with special characters in password', author: 'eve', state: 'closed', labels: ['bug', 'auth'], createdDaysAgo: 6, closedDaysAgo: 2 },
    { number: 302, title: 'Add support for SSO integration', author: 'alice', state: 'open', labels: ['feature', 'auth'], createdDaysAgo: 5 },
    { number: 303, title: 'Dashboard loads slowly with 1000+ items', author: 'bob', state: 'open', labels: ['bug', 'performance'], createdDaysAgo: 4 },
    { number: 304, title: 'Implement two-factor authentication', author: 'charlie', state: 'open', labels: ['feature', 'security'], createdDaysAgo: 4 },
    { number: 305, title: 'API rate limit headers missing', author: 'diana', state: 'closed', labels: ['bug', 'api'], createdDaysAgo: 3, closedDaysAgo: 1 },
    { number: 306, title: 'Add export to CSV feature', author: 'frank', state: 'open', labels: ['feature'], createdDaysAgo: 3 },
    { number: 307, title: 'Update deployment documentation', author: 'eve', state: 'closed', labels: ['docs'], createdDaysAgo: 7, closedDaysAgo: 5 },
    { number: 308, title: 'WebSocket connection drops under load', author: 'alice', state: 'open', labels: ['bug', 'urgent'], createdDaysAgo: 2 },
    { number: 309, title: 'Add keyboard shortcuts for navigation', author: 'bob', state: 'open', labels: ['feature', 'frontend'], createdDaysAgo: 2 },
    { number: 310, title: 'Mobile responsive layout broken', author: 'charlie', state: 'open', labels: ['bug', 'frontend'], createdDaysAgo: 1 },
    { number: 311, title: 'Implement audit log for admin actions', author: 'diana', state: 'open', labels: ['feature', 'security'], createdDaysAgo: 1 },
    { number: 312, title: 'Fix timezone display in activity feed', author: 'frank', state: 'closed', labels: ['bug'], createdDaysAgo: 5, closedDaysAgo: 3 },
    { number: 313, title: 'Add batch user import via CSV', author: 'alice', state: 'open', labels: ['feature'], createdDaysAgo: 0 },
    { number: 314, title: 'Notification preferences page missing', author: 'eve', state: 'open', labels: ['feature', 'frontend'], createdDaysAgo: 0 },
    { number: 315, title: 'Database migration script fails on SQLite', author: 'bob', state: 'closed', labels: ['bug', 'database'], createdDaysAgo: 4, closedDaysAgo: 4 },
  ]

  return issues.flatMap((issue) => {
    const events: RawEvent[] = []
    const created = daysAgo(issue.createdDaysAgo)

    events.push({
      id: `issue-${issue.number}-created`,
      connector_id: 'github',
      timestamp: created,
      ingested_at: created,
      type: 'issue',
      payload: {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author: issue.author,
        action: 'opened',
        labels: issue.labels,
        repository: PROJECT,
      },
      entity_refs: [`issue-${issue.number}`, `repo-${PROJECT}`],
      checksum: `issue-${issue.number}-created`,
    })

    if (issue.state === 'closed' && issue.closedDaysAgo) {
      events.push({
        id: `issue-${issue.number}-closed`,
        connector_id: 'github',
        timestamp: daysAgo(issue.closedDaysAgo),
        ingested_at: daysAgo(issue.closedDaysAgo),
        type: 'issue',
        payload: {
          number: issue.number,
          title: issue.title,
          state: 'closed',
          author: issue.author,
          action: 'closed',
          labels: issue.labels,
          repository: PROJECT,
        },
        entity_refs: [`issue-${issue.number}`, `repo-${PROJECT}`],
        checksum: `issue-${issue.number}-closed`,
      })
    }

    return events
  })
}

function generateCommitEvents(): RawEvent[] {
  const commits = [
    { sha: 'a1b2c3d', message: 'feat: add OAuth2 provider configuration', author: 'alice', prNumber: 201 },
    { sha: 'e4f5g6h', message: 'test: add unit tests for auth flow', author: 'alice', prNumber: 201 },
    { sha: 'i7j8k9l', message: 'fix: handle token refresh edge case', author: 'alice', prNumber: 201 },
    { sha: 'm0n1o2p', message: 'fix: acquire lock before session mutation', author: 'bob', prNumber: 202 },
    { sha: 'q3r4s5t', message: 'test: add concurrent session test', author: 'bob', prNumber: 202 },
    { sha: 'u6v7w8x', message: 'refactor: create ConnectionPool class', author: 'charlie', prNumber: 203 },
    { sha: 'y9z0a1b', message: 'refactor: migrate existing code to use pool', author: 'charlie', prNumber: 203 },
    { sha: 'c2d3e4f', message: 'feat: implement sliding window rate limiter', author: 'diana', prNumber: 204 },
    { sha: 'g5h6i7j', message: 'feat: add rate limit headers to responses', author: 'diana', prNumber: 204 },
    { sha: 'k8l9m0n', message: 'fix: clear interval on socket close', author: 'alice', prNumber: 205 },
    { sha: 'o1p2q3r', message: 'perf: use weak reference for idle connections', author: 'alice', prNumber: 205 },
    { sha: 's4t5u6v', message: 'feat: add GET /users/:id/profile endpoint', author: 'eve', prNumber: 206 },
    { sha: 'w7x8y9z', message: 'feat: add PATCH /users/:id/profile endpoint', author: 'eve', prNumber: 206 },
    { sha: 'a0b1c2d', message: 'docs: add authentication guide', author: 'frank', prNumber: 207 },
    { sha: 'e3f4g5h', message: 'docs: add rate limiting section', author: 'frank', prNumber: 207 },
    { sha: 'i6j7k8l', message: 'feat: implement CSV batch export', author: 'bob', prNumber: 208 },
    { sha: 'm9n0o1p', message: 'fix: correct offset calculation in paginated list', author: 'charlie', prNumber: 209 },
    { sha: 'q2r3s4t', message: 'feat: add webhook registration endpoint', author: 'alice', prNumber: 211 },
    { sha: 'u5v6w7x', message: 'feat: implement webhook delivery with retry', author: 'alice', prNumber: 211 },
    { sha: 'y8z9a0b', message: 'feat: add webhook event filtering', author: 'alice', prNumber: 211 },
    { sha: 'c1d2e3f', message: 'fix: normalize CSS import paths', author: 'frank', prNumber: 212 },
    { sha: 'g4h5i6j', message: 'perf: add database index for dashboard query', author: 'bob', prNumber: 214 },
    { sha: 'k7l8m9n', message: 'perf: implement query result caching', author: 'bob', prNumber: 214 },
    { sha: 'o0p1q2r', message: 'feat: add search input component', author: 'eve', prNumber: 213 },
    { sha: 's3t4u5v', message: 'feat: implement debounced search API call', author: 'eve', prNumber: 213 },
    { sha: 'w6x7y8z', message: 'feat: add dark mode CSS variables', author: 'charlie', prNumber: 215 },
    { sha: 'a9b0c1d', message: 'feat: implement theme toggle component', author: 'charlie', prNumber: 215 },
    { sha: 'e2f3g4h', message: 'fix: resolve mobile login form validation', author: 'eve', prNumber: 301 },
    { sha: 'i5j6k7l', message: 'fix: add missing rate limit error response', author: 'diana', prNumber: 305 },
    { sha: 'm8n9o0p', message: 'fix: update timezone utility function', author: 'frank', prNumber: 312 },
    { sha: 'q1r2s3t', message: 'fix: correct SQLite migration column type', author: 'bob', prNumber: 315 },
  ]

  return commits.map((commit, idx) => {
    const daysAgoVal = Math.floor(idx / 5)
    const ts = daysAgo(Math.min(daysAgoVal, 6))
    return {
      id: `commit-${commit.sha}`,
      connector_id: 'github',
      timestamp: ts,
      ingested_at: ts,
      type: 'commit',
      payload: {
        sha: commit.sha,
        message: commit.message,
        author: commit.author,
        repository: PROJECT,
        prNumber: commit.prNumber,
      },
      entity_refs: [`pr-${commit.prNumber}`, `repo-${PROJECT}`],
      checksum: `commit-${commit.sha}`,
    }
  })
}

export function generateDemoData(): RawEvent[] {
  return [
    ...generatePREvents(),
    ...generateIssueEvents(),
    ...generateCommitEvents(),
  ]
}

export function seedDemoData(db: Database.Database): { events: number; seeded: boolean } {
  const existing = db.prepare('SELECT COUNT(*) as count FROM raw_events').get() as { count: number }
  if (existing.count > 0) {
    return { events: existing.count, seeded: false }
  }

  const events = generateDemoData()
  const insert = db.prepare(`
    INSERT INTO raw_events (id, connector_id, type, payload, entity_refs, checksum, timestamp, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = db.transaction((events: RawEvent[]) => {
    for (const event of events) {
      insert.run(
        event.id,
        event.connector_id,
        event.type,
        JSON.stringify(event.payload),
        JSON.stringify(event.entity_refs),
        event.checksum,
        event.timestamp.toISOString(),
        event.ingested_at.toISOString()
      )
    }
  })

  insertMany(events)

  // Seed demo entities
  const upsertEntity = db.prepare(`
    INSERT INTO entities (id, type, status, attributes, consistency_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      attributes = excluded.attributes,
      updated_at = excluded.updated_at
  `)

  const entities = [
    { id: `repo-${PROJECT}`, type: 'repository', status: 'active', attributes: { name: PROJECT, description: 'Hermes - Internal Developer Platform', language: 'TypeScript', stars: 142 } },
    { id: 'user-alice', type: 'person', status: 'active', attributes: { name: 'Alice Chen', role: 'Tech Lead', commits: 8, prs: 3 } },
    { id: 'user-bob', type: 'person', status: 'active', attributes: { name: 'Bob Wang', role: 'Backend Developer', commits: 6, prs: 3 } },
    { id: 'user-charlie', type: 'person', status: 'active', attributes: { name: 'Charlie Li', role: 'Full-stack Developer', commits: 5, prs: 3 } },
    { id: 'user-diana', type: 'person', status: 'active', attributes: { name: 'Diana Zhang', role: 'Security Engineer', commits: 3, prs: 2 } },
    { id: 'user-eve', type: 'person', status: 'active', attributes: { name: 'Eve Wu', role: 'Frontend Developer', commits: 4, prs: 3 } },
    { id: 'user-frank', type: 'person', status: 'active', attributes: { name: 'Frank Liu', role: 'DevOps Engineer', commits: 3, prs: 2 } },
  ]

  const now = new Date().toISOString()
  for (const entity of entities) {
    upsertEntity.run(entity.id, entity.type, entity.status, JSON.stringify(entity.attributes), 'verified', now, now)
  }

  return { events: events.length, seeded: true }
}
