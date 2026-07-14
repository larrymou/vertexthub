import type { Task, TaskStatus } from '../types'
import { ValidationError, ConflictError } from '../errors'

export class TaskStateMachine {
  claim(task: Task, userId: string): Task {
    this.requireStatus(task, 'open')
    if (task.creator_id === userId) {
      throw new ConflictError('Creator cannot claim their own task')
    }
    return this.transition(task, 'assigned', { assignee_id: userId })
  }

  start(task: Task, userId: string): Task {
    this.requireStatus(task, 'assigned')
    this.requireAssignee(task, userId)
    return this.transition(task, 'in_progress', { started_at: new Date() })
  }

  submitForReview(task: Task, userId: string): Task {
    this.requireStatus(task, 'in_progress')
    this.requireAssignee(task, userId)
    return this.transition(task, 'review')
  }

  approve(task: Task, reviewerId: string, score: number, notes?: string): Task {
    this.requireStatus(task, 'review')
    this.requireCreator(task, reviewerId)
    return this.transition(task, 'done', {
      completed_at: new Date(),
      contribution_score: score,
      review_notes: notes ?? null,
    })
  }

  reject(task: Task, reviewerId: string, notes: string): Task {
    this.requireStatus(task, 'review')
    this.requireCreator(task, reviewerId)
    if (!notes || notes.trim().length === 0) {
      throw new ValidationError('Rejection requires notes', 'review_notes')
    }
    return this.transition(task, 'revision', { review_notes: notes })
  }

  resubmit(task: Task, userId: string): Task {
    this.requireStatus(task, 'revision')
    this.requireAssignee(task, userId)
    return this.transition(task, 'review')
  }

  cancel(task: Task, userId: string): Task {
    if (task.status !== 'open' && task.status !== 'assigned') {
      throw new ConflictError(
        `Cannot cancel task in status '${task.status}'; only open/assigned tasks can be cancelled`
      )
    }
    this.requireCreator(task, userId)
    return this.transition(task, 'cancelled')
  }

  private requireStatus(task: Task, expected: TaskStatus): void {
    if (task.status !== expected) {
      throw new ConflictError(
        `Expected status '${expected}' but task is '${task.status}'`
      )
    }
  }

  private requireAssignee(task: Task, userId: string): void {
    if (task.assignee_id !== userId) {
      throw new ConflictError('Only the assignee can perform this action')
    }
  }

  private requireCreator(task: Task, userId: string): void {
    if (task.creator_id !== userId) {
      throw new ConflictError('Only the creator can perform this action')
    }
  }

  private transition(task: Task, status: TaskStatus, patch: Partial<Task> = {}): Task {
    return { ...task, ...patch, status, updated_at: new Date() }
  }
}

export interface ContributionScoreParams {
  started_at: Date
  completed_at: Date
  deadline: Date | null
  priority: Task['priority']
  type: string
}

export function calculateContributionScore(params: ContributionScoreParams): number | null {
  const { started_at, completed_at, deadline, priority, type } = params

  if (!deadline) {
    return null
  }

  let score = 50

  const diffMs = deadline.getTime() - completed_at.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays > 0) {
    score += Math.min(Math.floor(diffDays) * 5, 20)
  } else if (diffDays < 0) {
    score += Math.max(Math.ceil(diffDays) * 5, -20)
  }

  if (priority === 'urgent') score += 10
  else if (priority === 'high') score += 5

  if (type === 'exploration') score += 10

  return Math.max(0, Math.min(100, score))
}
