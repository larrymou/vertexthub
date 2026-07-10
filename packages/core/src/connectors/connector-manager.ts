// packages/core/src/connectors/connector-manager.ts
// Connector Manager - 统一管理连接器生命周期

import { Connector, RawEvent, EventStore } from '../types'

export interface ConnectorConfig {
  id: string
  type: string
  name: string
  credentials: any
  config: any
  schedule: string // cron expression
  enabled: boolean
}

export class ConnectorManager {
  private connectors: Map<string, Connector> = new Map()
  private configs: Map<string, ConnectorConfig> = new Map()
  private eventStore: EventStore
  private syncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore
  }

  // 注册连接器
  register(connector: Connector, config: ConnectorConfig): void {
    this.connectors.set(config.id, connector)
    this.configs.set(config.id, config)
  }

  // 初始化连接器
  async initialize(connectorId: string): Promise<boolean> {
    const connector = this.connectors.get(connectorId)
    const config = this.configs.get(connectorId)

    if (!connector || !config) {
      throw new Error(`Connector ${connectorId} not found`)
    }

    try {
      await connector.authenticate(config.credentials)
      return true
    } catch (error) {
      console.error(`Failed to initialize connector ${connectorId}:`, error)
      return false
    }
  }

  // 同步数据
  async sync(connectorId: string): Promise<RawEvent[]> {
    const connector = this.connectors.get(connectorId)
    const config = this.configs.get(connectorId)

    if (!connector || !config) {
      throw new Error(`Connector ${connectorId} not found`)
    }

    if (!config.enabled) {
      return []
    }

    try {
      // 获取上次同步时间
      const lastSync = await this.getLastSyncTime(connectorId)

      // 拉取新数据
      const events = await connector.fetch(lastSync)

      // 存储事件
      for (const event of events) {
        await this.eventStore.append(event)
      }

      // 更新同步时间
      await this.updateLastSyncTime(connectorId)

      return events
    } catch (error) {
      console.error(`Sync failed for connector ${connectorId}:`, error)
      throw error
    }
  }

  // 启动定时同步
  startScheduledSync(connectorId: string): void {
    const config = this.configs.get(connectorId)
    if (!config || !config.enabled) return

    // 停止现有的定时器
    this.stopScheduledSync(connectorId)

    // 解析 cron 表达式（简化版：只支持分钟级间隔）
    const intervalMs = this.parseCronInterval(config.schedule)

    const timer = setInterval(async () => {
      try {
        await this.sync(connectorId)
      } catch (error) {
        console.error(`Scheduled sync failed for ${connectorId}:`, error)
      }
    }, intervalMs)

    this.syncTimers.set(connectorId, timer)
  }

  // 停止定时同步
  stopScheduledSync(connectorId: string): void {
    const timer = this.syncTimers.get(connectorId)
    if (timer) {
      clearInterval(timer)
      this.syncTimers.delete(connectorId)
    }
  }

  // 健康检查
  async healthCheck(connectorId: string): Promise<boolean> {
    const connector = this.connectors.get(connectorId)
    if (!connector) return false

    try {
      return await connector.healthCheck()
    } catch {
      return false
    }
  }

  // 获取所有连接器状态
  async getStatus(): Promise<Array<{ id: string; name: string; type: string; enabled: boolean; healthy: boolean }>> {
    const status = []

    for (const [id, config] of this.configs) {
      const healthy = await this.healthCheck(id)
      status.push({
        id,
        name: config.name,
        type: config.type,
        enabled: config.enabled,
        healthy,
      })
    }

    return status
  }

  // 解析 cron 间隔（简化版）
  private parseCronInterval(schedule: string): number {
    // 默认 15 分钟
    const defaultInterval = 15 * 60 * 1000

    if (!schedule) return defaultInterval

    // 解析 "*/N * * * *" 格式
    const match = schedule.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/)
    if (match) {
      const minutes = parseInt(match[1])
      return minutes * 60 * 1000
    }

    return defaultInterval
  }

  // 获取上次同步时间
  private async getLastSyncTime(connectorId: string): Promise<Date | undefined> {
    return this.eventStore.getLastSyncTime(connectorId)
  }

  // 更新上次同步时间
  private async updateLastSyncTime(connectorId: string): Promise<void> {
    await this.eventStore.updateLastSyncTime(connectorId)
  }
}
