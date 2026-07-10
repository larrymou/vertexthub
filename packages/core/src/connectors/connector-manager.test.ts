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

  describe('sync time persistence', () => {
    it('should return undefined for connector with no sync history', async () => {
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
      const lastSync = await eventStore.getLastSyncTime('test')
      expect(lastSync).toBeUndefined()
    })

    it('should update and retrieve last sync time', async () => {
      const before = new Date()
      await eventStore.updateLastSyncTime('test')
      const after = new Date()

      const lastSync = await eventStore.getLastSyncTime('test')
      expect(lastSync).toBeDefined()
      expect(lastSync!.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(lastSync!.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('should overwrite previous sync time on update', async () => {
      await eventStore.updateLastSyncTime('test')
      const first = await eventStore.getLastSyncTime('test')

      await new Promise(resolve => setTimeout(resolve, 10))
      await eventStore.updateLastSyncTime('test')
      const second = await eventStore.getLastSyncTime('test')

      expect(second!.getTime()).toBeGreaterThan(first!.getTime())
    })

    it('should track sync times independently per connector', async () => {
      const time1 = new Date('2024-01-01T00:00:00Z')
      const time2 = new Date('2024-06-15T12:00:00Z')

      db.prepare('INSERT INTO connector_sync_metadata (connector_id, last_sync_time) VALUES (?, ?)').run('connector-a', time1.toISOString())
      db.prepare('INSERT INTO connector_sync_metadata (connector_id, last_sync_time) VALUES (?, ?)').run('connector-b', time2.toISOString())

      const syncA = await eventStore.getLastSyncTime('connector-a')
      const syncB = await eventStore.getLastSyncTime('connector-b')

      expect(syncA!.toISOString()).toBe(time1.toISOString())
      expect(syncB!.toISOString()).toBe(time2.toISOString())
    })

    it('should persist sync time across sync operations', async () => {
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

      expect(await eventStore.getLastSyncTime('test')).toBeUndefined()

      await manager.sync('test')
      const afterFirstSync = await eventStore.getLastSyncTime('test')
      expect(afterFirstSync).toBeDefined()

      await new Promise(resolve => setTimeout(resolve, 10))
      await manager.sync('test')
      const afterSecondSync = await eventStore.getLastSyncTime('test')
      expect(afterSecondSync!.getTime()).toBeGreaterThan(afterFirstSync!.getTime())
    })
  })
})
