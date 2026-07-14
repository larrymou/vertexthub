// packages/core/src/ai/weekly-report.ts
// Rule-based Weekly Report Generator - 无需 AI provider

import { RawEvent, Insight } from '../types'

interface PRData {
  number: number
  title: string
  author: string
  state: string
  merged: boolean
  labels: string[]
}

interface IssueData {
  number: number
  title: string
  author: string
  state: string
  labels: string[]
}

interface CommitData {
  sha: string
  message: string
  author: string
  prNumber?: number
}

interface WeeklyMetrics {
  totalPRs: number
  mergedPRs: number
  openPRs: number
  closedPRs: number
  prMergeRate: number
  totalIssues: number
  openedIssues: number
  closedIssues: number
  totalCommits: number
  activeContributors: number
  bugsOpened: number
  bugsClosed: number
}

function parseEvents(events: RawEvent[]) {
  const prMap = new Map<number, PRData>()
  const issueMap = new Map<number, IssueData>()
  const commits: CommitData[] = []

  for (const event of events) {
    if (event.type === 'pull_request') {
      const p = event.payload as Record<string, unknown>
      const existing = prMap.get(p.number as number)
      if (existing) {
        if (p.merged) {
          existing.merged = true
          existing.state = 'merged'
        }
      } else {
        prMap.set(p.number as number, {
          number: p.number as number,
          title: p.title as string,
          author: p.author as string,
          state: p.merged ? 'merged' : (p.state as string),
          merged: !!p.merged,
          labels: (p.labels as string[]) || [],
        })
      }
    } else if (event.type === 'issue') {
      const p = event.payload as Record<string, unknown>
      const existing = issueMap.get(p.number as number)
      if (existing) {
        existing.state = p.state as string
      } else {
        issueMap.set(p.number as number, {
          number: p.number as number,
          title: p.title as string,
          author: p.author as string,
          state: p.state as string,
          labels: (p.labels as string[]) || [],
        })
      }
    } else if (event.type === 'commit') {
      const p = event.payload as Record<string, unknown>
      commits.push({
        sha: p.sha as string,
        message: p.message as string,
        author: p.author as string,
        prNumber: p.prNumber as number | undefined,
      })
    }
  }

  return { prs: Array.from(prMap.values()), issues: Array.from(issueMap.values()), commits }
}

function computeMetrics(prs: PRData[], issues: IssueData[], commits: CommitData[]): WeeklyMetrics {
  const mergedPRs = prs.filter(p => p.merged)
  const openPRs = prs.filter(p => p.state === 'open')
  const closedPRs = prs.filter(p => p.state === 'closed')

  const openedIssues = issues.filter(i => i.state === 'open')
  const closedIssues = issues.filter(i => i.state === 'closed')

  const bugsOpened = issues.filter(i => i.labels.includes('bug')).length
  const bugsClosed = issues.filter(i => i.labels.includes('bug') && i.state === 'closed').length

  const contributors = new Set([...prs.map(p => p.author), ...commits.map(c => c.author)])

  return {
    totalPRs: prs.length,
    mergedPRs: mergedPRs.length,
    openPRs: openPRs.length,
    closedPRs: closedPRs.length,
    prMergeRate: prs.length > 0 ? mergedPRs.length / prs.length : 0,
    totalIssues: issues.length,
    openedIssues: openedIssues.length,
    closedIssues: closedIssues.length,
    totalCommits: commits.length,
    activeContributors: contributors.size,
    bugsOpened,
    bugsClosed,
  }
}

