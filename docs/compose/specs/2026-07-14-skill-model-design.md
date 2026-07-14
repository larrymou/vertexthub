# Skill Module Design Spec

## [S1] Data Model

Skills are first-class entities with categories and hierarchy. Agent-Skill has proficiency. Task-Skill has minimum requirement.

```typescript
export interface Skill {
  id: string
  name: string
  display_name: string
  category: string
  description: string
  parent_id: string | null
  created_at: Date
  updated_at: Date
}

export interface AgentSkill {
  agent_id: string
  skill_id: string
  proficiency: number  // 1-5
  verified: boolean
  updated_at: Date
}

export interface TaskSkill {
  task_id: string
  skill_id: string
  min_proficiency: number  // 1-5
  required: boolean
}
```

## [S2] Matching Engine

Given TaskSkill requirements, score and rank agents:
- Required skill met: +20 each (cap 60)
- Optional skill met: +10 each (cap 20)
- Proficiency exceeds requirement: +5 each (cap 10)
- Credit score weight: credit_score/200 * 10 (cap 10)

Returns MatchResult[] sorted by score descending.

## [S3] Storage Layer

SkillStore manages Skill CRUD + Agent-Skill + Task-Skill associations.

## [S4] API Endpoints

Skills CRUD, Agent-Skill management, Task-Skill management, matching endpoint.

## [S5] File Map

| File | Purpose |
|------|---------|
| `packages/core/src/types.ts` | Skill, AgentSkill, TaskSkill, SkillFilter, SkillStats, MatchResult, SkillStore |
| `packages/core/src/stores/skill-store.ts` | SqliteSkillStore |
| `packages/core/src/stores/skill-store.test.ts` | Store tests |
| `packages/core/src/engine/match-engine.ts` | Matching algorithm |
| `packages/core/src/engine/match-engine.test.ts` | Matching tests |
| `packages/core/src/index.ts` | Exports |
| `apps/server/src/index.ts` | API routes |
