import { describe, it, expect } from 'vitest'
import { TaskStateMachine, calculateContributionScore } from './task-state-machine'
import type { Task } from '../types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    description: 'A test task',
    status: 'open',
    priority: 'medium',
    type: 'standard',
    creator_id: 'creator-1',
    assignee_id: null,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
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

describe('TaskStateMachine', () => {
  const sm = new TaskStateMachine()

  // ── Valid transitions ──────────────────────────────────────

  describe('claim', () => {
    it('transitions open → assigned', () => {
      const task = makeTask()
      const result = sm.claim(task, 'user-2')
      expect(result.status).toBe('assigned')
      expect(result.assignee_id).toBe('user-2')
      expect(result).not.toBe(task) // immutable
    })
  })

  describe('start', () => {
    it('transitions assigned → in_progress and sets started_at', () => {
      const task = makeTask({ status: 'assigned', assignee_id: 'user-2' })
      const result = sm.start(task, 'user-2')
      expect(result.status).toBe('in_progress')
      expect(result.started_at).toBeInstanceOf(Date)
    })
  })

  describe('submitForReview', () => {
    it('transitions in_progress → review', () => {
      const task = makeTask({ status: 'in_progress', assignee_id: 'user-2', started_at: new Date() })
      const result = sm.submitForReview(task, 'user-2')
      expect(result.status).toBe('review')
    })
  })

  describe('approve', () => {
    it('transitions review → done with score and notes', () => {
      const task = makeTask({ status: 'review', assignee_id: 'user-2' })
      const result = sm.approve(task, 'creator-1', 85, 'Great work')
      expect(result.status).toBe('done')
      expect(result.completed_at).toBeInstanceOf(Date)
      expect(result.contribution_score).toBe(85)
      expect(result.review_notes).toBe('Great work')
    })

    it('approves without notes', () => {
      const task = makeTask({ status: 'review', assignee_id: 'user-2' })
      const result = sm.approve(task, 'creator-1', 70)
      expect(result.review_notes).toBeNull()
    })
  })

  describe('reject', () => {
    it('transitions review → revision with notes', () => {
      const task = makeTask({ status: 'review', assignee_id: 'user-2' })
      const result = sm.reject(task, 'creator-1', 'Needs more detail')
      expect(result.status).toBe('revision')
      expect(result.review_notes).toBe('Needs more detail')
    })
  })

  describe('resubmit', () => {
    it('transitions revision → review', () => {
      const task = makeTask({ status: 'revision', assignee_id: 'user-2' })
      const result = sm.resubmit(task, 'user-2')
      expect(result.status).toBe('review')
    })
  })

  describe('cancel', () => {
    it('transitions open → cancelled', () => {
      const task = makeTask()
      const result = sm.cancel(task, 'creator-1')
      expect(result.status).toBe('cancelled')
    })

    it('transitions assigned → cancelled', () => {
      const task = makeTask({ status: 'assigned', assignee_id: 'user-2' })
      const result = sm.cancel(task, 'creator-1')
      expect(result.status).toBe('cancelled')
    })
  })

  // ── Invalid transitions (wrong status) ─────────────────────

  describe('invalid status transitions', () => {
    it('rejects claim when not open', () => {
      const task = makeTask({ status: 'assigned', assignee_id: 'user-2' })
      expect(() => sm.claim(task, 'user-3')).toThrow("Expected status 'open'")
    })

    it('rejects start when not assigned', () => {
      const task = makeTask({ status: 'open' })
      expect(() => sm.start(task, 'user-2')).toThrow("Expected status 'assigned'")
    })

    it('rejects submitForReview when not in_progress', () => {
      const task = makeTask({ status: 'assigned', assignee_id: 'user-2' })
      expect(() => sm.submitForReview(task, 'user-2')).toThrow("Expected status 'in_progress'")
    })

    it('rejects approve when not review', () => {
      const task = makeTask({ status: 'in_progress', assignee_id: 'user-2' })
      expect(() => sm.approve(task, 'creator-1', 50)).toThrow("Expected status 'review'")
    })

    it('rejects reject when not review', () => {
      const task = makeTask({ status: 'in_progress', assignee_id: 'user-2' })
      expect(() => sm.reject(task, 'creator-1', 'notes')).toThrow("Expected status 'review'")
    })

    it('rejects resubmit when not revision', () => {
      const task = makeTask({ status: 'review', assignee_id: 'user-2' })
      expect(() => sm.resubmit(task, 'user-2')).toThrow("Expected status 'revision'")
    })

    it('rejects cancel when in_progress', () => {
      const task = makeTask({ status: 'in_progress', assignee_id: 'user-2', started_at: new Date() })
      expect(() => sm.cancel(task, 'creator-1')).toThrow('Cannot cancel task')
    })

    it('rejects cancel when done', () => {
      const task = makeTask({ status: 'done', assignee_id: 'user-2' })
      expect(() => sm.cancel(task, 'creator-1')).toThrow('Cannot cancel task')
    })
  })

  // ── Invalid actor ──────────────────────────────────────────

  describe('invalid actor', () => {
    it('rejects claim by creator', () => {
      const task = makeTask()
      expect(() => sm.claim(task, 'creator-1')).toThrow('Creator cannot claim their own task')
    })

    it('rejects start by non-assignee', () => {
      const task = makeTask({ status: 'assigned', assignee_id: 'user-2' })
      expect(() => sm.start(task, 'user-3')).toThrow('Only the assignee')
    })

    it('rejects submitForReview by non-assignee', () => {
      const task = makeTask({ status: 'in_progress', assignee_id: 'user-2', started_at: new Date() })
      expect(() => sm.submitForReview(task, 'user-3')).toThrow('Only the assignee')
    })

    it('rejects approve by non-creator', () => {
      const task = makeTask({ status: 'review', assignee_id: 'user-2' })
      expect(() => sm.approve(task, 'user-3', 50)).toThrow('Only the creator')
    })

    it('rejects reject by non-creator', () => {
      const task = makeTask({ status: 'review', assignee_id: 'user-2' })
      expect(() => sm.reject(task, 'user-3', 'notes')).toThrow('Only the creator')
    })

    it('rejects resubmit by non-assignee', () => {
      const task = makeTask({ status: 'revision', assignee_id: 'user-2' })
      expect(() => sm.resubmit(task, 'user-3')).toThrow('Only the assignee')
    })

    it('rejects cancel by non-creator', () => {
      const task = makeTask()
      expect(() => sm.cancel(task, 'user-3')).toThrow('Only the creator')
    })
  })

  // ── Edge cases ─────────────────────────────────────────────

  describe('reject edge cases', () => {
    it('rejects empty notes', () => {
      const task = makeTask({ status: 'review', assignee_id: 'user-2' })
      expect(() => sm.reject(task, 'creator-1', '')).toThrow('Rejection requires notes')
    })

    it('rejects whitespace-only notes', () => {
      const task = makeTask({ status: 'review', assignee_id: 'user-2' })
      expect(() => sm.reject(task, 'creator-1', '   ')).toThrow('Rejection requires notes')
    })
  })
})