function identifyHighlights(prs: PRData[], issues: IssueData[], commits: CommitData[], metrics: WeeklyMetrics): string[] {
  const highlights: string[] = []

  // PR merge rate
  if (metrics.prMergeRate >= 0.7) {
    highlights.push(`代码审查效率高：${metrics.mergedPRs}/${metrics.totalPRs} 个 PR 已合并（${Math.round(metrics.prMergeRate * 100)}%）`)
  }

  // Bug fix progress
  if (metrics.bugsClosed > metrics.bugsOpened) {
    highlights.push(`Bug 修复进度良好：关闭 ${metrics.bugsClosed} 个，新增 ${metrics.bugsOpened} 个`)
  }

  // High-commit contributors
  const authorCommits = new Map<string, number>()
  for (const c of commits) {
    authorCommits.set(c.author, (authorCommits.get(c.author) || 0) + 1)
  }
  const topAuthors = Array.from(authorCommits.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (topAuthors.length > 0) {
    const authorList = topAuthors.map(([a, n]) => `${a}(${n} commits)`).join('、')
    highlights.push(`本周核心贡献者：${authorList}`)
  }

  // Feature progress
  const featurePRs = prs.filter(p => p.labels.includes('feature'))
  if (featurePRs.length > 0) {
    highlights.push(`新功能开发：${featurePRs.length} 个 feature PR（${featurePRs.filter(p => p.merged).length} 个已合并）`)
  }

  // Security work
  const securityPRs = prs.filter(p => p.labels.includes('security'))
  if (securityPRs.length > 0) {
    highlights.push(`安全加固：完成 ${securityPRs.length} 个安全相关 PR`)
  }

  return highlights
}

function identifyRisks(prs: PRData[], issues: IssueData[]): string[] {
  const risks: string[] = []

  // Open PRs that might be stuck
  const openPRs = prs.filter(p => p.state === 'open')
  if (openPRs.length > 3) {
    risks.push(`${openPRs.length} 个 PR 待合并，建议加快 review 节奏`)
  }

  // Urgent bugs still open
  const urgentBugs = issues.filter(i => i.state === 'open' && i.labels.includes('urgent'))
  if (urgentBugs.length > 0) {
    risks.push(`${urgentBugs.length} 个紧急 bug 待修复：${urgentBugs.map(i => `#${i.number}`).join('、')}`)
  }

  // Performance issues
  const perfIssues = issues.filter(i => i.state === 'open' && i.labels.includes('performance'))
  if (perfIssues.length > 0) {
    risks.push(`${perfIssues.length} 个性能问题待解决`)
  }

  return risks
}

function generateNarrativeSummary(prs: PRData[], issues: IssueData[], commits: CommitData[], metrics: WeeklyMetrics): string {
  const parts: string[] = []

  // Opening
  parts.push(`本周团队共提交 ${metrics.totalCommits} 个 commit，${metrics.activeContributors} 位成员参与贡献`)

  // PR narrative
  if (metrics.mergedPRs > 0) {
    const mergedTitles = prs.filter(p => p.merged).slice(0, 3).map(p => `#${p.number}`)
    parts.push(`成功合并 ${metrics.mergedPRs} 个 PR（${mergedTitles.join('、')}等）`)
  }

  // Key themes
  const themes = new Set<string>()
  for (const pr of prs) {
    if (pr.labels.includes('auth')) themes.add('认证模块')
    if (pr.labels.includes('security')) themes.add('安全加固')
    if (pr.labels.includes('performance')) themes.add('性能优化')
    if (pr.labels.includes('frontend')) themes.add('前端改进')
    if (pr.labels.includes('feature')) themes.add('新功能')
    if (pr.labels.includes('bug')) themes.add('Bug 修复')
  }

  if (themes.size > 0) {
    parts.push(`聚焦方向：${Array.from(themes).join('、')}`)
  }

  // Issues summary
  if (metrics.bugsOpened > 0 || metrics.bugsClosed > 0) {
    parts.push(`Bug 动态：新增 ${metrics.bugsOpened} 个，关闭 ${metrics.bugsClosed} 个`)
  }

  const text = parts.join('。')
  return text.endsWith('。') ? text : text + '。'
}

export function generateWeeklyReport(events: RawEvent[]): Insight {
  const { prs, issues, commits } = parseEvents(events)
  const metrics = computeMetrics(prs, issues, commits)
  const highlights = identifyHighlights(prs, issues, commits, metrics)
  const risks = identifyRisks(prs, issues)
  const summary = generateNarrativeSummary(prs, issues, commits, metrics)

  return {
    id: `weekly-report-${new Date().toISOString().split('T')[0]}`,
    type: 'weekly',
    target_entity_id: null,
    content: {
      summary,
      highlights,
      risks,
      metrics: {
        pr_merge_rate: Math.round(metrics.prMergeRate * 100) / 100,
        total_prs: metrics.totalPRs,
        merged_prs: metrics.mergedPRs,
        open_prs: metrics.openPRs,
        total_issues: metrics.totalIssues,
        bugs_opened: metrics.bugsOpened,
        bugs_closed: metrics.bugsClosed,
        total_commits: metrics.totalCommits,
        active_contributors: metrics.activeContributors,
      },
    },
    channel: 'web',
    delivered_at: new Date(),
  }
}
