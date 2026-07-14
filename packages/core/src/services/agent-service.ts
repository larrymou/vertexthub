// packages/core/src/services/agent-service.ts
// Agent-Task orchestration service

import type { Agent, AgentStore, Task, TaskStore, TaskStatus } from '../types'
import type { TaskStateMachine } from '../engine/task-state-machine'
import { calculateContributionScore } from '../engine/task-state-machine'
import { ConflictError, ValidationError } from '../errors'

export class AgentService {
  constructor(
    private agentStore: AgentStore,
    private taskStore: TaskStore,
    private taskStateMachine: TaskStateMachine,
  ) {}

  async claimTask(agentId: string, taskId: string): Promise<{ task: Task; agent: Agent }> {
    const agent = await this.agentStore.get(agentId)
    if (!agent) throw new ConflictError(`Agent ${agentId} not found`)
    if (agent.status !== 'active') {
      throw new ConflictError(`Agent ${agentId} is not active (status: ${agent.status})`)
    }

    const activeTasks = await this.taskStore.list({ assignee_id: agentId })
    const activeCount = activeTasks.filter(
      t => t.status === 'in_progress' || t.status === 'assigned',
    ).length
    if (activeCount >= agent.max_concurrent_tasks) {
      throw new ConflictError(
        `Agent ${agentId} has reached max concurrent tasks (${agent.max_concurrent_tasks})`,
      )
    }

    const task = await this.taskStore.get(taskId)
    if (!task) throw new ConflictError(`Task ${taskId} not found`)

    const claimed = this.taskStateMachine.claim(task, agentId)
    const updatedTask = await this.taskStore.update(taskId, claimed)
    const updatedAgent = await this.agentStore.update(agentId, { last_active_at: new Date() })

    return { task: updatedTask, agent: updatedAgent }
  }

  async approveTask(
    reviewerId: string,
    taskId: string,
    score?: number,
    notes?: string,
  ): Promise<{ task: Task; agent: Agent }> {
    const task = await this.taskStore.get(taskId)
    if (!task) throw new ConflictError(`Task ${taskId} not found`)
    if (!task.assignee_id) throw new ConflictError(`Task ${taskId} has no assignee`)

    const agent = await this.agentStore.get(task.assignee_id)
    if (!agent) throw new ConflictError(`Agent ${task.assignee_id} not found`)

    if (score === undefined) {
      if (!task.started_at) {
        throw new ValidationError('Cannot auto-calculate score without started_at')
      }
      score = calculateContributionScore({
        started_at: task.started_at,
        completed_at: new Date(),
        deadline: task.deadline,
        priority: task.priority,
        type: task.type,
      }) ?? 50
    }

    const approved = this.taskStateMachine.approve(task, reviewerId, score, notes)
    const updatedTask = await this.taskStore.update(taskId, approved)

    const prevCompleted = agent.tasks_completed
    const prevAvg = agent.avg_contribution_score ?? 0
    const newCompleted = prevCompleted + 1
    const newAvg = prevAvg + (score - prevAvg) / newCompleted

    const updatedAgent = await this.agentStore.update(agent.id, {
      tasks_completed: newCompleted,
      avg_contribution_score: newAvg,
    })

    const creditDelta = score / 10
    const creditedAgent = await this.agentStore.adjustCredit(agent.id, {
      task_id: taskId,
      delta: creditDelta,
      reason: `Task ${taskId} completed`,
      timestamp: new Date(),
    })

    return { task: updatedTask, agent: creditedAgent }
  }

  async getAgentTasks(agentId: string, status?: TaskStatus): Promise<Task[]> {
    return this.taskStore.list({ assignee_id: agentId, status })
  }
}
