// packages/core/src/stores/entity-store.test.ts
// Entity Store 测试

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SqliteEntityStore } from './entity-store'
import { Entity } from '../types'

describe('SqliteEntityStore', () => {
  let db: Database.Database
  let store: SqliteEntityStore

  beforeEach(() => {
    db = new Database(':memory:')
    store = new SqliteEntityStore(db)
  })

  const createEntity = (overrides: Partial<Entity> = {}): Entity => ({
    id: 'entity-1',
    type: 'task',
    attributes: { title: 'Test Task', status: 'open' },
    source_mappings: [
      { connector_id: 'github', external_id: 'issue-1', last_synced: new Date() },
    ],
    evidence: [
      { source: 'github', confidence: 0.95, raw_event_id: 'evt-1' },
    ],
    consistency: {
      status: 'verified',
      conflicts: [],
      last_checked: new Date(),
    },
    ...overrides,
  })

  it('should upsert and get entity', async () => {
    const entity = createEntity()
    await store.upsert(entity)

    const retrieved = await store.get(entity.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(entity.id)
    expect(retrieved!.type).toBe('task')
  })

  it('should update existing entity', async () => {
    const entity = createEntity()
    await store.upsert(entity)

    const updated = createEntity({
      attributes: { title: 'Updated Task', status: 'closed' },
    })
    await store.upsert(updated)

    const retrieved = await store.get(entity.id)
    expect(retrieved!.attributes.title).toBe('Updated Task')
  })

  it('should list entities by type', async () => {
    await store.upsert(createEntity({ id: 'e1', type: 'task' }))
    await store.upsert(createEntity({ id: 'e2', type: 'person' }))
    await store.upsert(createEntity({ id: 'e3', type: 'task' }))

    const tasks = await store.list('task')
    expect(tasks).toHaveLength(2)

    const all = await store.list()
    expect(all).toHaveLength(3)
  })

  it('should search entities', async () => {
    await store.upsert(createEntity({
      id: 'e1',
      attributes: { title: 'Fix login bug' },
    }))
    await store.upsert(createEntity({
      id: 'e2',
      attributes: { title: 'Add dark mode' },
    }))

    const results = await store.search('login')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('e1')
  })

  it('should return null for non-existent entity', async () => {
    const result = await store.get('non-existent')
    expect(result).toBeNull()
  })
})
