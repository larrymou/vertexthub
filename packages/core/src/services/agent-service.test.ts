// packages/core/src/services/agent-service.test.ts
// AgentService integration tests

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SqliteAgentStore } from '../stores/agent-store'
import { SqliteTaskStore } from '../stores/task-store'
import { TaskStateMachine } from '../engine/task-state-machine'
import { AgentService } from './agent-service'
import type { Agent, Task, TaskStatus } from '../types'

function makeAgentData(overrides: Record<string, any> = {}) {
  return {
    name: 'Test Agent',
    type: 'human' as const,
    email: null,
    avatar_url: null,
    skills: ['coding'],
    bio: '',
    status: 'active' as const,
    max_concurrent_tasks: 3,
    last_active_at: null,
    ...overrides,
  }
}

function makeTaskData(overrides: Record<string, any> = {}) {
  return {
    title: 'Test Task',
    description: 'A test task',
    status: 'open' as TaskStatus,
    priority: 'medium' as const,
    type: 'task',
    creator_id: 'creator-1',
    assignee_id: null,
    started_at: null,
    completed_at: null,
    deadline: null,
    entity_refs: [],
    tags: [],
    deliverables: [],
    contribution_score: null,
    review_notes: null,
    ...overrides,
  }
}

describe('AgentService', () => {
  let db: Database.Database
  let agentStore: SqliteAgentStore
  let taskStore: SqliteTaskStore
  let taskStateMachine: TaskStateMachine
  let service: AgentService

  beforeEach(() => {
    db = new Database(':memory:')
    agentStore = new SqliteAgentStore(db)
    taskStore = new SqliteTaskStore(db)
    taskStateMachine = new TaskStateMachine()
    service = new AgentService(agentStore, taskStore, taskStateMachine)
  })

  describe('claimTask', () => {
    it('successfully claims an open task', async () => {
      const agent = await agentStore.create(makeAgentData({ name: 'Worker' }))
      const task = await taskStore.create(makeTaskData({ creator_id: 'other-user' }))

      const result = await service.claimTask(agent.id, task.id)

      expect(result.task.status).toBe('assigned')
      expect(result.task.assignee_id).toBe(agent.id)
      expect(result.agent.last_active_at).toBeInstanceOf(Date)
    })

    it('throws when agent is not active', async () => {
      const agent = await agentStore.create(makeAgentData({ status: 'inactive' }))
      const task = await taskStore.create(makeTaskData({ creator_id: 'other-user' }))

      await expect(service.claimTask(agent.id, task.id)).rejects.toThrow('not active')
    })

    it('throws when agent has reached concurrent task limit', async () => {
      const agent = await agentStore.create(
        makeAgentData({ max_concurrent_tasks: 1 }),
      )
      const task1 = await taskStore.create(makeTaskData({ creator_id: 'other-user' }))
      await service.claimTask(agent.id, task1.id)

      const task2 = await taskStore.create(makeTaskData({ creator_id: 'other-user' }))
      await expect(service.claimTask(agent.id, task2.id)).rejects.toThrow('max concurrent tasks')
    })
  })

  describe('approveTask', () => {
    it('updates agent stats and credit on approval', async () => {
      const agent = await agentStore.create(makeAgentData({ name: 'Reviewer Agent' }))
      const task = await taskStore.create(
        makeTaskData({ status: 'review', assignee_id: agent.id }),
      )

      const result = await service.approveTask('creator-1', task.id, 80, 'Great work')

      expect(result.task.status).toBe('done')
      expect(result.task.contribution_score).toBe(80)
      expect(result.agent.tasks_completed).toBe(1)
      expect(result.agent.avg_contribution_score).toBe(80)
      expect(result.agent.credit_score).toBe(8) // 80 / 10
      expect(result.agent.credit_history).toHaveLength(1)
      expect(result.agent.credit_history[0].delta).toBe(8)
    })

    it('auto-calculates score when not provided', async () => {
      const agent = await agentStore.create(makeAgentData())
      const task = await taskStore.create(
        makeTaskData({
          status: 'review',
          assignee_id: agent.id,
          started_at: new Date('2025-01-01'),
          completed_at: new Date('2025-01-10'),
          deadline: new Date('2025-01-10'),
          priority: 'medium',
          type: 'standard',
        }),
      )

      const result = await service.approveTask('creator-1', task.id)

      // calculateContributionScore returns 50 for on-time medium priority
      expect(result.task.contribution_score).toBe(50)
      expect(result.agent.tasks_completed).toBe(1)
      expect(result.agent.credit_score).toBe(5) // 50 / 10
    })

    it('uses running average for consecutive approvals', async () => {
      const agent = await agentStore.create(makeAgentData())

      const task1 = await taskStore.create(
        makeTaskData({ status: 'review', assignee_id: agent.id }),
      )
      const r1 = await service.approveTask('creator-1', task1.id, 60)
      expect(r1.agent.avg_contribution_score).toBe(60)

      const task2 = await taskStore.create(
        makeTaskData({ status: 'review', assignee_id: agent.id }),
      )
      const r2 = await service.approveTask('creator-1', task2.id, 90)
      // avg = 60 + (90 - 60) / 2 = 75
      expect(r2.agent.avg_contribution_score).toBe(75)
      expect(r2.agent.tasks_completed).toBe(2)
    })
  })

  describe('getAgentTasks', () => {
    it('returns tasks assigned to the agent', async () => {
      const agent = await agentStore.create(makeAgentData())
      const task1 = await taskStore.create(
        makeTaskData({ title: 'A', assignee_id: agent.id, status: 'assigned' }),
      )
      const task2 = await taskStore.create(
        makeTaskData({ title: 'B', assignee_id: agent.id, status: 'in_progress' }),
      )
      await taskStore.create(makeTaskData({ title: 'C', assignee_id: 'other' }))

      const tasks = await service.getAgentTasks(agent.id)
      expect(tasks).toHaveLength(2)
      expect(tasks.map(t => t.id).sort()).toEqual([task1.id, task2.id].sort())
    })

    it('filters by status', async () => {
      const agent = await agentStore.create(makeAgentData())
      await taskStore.create(
        makeTaskData({ assignee_id: agent.id, status: 'assigned' }),
      )
      await taskStore.create(
        makeTaskData({ assignee_id: agent.id, status: 'done' }),
      )

      const assigned = await service.getAgentTasks(agent.id, 'assigned')
      expect(assigned).toHaveLength(1)
      expect(assigned[0].status).toBe('assigned')
    })
  })
})
