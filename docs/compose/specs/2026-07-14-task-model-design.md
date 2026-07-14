# Task Model Design Spec

## [S1] Data Model

Atomic task with single assignee. Task types are strings (not enums) for future extensibility.

```typescript
export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high' | 'urgent'
  type: string  // 'feature' | 'bug' | 'improvement' | 'exploration' (free-form)

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

export type TaskStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'revision'
  | 'done'
  | 'cancelled'
```

State transitions:
```
open → assigned → in_progress → review → done
                                 ↓
                              revision → in_progress → review
open/assigned → cancelled
```

## [S2] Storage Layer

Interface in `types.ts`, SQLite implementation in `stores/task-store.ts`. Follows existing `SqliteEventStore`/`SqliteEntityStore` pattern.

```typescript
export interface TaskStore {
  create(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task>
  get(id: string): Promise<Task | null>
  update(id: string, patch: Partial<Task>): Promise<Task>
  list(filter: TaskFilter): Promise<Task[]>
  listByAssignee(assigneeId: string, status?: TaskStatus): Promise<Task[]>
  listByStatus(status: TaskStatus): Promise<Task[]>
  stats(): Promise<TaskStats>
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
```

## [S3] State Machine

Encapsulated in `engine/task-state-machine.ts`. Each transition validates:
1. Current status allows the transition
2. Actor has permission (creator vs assignee)
3. Sets appropriate timestamps

Permission matrix:
| Action | Actor | From Status | To Status |
|--------|-------|-------------|-----------|
| claim | any (not creator) | open | assigned |
| start | assignee | assigned | in_progress |
| submitForReview | assignee | in_progress | review |
| approve | creator | review | done |
| reject | creator | review | revision |
| resubmit | assignee | revision | review |
| cancel | creator | open, assigned | cancelled |

## [S4] Contribution Scoring

Computed on `approve`. Simple rule-based (future: AI-assisted).

```
base = 50
+ early completion: +5 per day early (cap +20)
- late completion: -5 per day late (cap -20)
+ urgency bonus: urgent +10, high +5
+ exploration bonus: type='exploration' +10
final = clamp(0, 100)
```

Creator can manually override after auto-calculation.

## [S5] API Endpoints

```
POST   /api/tasks              - Create task
GET    /api/tasks              - List (with filters)
GET    /api/tasks/:id          - Get by ID
PATCH  /api/tasks/:id          - Update basic fields
POST   /api/tasks/:id/claim    - Claim (open → assigned)
POST   /api/tasks/:id/start    - Start (assigned → in_progress)
POST   /api/tasks/:id/submit   - Submit for review (in_progress → review)
POST   /api/tasks/:id/approve  - Approve (review → done)
POST   /api/tasks/:id/reject   - Reject (review → revision)
POST   /api/tasks/:id/cancel   - Cancel (open/assigned → cancelled)
GET    /api/tasks/stats        - Task statistics
```

## [S6] Testing

- State machine: unit tests for every valid transition + every invalid transition attempt
- Store: in-memory SQLite tests following existing pattern
- API: integration tests via the HTTP server
- Contribution scoring: unit tests for each rule

## [S7] File Map

| File | Purpose |
|------|---------|
| `packages/core/src/types.ts` | Add Task, TaskStatus, TaskStore, TaskFilter, TaskStats interfaces |
| `packages/core/src/stores/task-store.ts` | SqliteTaskStore implementation |
| `packages/core/src/stores/task-store.test.ts` | Store tests |
| `packages/core/src/engine/task-state-machine.ts` | State transition logic + contribution scoring |
| `packages/core/src/engine/task-state-machine.test.ts` | State machine tests |
| `packages/core/src/index.ts` | Export new types and classes |
| `apps/server/src/index.ts` | Add task API routes |
