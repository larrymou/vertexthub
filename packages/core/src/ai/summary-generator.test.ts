// packages/core/src/ai/summary-generator.test.ts
// Summary Generator 测试

import { describe, it, expect } from 'vitest'
import { SummaryGenerator } from './summary-generator'
import { MockAIProvider } from './ai-provider'
import { RawEvent } from '../types'

describe('SummaryGenerator', () => {
  const ai = new MockAIProvider()
  const generator = new SummaryGenerator(ai)

  const createEvent = (overrides: Partial<RawEvent> = {}): RawEvent => ({
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    connector_id: 'github',
    timestamp: new Date(),
    ingested_at: new Date(),
    type: 'pull_request',
    payload: { title: 'Test PR', state: 'open', author: 'alice' },
    entity_refs: ['pr-1'],
    checksum: 'test',
    ...overrides,
  })

  it('should generate weekly summary', async () => {
    const events = [
      createEvent({ type: 'pull_request' }),
      createEvent({ type: 'issue' }),
      createEvent({ type: 'commit' }),
    ]

    const insight = await generator.generateWeeklySummary(events)
    expect(insight.type).toBe('weekly')
    expect(insight.id).toContain('weekly-')
  })

  it('should generate deep dive', async () => {
    const events = [
      createEvent({ entity_refs: ['task-1'] }),
      createEvent({ entity_refs: ['task-1'] }),
    ]

    const insight = await generator.generateDeepDive('task-1', events)
    expect(insight.type).toBe('deep_dive')
    expect(insight.target_entity_id).toBe('task-1')
  })

  it('should detect anomalies', async () => {
    const events = [
      createEvent({ type: 'pull_request' }),
      createEvent({ type: 'issue' }),
    ]

    const anomalies = await generator.detectAnomalies(events)
    expect(Array.isArray(anomalies)).toBe(true)
  })
})
