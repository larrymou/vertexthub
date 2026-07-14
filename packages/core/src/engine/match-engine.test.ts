import { describe, it, expect } from 'vitest'
import { MatchEngine } from './match-engine'
import type { Agent, AgentSkill, TaskSkill } from '../types'

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    name: 'Alice',
    type: 'human',
    email: null,
    avatar_url: null,
    skills: [],
    bio: '',
    credit_score: 800,
    credit_history: [],
    status: 'active',
    max_concurrent_tasks: 3,
    tasks_completed: 10,
    tasks_cancelled: 0,
    avg_contribution_score: null,
    created_at: new Date(),
    updated_at: new Date(),
    last_active_at: null,
    ...overrides,
  }
}

function makeAgentSkill(skillId: string, proficiency: number, agentId = 'agent-1'): AgentSkill {
  return {
    agent_id: agentId,
    skill_id: skillId,
    proficiency,
    verified: true,
    updated_at: new Date(),
  }
}

function makeTaskSkill(skillId: string, minProficiency: number, required: boolean, taskId = 'task-1'): TaskSkill {
  return {
    task_id: taskId,
    skill_id: skillId,
    min_proficiency: minProficiency,
    required,
  }
}

describe('MatchEngine', () => {
  const engine = new MatchEngine()

  it('perfect match: all required + optional skills', () => {
    const agent = makeAgent({ id: 'a1', credit_score: 600 })
    const taskSkills = [
      makeTaskSkill('s1', 3, true),
      makeTaskSkill('s2', 5, true),
      makeTaskSkill('s3', 2, false),
    ]
    const agentSkills = [
      makeAgentSkill('s1', 5, 'a1'),
      makeAgentSkill('s2', 7, 'a1'),
      makeAgentSkill('s3', 4, 'a1'),
    ]
    const map = new Map([['a1', agentSkills]])

    const results = engine.matchAgents(taskSkills, [agent], map)

    expect(results).toHaveLength(1)
    const r = results[0]
    expect(r.matched_skills).toEqual(expect.arrayContaining(['s1', 's2', 's3']))
    expect(r.missing_skills).toEqual([])
    // required: 20+20=40, optional: 10=10, proficiency bonus: min((5-3)*2,10)+min((7-5)*2,10)+min((4-2)*2,10)=4+4+4=12, credit: floor(600/200*10)=30 => 40+10+12+30=92
    expect(r.score).toBe(92)
  })

  it('partial match: missing optional skills', () => {
    const agent = makeAgent({ id: 'a1', credit_score: 600 })
    const taskSkills = [
      makeTaskSkill('s1', 3, true),
      makeTaskSkill('s2', 2, false),
    ]
    const agentSkills = [makeAgentSkill('s1', 4, 'a1')]
    const map = new Map([['a1', agentSkills]])

    const results = engine.matchAgents(taskSkills, [agent], map)

    expect(results).toHaveLength(1)
    expect(results[0].matched_skills).toEqual(['s1'])
    expect(results[0].missing_skills).toEqual([])
    // required: 20, optional: 0, proficiency bonus: min((4-3)*2,10)=2, credit: 30 => 20+0+2+30=52
    expect(results[0].score).toBe(52)
  })

  it('missing required skills → filtered out', () => {
    const agent = makeAgent({ id: 'a1', credit_score: 600 })
    const taskSkills = [
      makeTaskSkill('s1', 3, true),
      makeTaskSkill('s2', 3, true),
    ]
    const agentSkills = [makeAgentSkill('s1', 5, 'a1')]
    const map = new Map([['a1', agentSkills]])

    const results = engine.matchAgents(taskSkills, [agent], map)

    expect(results).toHaveLength(0)
  })

  it('proficiency below requirement → lower score', () => {
    const agentHigh = makeAgent({ id: 'high', credit_score: 0 })
    const agentLow = makeAgent({ id: 'low', credit_score: 0 })
    const taskSkills = [makeTaskSkill('s1', 5, true)]

    const map = new Map([
      ['high', [makeAgentSkill('s1', 6, 'high')]],
      ['low', [makeAgentSkill('s1', 3, 'low')]],
    ])

    const results = engine.matchAgents(taskSkills, [agentHigh, agentLow], map)

    // high: 20 + min((6-5)*2,10)=2 = 22
    // low: 5 + 0 = 5 → filtered (score < 10)
    expect(results).toHaveLength(1)
    expect(results[0].agent.id).toBe('high')
    expect(results[0].score).toBe(22)
  })

  it('credit score affects ranking', () => {
    const agentA = makeAgent({ id: 'a', credit_score: 200 })
    const agentB = makeAgent({ id: 'b', credit_score: 800 })
    const taskSkills = [makeTaskSkill('s1', 3, true)]

    const map = new Map([
      ['a', [makeAgentSkill('s1', 5, 'a')]],
      ['b', [makeAgentSkill('s1', 5, 'b')]],
    ])

    const results = engine.matchAgents(taskSkills, [agentA, agentB], map)

    expect(results).toHaveLength(2)
    expect(results[0].agent.id).toBe('b')
    expect(results[1].agent.id).toBe('a')
    // a: 20 + min(2,10)=2 + floor(200/200*10)=10 = 32
    // b: 20 + min(2,10)=2 + floor(800/200*10)=40 = 62
    expect(results[0].score).toBe(62)
    expect(results[1].score).toBe(32)
  })

  it('empty task skills → all agents score 0 (credit only)', () => {
    const agent = makeAgent({ id: 'a1', credit_score: 500 })
    const map = new Map([['a1', []]])

    const results = engine.matchAgents([], [agent], map)

    expect(results).toHaveLength(1)
    // credit only: floor(500/200*10) = 25
    expect(results[0].score).toBe(25)
    expect(results[0].matched_skills).toEqual([])
    expect(results[0].missing_skills).toEqual([])
  })

  it('filters agents below score 10', () => {
    const agent = makeAgent({ id: 'a1', credit_score: 0 })
    const taskSkills = [makeTaskSkill('s1', 5, false)]
    const map = new Map([['a1', []]])

    const results = engine.matchAgents(taskSkills, [agent], map)

    expect(results).toHaveLength(0)
  })
})
