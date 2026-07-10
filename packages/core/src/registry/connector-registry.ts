// packages/core/src/registry/connector-registry.ts
// Connector Registry - 插件注册表系统

import { Connector, EntitySchema } from '../types'

// ═══════════════════════════════════════════════════════════════
// Types - 类型定义
// ═══════════════════════════════════════════════════════════════

export interface ConnectorRegistration {
  id: string
  name: string
  type: string
  version: string
  connector: Connector
  metadata: ConnectorMetadata
  registered_at: Date
  updated_at: Date
}

export interface ConnectorMetadata {
  author: string
  description: string
  repository?: string
  homepage?: string
  tags: string[]
  entity_schemas: EntitySchema[]
  capabilities: string[]
  min_core_version?: string
}

export interface ConnectorVersion {
  version: string
  connector: Connector
  metadata: ConnectorMetadata
  registered_at: Date
  deprecated: boolean
}

export interface ConnectorQuery {
  type?: string
  tag?: string
  capability?: string
  version?: string
  include_deprecated?: boolean
}

// ═══════════════════════════════════════════════════════════════
// Errors - 错误定义
// ═══════════════════════════════════════════════════════════════

export class RegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistryError'
  }
}

export class ConnectorNotFoundError extends RegistryError {
  constructor(connectorId: string) {
    super(`Connector not found: ${connectorId}`)
    this.name = 'ConnectorNotFoundError'
  }
}

export class VersionConflictError extends RegistryError {
  constructor(connectorId: string, version: string) {
    super(`Version ${version} already exists for connector: ${connectorId}`)
    this.name = 'VersionConflictError'
  }
}

export class InvalidVersionError extends RegistryError {
  constructor(version: string) {
    super(`Invalid semantic version: ${version}`)
    this.name = 'InvalidVersionError'
  }
}

// ═══════════════════════════════════════════════════════════════
// ConnectorRegistry - 注册表管理类
// ═══════════════════════════════════════════════════════════════

export class ConnectorRegistry {
  private registrations: Map<string, Map<string, ConnectorVersion>> = new Map()
  private latestVersions: Map<string, string> = new Map()

  // 注册连接器
  register(
    connectorId: string,
    connector: Connector,
    metadata: ConnectorMetadata,
    version: string = '1.0.0'
  ): ConnectorRegistration {
    if (!this.isValidVersion(version)) {
      throw new InvalidVersionError(version)
    }

    const versions = this.registrations.get(connectorId) || new Map()

    if (versions.has(version)) {
      throw new VersionConflictError(connectorId, version)
    }

    const registration: ConnectorVersion = {
      version,
      connector,
      metadata,
      registered_at: new Date(),
      deprecated: false,
    }

    versions.set(version, registration)
    this.registrations.set(connectorId, versions)

    this.updateLatestVersion(connectorId, version)

    return {
      id: connectorId,
      name: connector.name,
      type: connector.type,
      version,
      connector,
      metadata,
      registered_at: registration.registered_at,
      updated_at: registration.registered_at,
    }
  }

  // 更新连接器版本
  update(
    connectorId: string,
    connector: Connector,
    metadata: ConnectorMetadata,
    version: string
  ): ConnectorRegistration {
    if (!this.isValidVersion(version)) {
      throw new InvalidVersionError(version)
    }

    const versions = this.registrations.get(connectorId)
    if (!versions) {
      throw new ConnectorNotFoundError(connectorId)
    }

    const existing = versions.get(version)
    if (existing) {
      existing.connector = connector
      existing.metadata = metadata
    } else {
      const registration: ConnectorVersion = {
        version,
        connector,
        metadata,
        registered_at: new Date(),
        deprecated: false,
      }
      versions.set(version, registration)
    }

    this.updateLatestVersion(connectorId, version)

    return {
      id: connectorId,
      name: connector.name,
      type: connector.type,
      version,
      connector,
      metadata,
      registered_at: versions.get(version)!.registered_at,
      updated_at: new Date(),
    }
  }

  // 查询连接器
  get(connectorId: string, version?: string): ConnectorRegistration | null {
    const versions = this.registrations.get(connectorId)
    if (!versions) return null

    if (version) {
      const ver = versions.get(version)
      return ver ? this.toRegistration(connectorId, ver) : null
    }

    const latestVer = this.latestVersions.get(connectorId)
    if (!latestVer) return null

    const latest = versions.get(latestVer)
    return latest ? this.toRegistration(connectorId, latest) : null
  }

  // 查询连接器的所有版本
  getVersions(connectorId: string): ConnectorVersion[] {
    const versions = this.registrations.get(connectorId)
    if (!versions) return []

    return Array.from(versions.values()).sort((a, b) =>
      this.compareVersions(b.version, a.version)
    )
  }

