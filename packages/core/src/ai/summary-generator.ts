// packages/core/src/ai/summary-generator.ts
// 智能摘要生成器

import { AIProvider } from './ai-provider'
import { RawEvent, Insight } from '../types'

export class SummaryGenerator {
  private ai: AIProvider

  constructor(ai: AIProvider) {
    this.ai = ai
  }

  // 生成周报
  async generateWeeklySummary(events: RawEvent[]): Promise<Insight> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weekEvents = events.filter(e => new Date(e.timestamp) >= oneWeekAgo)

    const eventsText = weekEvents
      .slice(0, 100)
      .map(e => `- [${e.type}] ${e.payload.title || e.payload.message || JSON.stringify(e.payload).substring(0, 100)}`)
      .join('\n')

    const prompt = `Below is the team's work event stream for the past week. Please generate a structured summary.

Events:
${eventsText}

Output format:
- Key progress (3-5 items)
- Blockers (if any)
- Risk alerts (if any)
- Suggested focus for next week

Respond in JSON format:
{
  "progress": ["item1", "item2"],
  "blockers": ["blocker1"],
  "risks": ["risk1"],
  "suggestions": ["suggestion1"]
}`

    const response = await this.ai.complete(prompt, {
      systemPrompt: 'You are an organizational analyst. Generate concise, actionable summaries.',
      temperature: 0.3,
    })

    let content: Record<string, any>
    try {
      content = JSON.parse(response)
    } catch {
      content = { raw: response }
    }

    return {
      id: `weekly-${new Date().toISOString().split('T')[0]}`,
      type: 'weekly',
      target_entity_id: null,
      content,
      channel: 'web',
      delivered_at: new Date(),
    }
  }

  // 生成项目深度分析
  async generateDeepDive(entityId: string, events: RawEvent[]): Promise<Insight> {
    const entityEvents = events.filter(e => e.entity_refs.includes(entityId))

    const eventsText = entityEvents
      .map(e => `- [${e.type}] ${e.payload.title || e.payload.message} (${new Date(e.timestamp).toLocaleDateString()})`)
      .join('\n')

    const prompt = `Analyze the following work items for entity "${entityId}":

${eventsText}

Provide:
1. Status assessment
2. Timeline analysis
3. Risk factors
4. Recommendations

Respond in JSON format:
{
  "status": "on_track|at_risk|blocked",
  "timeline": "description",
  "risks": ["risk1"],
  "recommendations": ["rec1"]
}`

    const response = await this.ai.complete(prompt, {
      systemPrompt: 'You are a project analyst. Provide detailed, data-driven assessments.',
      temperature: 0.3,
    })

    let content: Record<string, any>
    try {
      content = JSON.parse(response)
    } catch {
      content = { raw: response }
    }

    return {
      id: `deep-dive-${entityId}-${Date.now()}`,
      type: 'deep_dive',
      target_entity_id: entityId,
      content,
      channel: 'web',
      delivered_at: new Date(),
    }
  }

  // 检测异常
  async detectAnomalies(events: RawEvent[]): Promise<string[]> {
    const recentEvents = events.slice(0, 50)

    const eventsText = recentEvents
      .map(e => `- [${e.type}] ${e.payload.title || e.payload.message}`)
      .join('\n')

    const prompt = `Analyze these recent work events and identify any anomalies or concerns:

${eventsText}

Look for:
- Unusual patterns (sudden drops in activity, spikes in issues)
- Contradictions (PR merged but issue still open)
- Potential blockers (long-running tasks, stalled PRs)
- Communication gaps

Respond with a JSON array of anomaly descriptions:
["anomaly1", "anomaly2"]`

    const response = await this.ai.complete(prompt, {
      systemPrompt: 'You are an anomaly detection system. Identify potential issues early.',
      temperature: 0.2,
    })

    try {
      return JSON.parse(response)
    } catch {
      return [response]
    }
  }
}