describe('calculateContributionScore', () => {
  const base = (overrides: Record<string, unknown> = {}) => ({
    started_at: new Date('2025-01-01'),
    completed_at: new Date('2025-01-10'),
    deadline: new Date('2025-01-10'),
    priority: 'medium' as const,
    type: 'standard',
    ...overrides,
  })

  it('returns null without deadline', () => {
    expect(calculateContributionScore(base({ deadline: null }))).toBeNull()
  })

  it('returns 50 for on-time completion', () => {
    expect(calculateContributionScore(base())).toBe(50)
  })

  it('adds early bonus (+5/day, cap +20)', () => {
    // 4 days early → +20 (cap)
    const result = calculateContributionScore(base({
      completed_at: new Date('2025-01-06'),
    }))
    expect(result).toBe(70)
  })

  it('adds partial early bonus', () => {
    // 2 days early → +10
    const result = calculateContributionScore(base({
      completed_at: new Date('2025-01-08'),
    }))
    expect(result).toBe(60)
  })

  it('applies late penalty (-5/day, cap -20)', () => {
    // 4 days late → -20 (cap)
    const result = calculateContributionScore(base({
      completed_at: new Date('2025-01-14'),
    }))
    expect(result).toBe(30)
  })

  it('applies partial late penalty', () => {
    // 2 days late → -10
    const result = calculateContributionScore(base({
      completed_at: new Date('2025-01-12'),
    }))
    expect(result).toBe(40)
  })

  it('adds urgent priority bonus', () => {
    const result = calculateContributionScore(base({ priority: 'urgent' }))
    expect(result).toBe(60)
  })

  it('adds high priority bonus', () => {
    const result = calculateContributionScore(base({ priority: 'high' }))
    expect(result).toBe(55)
  })

  it('adds exploration type bonus', () => {
    const result = calculateContributionScore(base({ type: 'exploration' }))
    expect(result).toBe(60)
  })

  it('clamps to 100', () => {
    // early 4 days (+20) + urgent (+10) + exploration (+10) = 90
    const result = calculateContributionScore(base({
      completed_at: new Date('2025-01-06'),
      priority: 'urgent',
      type: 'exploration',
    }))
    expect(result).toBe(90)
  })

  it('clamps to 0', () => {
    // late 20 days → -100 penalty, but clamped
    const result = calculateContributionScore(base({
      completed_at: new Date('2025-01-30'),
    }))
    expect(result).toBe(30) // 50 - 20 (cap) = 30
  })
})
