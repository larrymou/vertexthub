// packages/core/src/index.ts
// VertexHub Core - 统一导出

export * from './types'
export { SqliteEventStore } from './stores/event-store'
export { SqliteEntityStore } from './stores/entity-store'
export { SqliteInsightStore } from './stores/insight-store'
export {
  ConnectorRegistry,
  ConnectorNotFoundError,
  VersionConflictError,
  InvalidVersionError,
} from './registry/connector-registry'
export type {
  ConnectorRegistration,
  ConnectorMetadata,
  ConnectorVersion,
  ConnectorQuery,
} from './registry/connector-registry'

// Error classes
export {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ConnectorError,
  RateLimitError,
  ConfigError,
  isOperationalError,
} from './errors'

// Logger
export { getLogger, type Logger, type LogLevel, type LogContext } from './logger'

// Config
export { loadConfig, type AppConfig } from './config'
