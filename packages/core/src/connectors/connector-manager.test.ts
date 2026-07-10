// packages/core/src/connectors/connector-manager.test.ts
// Connector Manager 测试

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SqliteEventStore } from '../stores/event-store'
import { ConnectorManager, ConnectorConfig } from './connector-manager'
import { Connector, RawEvent, EntitySchema } from '../types'

// Mock Connector
class MockConnector implements Connector {
  id: string
  name: string
  type = 'mock'
  private authenticated = false

  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }

  async authenticate(credentials: any): Promise<void> {
    this.authenticated = true
  }

  async fetch(config: any): Promise<RawEvent[]> {
    if (!this.authenticated) throw new Error('Not authenticated')
    return [
      {
        id: `evt-${Date.now()}`,
        connector_id: this.id,
        timestamp: new Date(),
        ingested_at: new Date(),
        type: 'test',
        payload: { title: 'Test Event' },
        entity_refs: [],
        checksum: 'test',
      },
    ]
  }

  async healthCheck(): Promise<boolean> {
    return this.authenticated
  }

  schema(): EntitySchema {
    return { entity_type: 'test', attributes: [] }
  }

  capabilities(): string[] {
    return ['test']
  }
}

describe('ConnectorManager', () => {
  let db: Database.Database
  let eventStore: SqliteEventStore
  let manager: ConnectorManager

  beforeEach(() => {
    db = new Database(':memory:')
    eventStore = new SqliteEventStore(db)
    manager = new ConnectorManager(eventStore)
  })

  it('should register and initialize connector', async () => {
    const connector = new MockConnector('test', 'Test Connector')
    const config: ConnectorConfig = {
      id: 'test',
      type: 'mock',
      name: 'Test Connector',
      credentials: { token: 'test' },
      config: {},
      schedule: '*/15 * * * *',
      enabled: true,
    }

    manager.register(connector, config)
    const result = await manager.initialize('test')
    expect(result).toBe(true)
  })

  it('should sync data', async () => {
    const connector = new MockConnector('test', 'Test Connector')
    const config: ConnectorConfig = {
      id: 'test',
      type: 'mock',
      name: 'Test Connector',
      credentials: { token: 'test' },
      config: {},
      schedule: '*/15 * * * *',
      enabled: true,
    }

    manager.register(connector, config)
    await manager.initialize('test')
    const events = await manager.sync('test')

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('test')
  })

  it('should check health', async () => {
    const connector = new MockConnector('test', 'Test Connector')
    const config: ConnectorConfig = {
      id: 'test',
      type: 'mock',
      name: 'Test Connector',
      credentials: { token: 'test' },
      config: {},
      schedule: '*/15 * * * *',
      enabled: true,
    }

    manager.register(connector, config)
    await manager.initialize('test')
    const healthy = await manager.healthCheck('test')

    expect(healthy).toBe(true)
  })

  it('should get status', async () => {
    const connector = new MockConnector('test', 'Test Connector')
    const config: ConnectorConfig = {
      id: 'test',
      type: 'mock',
      name: 'Test Connector',
      credentials: { token: 'test' },
      config: {},
      schedule: '*/15 * * * *',
      enabled: true,
    }

    manager.register(connector, config)
    await manager.initialize('test')
    const status = await manager.getStatus()

    expect(status).toHaveLength(1)
    expect(status[0].id).toBe('test')
    expect(status[0].healthy).toBe(true)
  })
})
