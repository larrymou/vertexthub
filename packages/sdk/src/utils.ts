// packages/sdk/src/utils.ts
// VertexHub Connector SDK 工具函数

import { ConnectorManifest, ValidationResult, ValidationError, ValidationWarning } from './types'

// ═══════════════════════════════════════════════════════════════
// 验证函数
// ═══════════════════════════════════════════════════════════════

export function validateManifest(manifest: any): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // 验证元数据
  if (!manifest.metadata) {
    errors.push({ path: 'metadata', message: 'Metadata is required', code: 'MISSING_METADATA' })
  } else {
    if (!manifest.metadata.id) {
      errors.push({ path: 'metadata.id', message: 'ID is required', code: 'MISSING_ID' })
    }
    if (!manifest.metadata.name) {
      errors.push({ path: 'metadata.name', message: 'Name is required', code: 'MISSING_NAME' })
    }
    if (!manifest.metadata.version) {
      errors.push({ path: 'metadata.version', message: 'Version is required', code: 'MISSING_VERSION' })
    }
    if (!manifest.metadata.author) {
      errors.push({ path: 'metadata.author', message: 'Author is required', code: 'MISSING_AUTHOR' })
    }
    if (!manifest.metadata.license) {
      warnings.push({ path: 'metadata.license', message: 'License is recommended', code: 'MISSING_LICENSE' })
    }
  }

  // 验证配置模式
  if (!manifest.config) {
    errors.push({ path: 'config', message: 'Config schema is required', code: 'MISSING_CONFIG' })
  } else if (manifest.config.type !== 'object') {
    errors.push({ path: 'config.type', message: 'Config type must be "object"', code: 'INVALID_CONFIG_TYPE' })
  }

  // 验证凭证模式
  if (!manifest.credentials) {
    warnings.push({ path: 'credentials', message: 'Credentials schema is recommended', code: 'MISSING_CREDENTIALS' })
  }

  // 验证能力
  if (!manifest.capabilities || !Array.isArray(manifest.capabilities)) {
    warnings.push({ path: 'capabilities', message: 'Capabilities array is recommended', code: 'MISSING_CAPABILITIES' })
  }

  // 验证事件定义
  if (!manifest.events || !Array.isArray(manifest.events)) {
    warnings.push({ path: 'events', message: 'Events array is recommended', code: 'MISSING_EVENTS' })
  } else {
    manifest.events.forEach((event: any, index: number) => {
      if (!event.type) {
        errors.push({ path: `events[${index}].type`, message: 'Event type is required', code: 'MISSING_EVENT_TYPE' })
      }
      if (!event.description) {
        warnings.push({ path: `events[${index}].description`, message: 'Event description is recommended', code: 'MISSING_EVENT_DESCRIPTION' })
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// ═══════════════════════════════════════════════════════════════
// 版本比较函数
// ═══════════════════════════════════════════════════════════════

export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0

    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }

  return 0
}

export function isCompatibleVersion(current: string, required: string): boolean {
  return compareVersions(current, required) >= 0
}

// ═══════════════════════════════════════════════════════════════
// 字符串工具函数
// ═══════════════════════════════════════════════════════════════

export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

// ═══════════════════════════════════════════════════════════════
// 文件工具函数
// ═══════════════════════════════════════════════════════════════

export function generateFileName(name: string, extension: string): string {
  const kebabName = toKebabCase(name)
  return `${kebabName}.${extension}`
}

export function generateClassName(name: string): string {
  return `${toPascalCase(name)}Connector`
}

export function generateInterfaceName(name: string): string {
  return `${toPascalCase(name)}Config`
}

// ═══════════════════════════════════════════════════════════════
// 日期工具函数
// ═══════════════════════════════════════════════════════════════

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatDateTime(date: Date): string {
  return date.toISOString()
}

// ═══════════════════════════════════════════════════════════════
// 哈希函数
// ═══════════════════════════════════════════════════════════════

export function generateHash(data: any): string {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}