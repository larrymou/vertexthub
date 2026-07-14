# Agent Module Design Spec

## [S1] Data Model

Agent represents both human and AI participants. Mixed type with capability tags and credit system.

```typescript
export type AgentType = 'human' | 'ai'

export interface Agent {
  id: string
  name: string
  type: AgentType
  email: string | null
  avatar_url: string | null
  skills: string[]
  bio: string
  credit_score: number
  credit_history: CreditEntry[]
  status: 'active' | 'inactive' | 'suspended'
  max_concurrent_tasks: number
  tasks_completed: number
  tasks_cancelled: number
  avg_contribution_score: number | null
  created_at: Date
  updated_at: Date
  last_active_at: Date | null
}

export interface CreditEntry {
  task_id: string
  delta: number
  reason: string
  timestamp: Date
}
```

## [S2] Credit Score Rules

Initial: 100 for all. Dynamic based on task outcomes.

| Event | Delta | Cap |
|-------|-------|-----|
| Task completed | +score/10 | per task |
| Task overdue | -2/day | -10 per task |
| Task cancelled (voluntary) | 0 | — |
| Exploration task failed | 0 | — (REQ tolerance) |

Range: 0-200.

## [S3] Storage Layer

```typescript
export interface AgentStore {
  create(agent: Omit<Agent, 'id' | 'created_at' | 'updated_at' | 'credit_score' | 'credit_history' | 'tasks_completed' | 'tasks_cancelled' | 'avg_contribution_score'>): Promise<Agent>
  get(id: string): Promise<Agent | null>
  update(id: string, patch: Partial<Agent>): Promise<Agent>
  list(filter?: AgentFilter): Promise<Agent[]>
  adjustCredit(agentId: string, entry: CreditEntry): Promise<Agent>
  findBySkills(skills: string[], excludeAgentIds?: string[]): Promise<Agent[]>
  stats(): Promise<AgentStats>
}

export interface AgentFilter {
  status?: Agent['status']
  type?: AgentType
  skill?: string
  min_credit?: number
  limit?: number
}

export interface AgentStats {
  total: number
  by_type: Record<AgentType, number>
  by_status: Record<string, number>
  avg_credit_score: number
}
```

## [S4] Agent-Task Association

AgentService orchestrates Agent + Task interactions:
- `claimTask`: validates agent availability + concurrent task limit
- `approveTask`: updates agent stats + credit score
- `getAgentTasks`: retrieves agent's task history

## [S5] API Endpoints

```
POST   /api/agents              - Create agent
GET    /api/agents              - List (with filters)
GET    /api/agents/:id          - Get by ID
PATCH  /api/agents/:id          - Update
GET    /api/agents/:id/tasks    - Agent's tasks
GET    /api/agents/:id/credit   - Credit history
GET    /api/agents/stats        - Statistics
POST   /api/agents/match        - Match by skills
```

## [S6] File Map

| File | Purpose |
|------|---------|
| `packages/core/src/types.ts` | Add Agent, AgentType, CreditEntry, AgentStore, AgentFilter, AgentStats |
| `packages/core/src/stores/agent-store.ts` | SqliteAgentStore |
| `packages/core/src/stores/agent-store.test.ts` | Store tests |
| `packages/core/src/services/agent-service.ts` | AgentService orchestration |
| `packages/core/src/services/agent-service.test.ts` | Service tests |
| `packages/core/src/index.ts` | Exports |
| `apps/server/src/index.ts` | API routes |
