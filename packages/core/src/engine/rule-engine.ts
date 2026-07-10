// packages/core/src/engine/rule-engine.ts
// 规则引擎 - 基于阈值的一致性检测

import { Entity, RawEvent, Insight, Conflict } from '../types'

export class RuleEngine {
  // 检测实体一致性
  checkConsistency(entity: Entity, events: RawEvent[]): Conflict[] {
    const conflicts: Conflict[] = []

    // 规则 1: 状态冲突检测
    const statusConflict = this.detectStatusConflict(entity, events)
    if (statusConflict) conflicts.push(statusConflict)

    // 规则 2: 时间线冲突检测
    const timelineConflict = this.detectTimelineConflict(events)
    if (timelineConflict) conflicts.push(timelineConflict)

    return conflicts
  }

  // 检测状态冲突：不同来源报告的状态不一致
  private detectStatusConflict(entity: Entity, events: RawEvent[]): Conflict | null {
    const statusBySource = new Map<string, string>()

    for (const event of events) {
      if (event.type === 'pull_request' || event.type === 'issue') {
        const status = event.payload.state
        if (status) {
          statusBySource.set(event.connector_id, status)
        }
      }
    }

    if (statusBySource.size < 2) return null

    const statuses = Array.from(statusBySource.values())
    const allSame = statuses.every(s => s === statuses[0])

    if (!allSame) {
      return {
        field: 'status',
        sources: Array.from(statusBySource.entries()).map(([connector_id, value]) => ({
          connector_id,
          value,
        })),
        severity: 'high',
      }
    }

    return null
  }

  // 检测时间线冲突：PR 已合并但 Issue 未关闭
  private detectTimelineConflict(events: RawEvent[]): Conflict | null {
    const mergedPRs = events.filter(e => 
      e.type === 'pull_request' && e.payload.merged === true
    )
    const openIssues = events.filter(e => 
      e.type === 'issue' && e.payload.state === 'open'
    )

    // 如果有已合并的 PR 但关联的 Issue 还是 open，可能是冲突
    if (mergedPRs.length > 0 && openIssues.length > 0) {
      // 检查是否有实体引用关联
      const prRefs = mergedPRs.flatMap(pr => pr.entity_refs)
      const issueRefs = openIssues.flatMap(issue => issue.entity_refs)
      const hasOverlap = prRefs.some(ref => issueRefs.includes(ref))

      if (hasOverlap) {
        return {
          field: 'timeline',
          sources: [
            { connector_id: 'github', value: `${mergedPRs.length} PRs merged` },
            { connector_id: 'github', value: `${openIssues.length} issues still open` },
          ],
          severity: 'medium',
        }
      }
    }

    return null
  }

  // 生成每日摘要
  generateDailySummary(events: RawEvent[]): Insight {
    const today = new Date()
    const todayEvents = events.filter(e => {
      const eventDate = new Date(e.timestamp)
      return eventDate.toDateString() === today.toDateString()
    })

    const prCount = todayEvents.filter(e => e.type === 'pull_request').length
    const issueCount = todayEvents.filter(e => e.type === 'issue').length
    const commitCount = todayEvents.filter(e => e.type === 'commit').length

    return {
      id: `daily-${today.toISOString().split('T')[0]}`,
      type: 'daily',
      target_entity_id: null,
      content: {
        date: today.toISOString().split('T')[0],
        summary: `Today: ${prCount} PRs, ${issueCount} issues, ${commitCount} commits`,
        metrics: { prCount, issueCount, commitCount },
        events: todayEvents.slice(0, 10).map(e => ({
          type: e.type,
          title: e.payload.title || e.payload.message,
          author: e.payload.author,
        })),
      },
      channel: 'web',
      delivered_at: today,
    }
  }

  // 生成异常警报
  generateAnomalyAlert(conflicts: Conflict[], entity: Entity): Insight | null {
    if (conflicts.length === 0) return null

    const highSeverity = conflicts.filter(c => c.severity === 'high')
    if (highSeverity.length === 0) return null

    return {
      id: `anomaly-${entity.id}-${Date.now()}`,
      type: 'anomaly',
      target_entity_id: entity.id,
      content: {
        entity: entity.id,
        conflicts: highSeverity.map(c => ({
          field: c.field,
          severity: c.severity,
          details: c.sources,
        })),
        message: `Detected ${highSeverity.length} high-severity conflicts for ${entity.type} ${entity.id}`,
      },
      channel: 'web',
      delivered_at: new Date(),
    }
  }
}
