// packages/core/src/engine/rule-engine.test.ts
// Rule Engine 测试

import { describe, it, expect } from 'vitest'
import { RuleEngine } from './rule-engine'
import { Entity, RawEvent } from '../types'

describe('RuleEngine', () => {
  const engine = new RuleEngine()

  const createEvent = (overrides: Partial<RawEvent> = {}): RawEvent => ({
    id: `evt-${Date.now()}`,
    connector_id: 'github',
    timestamp: new Date(),
    ingested_at: new Date(),
    type: 'pull_request',
    payload: { title: 'Test PR', state: 'open', merged: false },
    entity_refs: ['pr-1'],
    checksum: 'test-checksum',
    ...overrides,
  })

  const createEntity = (overrides: Partial<Entity> = {}): Entity => ({
    id: 'entity-1',
    type: 'task',
    attributes: {},
    source_mappings: [],
    evidence: [],
    consistency: { status: 'unknown', conflicts: [], last_checked: new Date() },
    ...overrides,
  })

  describe('checkConsistency', () => {
    it('should detect status conflict between sources', () => {
      const entity = createEntity()
      const events = [
        createEvent({ connector_id: 'github', payload: { state: 'open' } }),
        createEvent({ connector_id: 'jira', payload: { state: 'closed' } }),
      ]

      const conflicts = engine.checkConsistency(entity, events)
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].field).toBe('status')
      expect(conflicts[0].severity).toBe('high')
    })

    it('should return no conflicts when statuses match', () => {
      const entity = createEntity()
      const events = [
        createEvent({ connector_id: 'github', payload: { state: 'open' } }),
        createEvent({ connector_id: 'jira', payload: { state: 'open' } }),
      ]

      const conflicts = engine.checkConsistency(entity, events)
      expect(conflicts).toHaveLength(0)
    })

    it('should return no conflicts with single source', () => {
      const entity = createEntity()
      const events = [
        createEvent({ connector_id: 'github', payload: { state: 'open' } }),
      ]

      const conflicts = engine.checkConsistency(entity, events)
      expect(conflicts).toHaveLength(0)
    })
  })

  describe('generateDailySummary', () => {
    it('should generate summary with today events', () => {
      const events = [
        createEvent({ type: 'pull_request' }),
        createEvent({ type: 'pull_request' }),
        createEvent({ type: 'issue' }),
        createEvent({ type: 'commit' }),
      ]

      const insight = engine.generateDailySummary(events)
      expect(insight.type).toBe('daily')
      const metrics = insight.content.metrics as Record<string, unknown>
      expect(metrics?.prCount).toBe(2)
      expect(metrics?.issueCount).toBe(1)
      expect(metrics?.commitCount).toBe(1)
    })
  })

  describe('generateAnomalyAlert', () => {
    it('should generate alert for high severity conflicts', () => {
      const entity = createEntity()
      const conflicts = [
        { field: 'status', sources: [], severity: 'high' as const },
      ]

      const alert = engine.generateAnomalyAlert(conflicts, entity)
      expect(alert).not.toBeNull()
      expect(alert!.type).toBe('anomaly')
    })

    it('should return null for no conflicts', () => {
      const entity = createEntity()
      const alert = engine.generateAnomalyAlert([], entity)
      expect(alert).toBeNull()
    })

    it('should return null for low severity only', () => {
      const entity = createEntity()
      const conflicts = [
        { field: 'status', sources: [], severity: 'low' as const },
      ]

      const alert = engine.generateAnomalyAlert(conflicts, entity)
      expect(alert).toBeNull()
    })
  })
})
