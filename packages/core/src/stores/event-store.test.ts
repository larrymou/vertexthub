// packages/core/src/stores/event-store.test.ts
// Event Store 测试

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SqliteEventStore } from './event-store'
import { RawEvent } from '../types'

describe('SqliteEventStore', () => {
  let db: Database.Database
  let store: SqliteEventStore

  beforeEach(() => {
    db = new Database(':memory:')
    store = new SqliteEventStore(db)
  })

  const createEvent = (overrides: Partial<RawEvent> = {}): RawEvent => ({
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    connector_id: 'github',
    timestamp: new Date(),
    ingested_at: new Date(),
    type: 'pull_request',
    payload: { title: 'Test PR', state: 'open' },
    entity_refs: ['pr-1'],
    checksum: 'test-checksum',
    ...overrides,
  })

  it('should append and query events', async () => {
    const event = createEvent()
    await store.append(event)

    const events = await store.query({})
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe(event.id)
  })

  it('should filter by connector_id', async () => {
    await store.append(createEvent({ connector_id: 'github' }))
    await store.append(createEvent({ connector_id: 'slack' }))

    const events = await store.query({ connector_id: 'github' })
    expect(events).toHaveLength(1)
    expect(events[0].connector_id).toBe('github')
  })

  it('should filter by type', async () => {
    await store.append(createEvent({ type: 'pull_request' }))
    await store.append(createEvent({ type: 'issue' }))

    const events = await store.query({ type: 'issue' })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('issue')
  })

  it('should respect limit', async () => {
    for (let i = 0; i < 10; i++) {
      await store.append(createEvent())
    }

    const events = await store.query({ limit: 5 })
    expect(events).toHaveLength(5)
  })

  it('should filter by time range', async () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000)
    const tomorrow = new Date(now.getTime() + 86400000)

    await store.append(createEvent({ timestamp: now }))

    const events = await store.query({ since: yesterday, until: tomorrow })
    expect(events).toHaveLength(1)
  })
})
