// apps/web/src/App.tsx
// VertexHub Dashboard - 主页面

import { useState, useEffect, useCallback, Component, type ReactNode } from 'react'

interface WeeklyReport {
  id: string
  content: {
    summary: string
    highlights: string[]
    risks: string[]
    metrics: Record<string, number>
  }
  delivered_at: string
}

interface Insight {
  id: string
  type: string
  content: {
    summary?: string
    metrics?: Record<string, number>
    events?: Array<{ type: string; title: string; author: string }>
    message?: string
  }
  created_at: string
  delivered_at?: string
}

interface Entity {
  id: string
  type: string
  attributes?: Record<string, any>
  consistency: {
    status: string
    last_checked: string
  }
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="error">
            <h2>Something went wrong</h2>
            <p>{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button className="btn" onClick={() => this.setState({ hasError: false, error: null })}>
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function App() {
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'report' | 'insights' | 'entities'>('report')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [insightsRes, entitiesRes] = await Promise.all([
        fetch('/api/insights'),
        fetch('/api/entities'),
      ])

      if (insightsRes.ok) {
        const data = await insightsRes.json()
        const allInsights = data.insights || []
        setInsights(allInsights)

        // Find the latest weekly report
        const weekly = allInsights.find((i: Insight) => i.type === 'weekly')
        if (weekly) {
          setWeeklyReport({
            id: weekly.id,
            content: weekly.content,
            delivered_at: weekly.created_at || weekly.delivered_at,
          })
        }
      }

      if (entitiesRes.ok) {
        const data = await entitiesRes.json()
        setEntities(data.entities || [])
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/insights/weekly', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setWeeklyReport({
          id: data.insight.id,
          content: data.insight.content,
          delivered_at: data.insight.delivered_at,
        })
      }
    } catch (err) {
      console.error('Failed to generate report:', err)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (window.location.pathname !== '/') {
    return (
      <div className="container">
        <div className="not-found">
          <h2>404 - Page Not Found</h2>
          <p>The page you are looking for does not exist.</p>
          <a href="/" className="btn">Back to Home</a>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="header">
        <h1>VertexHub</h1>
        <p className="subtitle">Organizational Nervous System</p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          Weekly Report
        </button>
        <button
          className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          Insights ({insights.length})
        </button>
        <button
          className={`tab ${activeTab === 'entities' ? 'active' : ''}`}
          onClick={() => setActiveTab('entities')}
        >
          Entities ({entities.length})
        </button>
      </nav>

      <main className="content">
        {activeTab === 'report' && (
          <WeeklyReportView
            report={weeklyReport}
            generating={generating}
            onRefresh={handleRefresh}
          />
        )}
        {activeTab === 'insights' && <InsightsList insights={insights} />}
        {activeTab === 'entities' && <EntitiesList entities={entities} />}
      </main>
    </div>
  )
}

function WeeklyReportView({
  report,
  generating,
  onRefresh,
}: {
  report: WeeklyReport | null
  generating: boolean
  onRefresh: () => void
}) {
  if (!report) {
    return (
      <div className="empty">
        <p>No weekly report yet.</p>
        <button className="btn" onClick={onRefresh} disabled={generating}>
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>
    )
  }

  const { content } = report

  return (
    <div className="weekly-report">
      <div className="report-header">
        <h2>Weekly Report</h2>
        <button className="btn btn-refresh" onClick={onRefresh} disabled={generating}>
          {generating ? 'Generating...' : 'Refresh'}
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        {content.metrics.pr_merge_rate !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{Math.round(content.metrics.pr_merge_rate * 100)}%</span>
            <span className="metric-label">PR Merge Rate</span>
          </div>
        )}
        {content.metrics.merged_prs !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{content.metrics.merged_prs}/{content.metrics.total_prs}</span>
            <span className="metric-label">PRs Merged</span>
          </div>
        )}
        {content.metrics.total_commits !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{content.metrics.total_commits}</span>
            <span className="metric-label">Commits</span>
          </div>
        )}
        {content.metrics.active_contributors !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{content.metrics.active_contributors}</span>
            <span className="metric-label">Contributors</span>
          </div>
        )}
        {content.metrics.bugs_closed !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{content.metrics.bugs_closed}</span>
            <span className="metric-label">Bugs Fixed</span>
          </div>
        )}
        {content.metrics.open_prs !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{content.metrics.open_prs}</span>
            <span className="metric-label">Open PRs</span>
          </div>
        )}
      </div>

      {/* Narrative Summary */}
      <div className="section">
        <h3>Summary</h3>
        <p className="narrative">{content.summary}</p>
      </div>

      {/* Highlights */}
      {content.highlights.length > 0 && (
        <div className="section">
          <h3>Highlights</h3>
          <ul className="highlight-list">
            {content.highlights.map((h, i) => (
              <li key={i} className="highlight-item">{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {content.risks.length > 0 && (
        <div className="section">
          <h3>Risks</h3>
          <ul className="risk-list">
            {content.risks.map((r, i) => (
              <li key={i} className="risk-item">{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="report-footer">
        Generated: {new Date(report.delivered_at).toLocaleString()}
      </div>
    </div>
  )
}

function InsightsList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <div className="empty">No insights yet. Connect a data source to get started.</div>
  }

  const metricLabels: Record<string, string> = {
    pr_merge_rate: 'PR Merge Rate',
    total_prs: 'Total PRs',
    merged_prs: 'Merged PRs',
    open_prs: 'Open PRs',
    total_issues: 'Total Issues',
    bugs_opened: 'Bugs Opened',
    bugs_closed: 'Bugs Closed',
    total_commits: 'Total Commits',
    active_contributors: 'Active Contributors',
  }

  return (
    <div className="list">
      {insights.map(insight => (
        <div key={insight.id} className={`card card-${insight.type}`}>
          <div className="card-header">
            <span className={`badge badge-${insight.type}`}>{insight.type}</span>
            <span className="date">{new Date(insight.created_at || insight.delivered_at || Date.now()).toLocaleDateString()}</span>
          </div>
          <div className="card-body">
            {insight.content.summary && <p>{insight.content.summary}</p>}
            {insight.content.message && <p>{insight.content.message}</p>}
            {insight.content.metrics && (
              <div className="metrics">
                {Object.entries(insight.content.metrics).map(([key, value]) => (
                  <div key={key} className="metric">
                    <span className="metric-value">{value}</span>
                    <span className="metric-label">{metricLabels[key] || key}</span>
                  </div>
                ))}
              </div>
            )}
            {insight.content.events && insight.content.events.length > 0 && (
              <ul className="events">
                {insight.content.events.map((event, i) => (
                  <li key={i}>
                    <span className="event-type">{event.type}</span>
                    {event.title}
                    {event.author && <span className="author"> by {event.author}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function EntitiesList({ entities }: { entities: Entity[] }) {
  if (entities.length === 0) {
    return <div className="empty">No entities found. Data will appear after connector sync.</div>
  }

  return (
    <div className="list">
      {entities.map(entity => (
        <div key={entity.id} className="card">
          <div className="card-header">
            <span className="entity-type">{entity.type}</span>
            <span className={`status status-${entity.consistency.status}`}>{entity.consistency.status}</span>
          </div>
          <div className="card-body">
            <p className="entity-id">{entity.id}</p>
            {entity.attributes && (
              <div className="entity-attributes">
                {Object.entries(entity.attributes).map(([key, value]) => (
                  <span key={key} className="attribute">
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            )}
            <p className="updated">Updated: {new Date(entity.consistency.last_checked).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
