# Agent Model Implementation Plan

> **For agentic workers:** Use compose:subagent to implement task-by-task.

**Goal:** Implement Agent model with credit scoring, skill matching, and Agent-Task orchestration.

**Architecture:** Types in types.ts, SQLite store, AgentService for cross-domain orchestration, API routes.

**Tech Stack:** TypeScript, better-sqlite3, nanoid, vitest

## Global Constraints

- Follow existing patterns: types.ts → stores/ → services/ → API
- Use `Record<string, unknown>` not `any`
- Tests use in-memory SQLite
- Agent.credit_history stored as JSON TEXT in SQLite

---

### Task 1: Agent Types & Interfaces

**Covers:** [S1], [S3]

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] Add to types.ts: AgentType, CreditEntry, Agent, AgentFilter, AgentStats, AgentStore interfaces
- [ ] Export from index.ts
- [ ] Verify: `cd packages/core && npx tsc --noEmit`
- [ ] Commit: `feat(agent): add Agent types and interfaces`

---

### Task 2: SqliteAgentStore

**Covers:** [S3], [S6]

**Files:**
- Create: `packages/core/src/stores/agent-store.ts`
- Create: `packages/core/src/stores/agent-store.test.ts`
- Modify: `packages/core/src/stores/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] Implement SqliteAgentStore with: create, get, update, list, adjustCredit, findBySkills, stats
- [ ] Tests: CRUD, credit adjustment, skill search, stats
- [ ] Export and commit

---

### Task 3: AgentService (Agent-Task Orchestration)

**Covers:** [S4], [S6]

**Files:**
- Create: `packages/core/src/services/agent-service.ts`
- Create: `packages/core/src/services/agent-service.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] Implement AgentService: claimTask, approveTask, getAgentTasks
- [ ] claimTask: check agent.active, check concurrent limit, call taskStateMachine.claim
- [ ] approveTask: call taskStateMachine.approve, adjustCredit, update stats
- [ ] Tests with mock stores
- [ ] Export and commit

---

### Task 4: Agent API Endpoints

**Covers:** [S5], [S6]

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] Add agent routes: CRUD + stats + match + tasks + credit
- [ ] Build verification
- [ ] Commit

---

### Task 5: Full Verification

- [ ] `npm run build` — 5/5 pass
- [ ] `npm test` — all tests pass
- [ ] Push
