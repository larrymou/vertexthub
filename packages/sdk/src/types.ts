// packages/sdk/src/types.ts
// VertexHub Connector SDK 类型定义

import { createHash } from 'crypto'
import { Connector, RawEvent, EntitySchema } from '@vertexhub/core'

// ═══════════════════════════════════════════════════════════════
// 连接器配置类型
// ═══════════════════════════════════════════════════════════════

export interface ConnectorMetadata {
  id: string
  name: string
  version: string
  description: string
  author: string
  homepage?: string
  repository?: string
  license: string
  keywords: string[]
  minCoreVersion: string
}

export interface ConnectorManifest {
  metadata: ConnectorMetadata
  config: ConnectorConfigSchema
  credentials: CredentialSchema
  capabilities: string[]
  events: EventDefinition[]
}

export interface ConnectorConfigSchema {
  type: 'object'
  properties: Record<string, PropertySchema>
  required: string[]
}

export interface CredentialSchema {
  type: 'object'
  properties: Record<string, PropertySchema>
  required: string[]
}

export interface PropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  default?: unknown
  enum?: unknown[]
  pattern?: string
  minLength?: number
  maxLength?: number
}

export interface EventDefinition {
  type: string
  description: string
  payload: Record<string, PropertySchema>
  entityRefs: string[]
}

// ═══════════════════════════════════════════════════════════════
// 连接器基类
// ═══════════════════════════════════════════════════════════════

export abstract class BaseConnector implements Connector {
  abstract id: string
  abstract name: string
  abstract type: string

  protected credentials: Record<string, unknown> = {}
  protected config: Record<string, unknown> = {}

  abstract authenticate(credentials: Record<string, unknown>): Promise<void>
  abstract fetch(since?: Date): Promise<RawEvent[]>
  abstract healthCheck(): Promise<boolean>
  abstract schema(): EntitySchema
  abstract capabilities(): string[]

  // 辅助方法
  protected generateEventId(prefix: string, id: string | number): string {
    return `${prefix}-${id}`
  }

  protected generateChecksum(data: unknown): string {
    const str = JSON.stringify(data)
    return createHash('sha256').update(str).digest('hex').substring(0, 16)
  }

  protected createEvent(params: {
    id: string
    type: string
    payload: Record<string, unknown>
    entityRefs: string[]
    timestamp?: Date
  }): RawEvent {
    return {
      id: params.id,
      connector_id: this.id,
      timestamp: params.timestamp || new Date(),
      ingested_at: new Date(),
      type: params.type,
      payload: params.payload,
      entity_refs: params.entityRefs,
      checksum: this.generateChecksum(params.payload),
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 注册表类型
// ═══════════════════════════════════════════════════════════════

export interface ConnectorRegistryEntry {
  manifest: ConnectorManifest
  connector: new (id: string, name: string) => Connector
  installedAt?: Date
  version: string
}

export interface RegistrySearchResult {
  entries: ConnectorRegistryEntry[]
  total: number
  page: number
  pageSize: number
}

// ═══════════════════════════════════════════════════════════════
// 开发工具类型
// ═══════════════════════════════════════════════════════════════

export interface ConnectorTemplate {
  name: string
  description: string
  files: TemplateFile[]
}

export interface TemplateFile {
  path: string
  content: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  path: string
  message: string
  code: string
}

export interface ValidationWarning {
  path: string
  message: string
  code: string
}