  // 搜索连接器
  search(query: ConnectorQuery): ConnectorRegistration[] {
    const results: ConnectorRegistration[] = []

    for (const [connectorId, versions] of this.registrations) {
      const latestVer = this.latestVersions.get(connectorId)

      let targetVersion: ConnectorVersion | undefined
      if (latestVer) {
        targetVersion = versions.get(latestVer)
      } else if (query.include_deprecated) {
        const allVersions = Array.from(versions.values())
          .sort((a, b) => this.compareVersions(b.version, a.version))
        targetVersion = allVersions[0]
      }

      if (!targetVersion) continue

      if (query.version) {
        const ver = versions.get(query.version)
        if (!ver) continue
        if (query.include_deprecated || !ver.deprecated) {
          results.push(this.toRegistration(connectorId, ver))
        }
        continue
      }

      if (!query.include_deprecated && targetVersion.deprecated) continue

      if (query.type && targetVersion.connector.type !== query.type) continue

      if (query.tag && !targetVersion.metadata.tags.includes(query.tag)) continue

      if (query.capability && !targetVersion.metadata.capabilities.includes(query.capability)) continue

      results.push(this.toRegistration(connectorId, targetVersion))
    }

    return results
  }

  // 废弃连接器版本
  deprecate(connectorId: string, version: string): void {
    const versions = this.registrations.get(connectorId)
    if (!versions) throw new ConnectorNotFoundError(connectorId)

    const ver = versions.get(version)
    if (!ver) throw new RegistryError(`Version ${version} not found for connector: ${connectorId}`)

    ver.deprecated = true

    if (this.latestVersions.get(connectorId) === version) {
      const availableVersions = Array.from(versions.entries())
        .filter(([, v]) => !v.deprecated)
        .sort((a, b) => this.compareVersions(b[0], a[0]))

      if (availableVersions.length > 0) {
        this.latestVersions.set(connectorId, availableVersions[0][0])
      } else {
        this.latestVersions.delete(connectorId)
      }
    }
  }

  // 删除连接器
  remove(connectorId: string, version?: string): boolean {
    const versions = this.registrations.get(connectorId)
    if (!versions) return false

    if (version) {
      const removed = versions.delete(version)
      if (removed && this.latestVersions.get(connectorId) === version) {
        this.updateLatestVersion(connectorId)
      }
      return removed
    }

    this.registrations.delete(connectorId)
    this.latestVersions.delete(connectorId)
    return true
  }

  // 获取所有连接器列表
  list(): ConnectorRegistration[] {
    const results: ConnectorRegistration[] = []

    for (const connectorId of this.registrations.keys()) {
      const reg = this.get(connectorId)
      if (reg) results.push(reg)
    }

    return results
  }

  // 获取注册表统计信息
  stats(): {
    total_connectors: number
    total_versions: number
    types: Record<string, number>
    capabilities: Record<string, number>
  } {
    let totalVersions = 0
    const types: Record<string, number> = {}
    const capabilities: Record<string, number> = {}

    for (const [connectorId, versions] of this.registrations) {
      totalVersions += versions.size

      const latestVer = this.latestVersions.get(connectorId)
      if (!latestVer) continue

      const latest = versions.get(latestVer)
      if (!latest) continue

      types[latest.connector.type] = (types[latest.connector.type] || 0) + 1

      for (const cap of latest.metadata.capabilities) {
        capabilities[cap] = (capabilities[cap] || 0) + 1
      }
    }

    return {
      total_connectors: this.registrations.size,
      total_versions: totalVersions,
      types,
      capabilities,
    }
  }

  // 清空注册表
  clear(): void {
    this.registrations.clear()
    this.latestVersions.clear()
  }

  // ═══════════════════════════════════════════════════════════════
  // Private Methods - 私有方法
  // ═══════════════════════════════════════════════════════════════

  private toRegistration(connectorId: string, ver: ConnectorVersion): ConnectorRegistration {
    return {
      id: connectorId,
      name: ver.connector.name,
      type: ver.connector.type,
      version: ver.version,
      connector: ver.connector,
      metadata: ver.metadata,
      registered_at: ver.registered_at,
      updated_at: ver.registered_at,
    }
  }

  private updateLatestVersion(connectorId: string, explicitVersion?: string): void {
    const versions = this.registrations.get(connectorId)
    if (!versions || versions.size === 0) {
      this.latestVersions.delete(connectorId)
      return
    }

    if (explicitVersion) {
      this.latestVersions.set(connectorId, explicitVersion)
      return
    }

    const available = Array.from(versions.entries())
      .filter(([, v]) => !v.deprecated)
      .sort((a, b) => this.compareVersions(b[0], a[0]))

    if (available.length > 0) {
      this.latestVersions.set(connectorId, available[0][0])
    } else {
      this.latestVersions.delete(connectorId)
    }
  }

  private isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version)
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number)
    const bParts = b.split('.').map(Number)

    for (let i = 0; i < 3; i++) {
      if (aParts[i] > bParts[i]) return 1
      if (aParts[i] < bParts[i]) return -1
    }

    return 0
  }
}
