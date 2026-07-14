// packages/core/src/types.ts
// VertexHub 核心类型定义

// ═══════════════════════════════════════════════════════════════
// Raw Event - 原始事件
// ═══════════════════════════════════════════════════════════════

export interface RawEvent {
  id: string
  connector_id: string
  timestamp: Date
  ingested_at: Date
  type: string
  payload: Record<string, unknown>
  entity_refs: string[]
  checksum: string
}

// ═══════════════════════════════════════════════════════════════
// Entity - 统一实体
// ═══════════════════════════════════════════════════════════════

export interface Entity {
  id: string
  type: string  // 'person' | 'project' | 'task' | 'document' 等
  source_mappings: SourceMapping[]
  attributes: Record<string, unknown>
  evidence: Evidence[]
  consistency: ConsistencyStatus
}

export interface SourceMapping {
  connector_id: string
  external_id: string
  last_synced: Date
}

export interface Evidence {
  source: string
  confidence: number  // 0-1
  raw_event_id: string
}

export interface ConsistencyStatus {
  status: 'verified' | 'conflicting' | 'unknown'
  conflicts: Conflict[]
  last_checked: Date
}

export interface Conflict {
  field: string
  sources: { connector_id: string; value: unknown }[]
  severity: 'low' | 'medium' | 'high'
}

// ═══════════════════════════════════════════════════════════════
// Connector - 连接器接口
// ═══════════════════════════════════════════════════════════════

export interface Connector {
  id: string
  name: string
  type: string

  // 生命周期
  authenticate(credentials: Record<string, unknown>): Promise<void>
  fetch(since?: Date): Promise<RawEvent[]>

  // 错误处理
  healthCheck(): Promise<boolean>

  // 元数据
  schema(): EntitySchema
  capabilities(): string[]
}

export interface EntitySchema {
  entity_type: string
  attributes: { name: string; type: string; required: boolean }[]
}

// ═══════════════════════════════════════════════════════════════
// Insight - 洞察
// ═══════════════════════════════════════════════════════════════

export interface Insight {
  id: string
  type: 'daily' | 'anomaly' | 'weekly' | 'deep_dive'
  target_entity_id: string | null
  content: Record<string, unknown>
  channel: 'web' | 'slack' | 'email' | 'api'
  delivered_at: Date
}

// ═══════════════════════════════════════════════════════════════
// Event Filter - 事件过滤器
// ═══════════════════════════════════════════════════════════════

export interface EventFilter {
  connector_id?: string
  type?: string
  since?: Date
  until?: Date
  entity_id?: string
  limit?: number
  cursor?: string
}

// ═══════════════════════════════════════════════════════════════
// Storage Interfaces - 存储接口
// ═══════════════════════════════════════════════════════════════

export interface EventStore {
  append(event: RawEvent): Promise<void>
  query(filter: EventFilter): Promise<RawEvent[]>
  getLastSyncTime(connectorId: string): Promise<Date | undefined>
  updateLastSyncTime(connectorId: string): Promise<void>
}

export interface EntityStore {
  upsert(entity: Entity): Promise<void>
  get(id: string): Promise<Entity | null>
  search(query: string): Promise<Entity[]>
  list(type?: string): Promise<Entity[]>
}

export interface InsightStore {
  save(insight: Insight): Promise<void>
  list(type?: string, limit?: number): Promise<Insight[]>
  get(id: string): Promise<Insight | null>
}

// ═══════════════════════════════════════════════════════════════
// AI Provider - AI 提供者接口
// ═══════════════════════════════════════════════════════════════

export interface AIProvider {
  id: string
  name: string

  complete(prompt: string, options?: CompleteOptions): Promise<string>
  embed(text: string): Promise<number[]>

  models(): string[]
  maxContextLength(): number
}

export interface CompleteOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

// ═══════════════════════════════════════════════════════════════
// Task - 任务
// ═══════════════════════════════════════════════════════════════

export type TaskStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'revision'
  | 'done'
  | 'cancelled'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high' | 'urgent'
  type: string
  creator_id: string
  assignee_id: string | null
  created_at: Date
  updated_at: Date
  started_at: Date | null
  completed_at: Date | null
  deadline: Date | null
  entity_refs: string[]
  tags: string[]
  deliverables: string[]
  contribution_score: number | null
  review_notes: string | null
}

export interface TaskFilter {
  status?: TaskStatus
  assignee_id?: string
  creator_id?: string
  priority?: Task['priority']
  type?: string
  limit?: number
}

export interface TaskStats {
  total: number
  by_status: Record<TaskStatus, number>
  avg_completion_hours: number | null
  completion_rate: number
}

export interface TaskStore {
  create(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task>
  get(id: string): Promise<Task | null>
  update(id: string, patch: Partial<Task>): Promise<Task>
  list(filter?: TaskFilter): Promise<Task[]>
  listByAssignee(assigneeId: string, status?: TaskStatus): Promise<Task[]>
  listByStatus(status: TaskStatus): Promise<Task[]>
  stats(): Promise<TaskStats>
}
