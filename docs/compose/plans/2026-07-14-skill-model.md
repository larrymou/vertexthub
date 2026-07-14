# Skill Model Implementation Plan

**Goal:** Implement Skill taxonomy, Agent-Skill/Task-Skill associations, and skill-based matching engine.

## Tasks

### Task 1: Skill Types
- Modify: packages/core/src/types.ts — add Skill, AgentSkill, TaskSkill, SkillFilter, SkillStats, MatchResult, SkillStore
- Export from index.ts

### Task 2: SqliteSkillStore
- Create: packages/core/src/stores/skill-store.ts
- Create: packages/core/src/stores/skill-store.test.ts
- CRUD for skills, agent-skill management, task-skill management, stats

### Task 3: Match Engine
- Create: packages/core/src/engine/match-engine.ts
- Create: packages/core/src/engine/match-engine.test.ts
- Score algorithm: required +20/cap60, optional +10/cap20, proficiency bonus, credit weight

### Task 4: API Endpoints
- Modify: apps/server/src/index.ts
- Skill CRUD, agent-skill, task-skill, match, stats

### Task 5: Full Verification
- npm run build + npm test
