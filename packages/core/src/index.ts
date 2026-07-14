// packages/core/src/index.ts
// VertexHub Core - 统一导出

export * from './types'
export { SqliteEventStore } from './stores/event-store'
export { SqliteEntityStore } from './stores/entity-store'
export { SqliteInsightStore } from './stores/insight-store'
export { SqliteTaskStore } from './stores/task-store'
export { SqliteAgentStore } from './stores/agent-store'
export { SqliteSkillStore } from './stores/skill-store'
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

// Weekly Report (rule-based, no AI dependency)
export { generateWeeklyReport } from './ai/weekly-report'

// Demo data seeding
export { seedDemoData, generateDemoData } from './demo/seed-data'

// Task state machine
export {
  TaskStateMachine,
  calculateContributionScore,
  type ContributionScoreParams,
} from './engine/task-state-machine'

// Match engine
export { MatchEngine } from './engine/match-engine'

// Rule engine
export { RuleEngine } from './engine/rule-engine'

// Services
export { AgentService } from './services/agent-service'
