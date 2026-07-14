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
  attributes?: Record<string, string | number | boolean>
  consistency: {
    status: string
    last_checked: string
  }
}

// 任务接口
interface Task {
  id: string
  title: string
  description: string
  status: 'open' | 'assigned' | 'in_progress' | 'review' | 'revision' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  type: string
  creator_id: string
  assignee_id: string | null
  deadline: string | null
  tags: string[]
  contribution_score: number | null
  created_at: string
}

// 智能体接口
interface Agent {
  id: string
  name: string
  type: 'human' | 'ai'
  credit_score: number
  skills: string[]
  tasks_completed: number
  status: string
}

// 技能接口
interface Skill {
  id: string
  name: string
  display_name: string
  category: string
}

// 任务统计
interface TaskStats {
  total: number
  by_status: Record<string, number>
}

// 智能体统计
interface AgentStats {
  total: number
  avg_credit_score: number
}

// 验证指标
interface VerificationMetrics {
  efficiency: {
    avg_decision_hours: number
    avg_delivery_hours: number
    decision_count: number
  }
  output: {
    completion_rate: number
    tasks_per_agent: number
    total_done: number
  }
  health: {
    avg_contribution_score: number
    cancel_rate: number
    active_agent_count: number
    total_agents: number
  }
}

// 匹配结果
interface MatchResult {
  agent: Agent
  score: number
  matched_skills: string[]
  missing_skills: string[]
}

function isValidInsight(data: unknown): data is Insight {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return typeof obj.id === 'string' && typeof obj.type === 'string' && typeof obj.content === 'object' && obj.content !== null
}

function isValidEntity(data: unknown): data is Entity {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return typeof obj.id === 'string' && typeof obj.type === 'string'
}

interface ErrorBoundaryProps {
  children: ReactNode
  onRetry?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  retryCount: number
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, retryCount: 0 }

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
            <button className="btn" onClick={() => {
              this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }))
              this.props.onRetry?.()
            }}>
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// 验证指标组件
function MetricsView() {
  const [metrics, setMetrics] = useState<VerificationMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/metrics/verification')
        if (res.ok) {
          const data = await res.json()
          setMetrics(data)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [])

  if (loading) return <div className="loading">Loading metrics...</div>
  if (!metrics) return null

  return (
    <div className="metrics-header">
      <div className="metrics-toggle" onClick={() => setCollapsed(!collapsed)}>
        <span className="metrics-toggle-label">Verification Metrics</span>
        <span className="metrics-toggle-icon">{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-value">{metrics.efficiency.avg_decision_hours.toFixed(1)}</span>
            <span className="metric-label">Avg Decision Time (h)</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{metrics.efficiency.avg_delivery_hours.toFixed(1)}</span>
            <span className="metric-label">Avg Delivery Time (h)</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{(metrics.output.completion_rate * 100).toFixed(0)}%</span>
            <span className="metric-label">Completion Rate</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{metrics.output.tasks_per_agent.toFixed(1)}</span>
            <span className="metric-label">Tasks per Agent</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{metrics.health.avg_contribution_score.toFixed(1)}</span>
            <span className="metric-label">Avg Contribution Score</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{(metrics.health.cancel_rate * 100).toFixed(0)}%</span>
            <span className="metric-label">Cancel Rate</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function App() {
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'report' | 'insights' | 'entities' | 'tasks' | 'agents' | 'skills'>('report')
  const [error, setError] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [insightsRes, entitiesRes] = await Promise.all([
        fetch('/api/insights'),
        fetch('/api/entities'),
      ])

      if (insightsRes.ok) {
        const data = await insightsRes.json()
        const allInsights = (data.insights || []).filter(isValidInsight)
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
        setEntities((data.entities || []).filter(isValidEntity))
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (window.location.pathname === '/') {
      loadData()
    } else {
      setLoading(false)
    }
  }, [loadData])

  const handleRefresh = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/insights/weekly', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.insight) {
        setWeeklyReport({
          id: data.insight.id,
          content: data.insight.content,
          delivered_at: data.insight.delivered_at,
        })
      }
    } catch (err) {
      console.error('Failed to generate report:', err)
      setError('Failed to generate report. Please try again.')
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
    <ErrorBoundary key={errorKey} onRetry={() => { setErrorKey(k => k + 1); loadData() }}>
      <div className="container">
        <header className="header">
          <h1>VertexHub</h1>
          <p className="subtitle">Organizational Nervous System</p>
        </header>

        {error && (
          <div className="error-banner" role="alert">
            <p>{error}</p>
            <button className="btn" onClick={() => { setError(null); loadData() }}>Dismiss</button>
          </div>
        )}

        <MetricsView />

        <nav className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'report'}
            className={`tab ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            Weekly Report
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'insights'}
            className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            Insights ({insights.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'entities'}
            className={`tab ${activeTab === 'entities' ? 'active' : ''}`}
            onClick={() => setActiveTab('entities')}
          >
            Entities ({entities.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'tasks'}
            className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'agents'}
            className={`tab ${activeTab === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            Agents
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'skills'}
            className={`tab ${activeTab === 'skills' ? 'active' : ''}`}
            onClick={() => setActiveTab('skills')}
          >
            Skills
          </button>
        </nav>

        <main className="content">
          <div role="tabpanel" hidden={activeTab !== 'report'}>
            <WeeklyReportView
              report={weeklyReport}
              generating={generating}
              onRefresh={handleRefresh}
            />
          </div>
          <div role="tabpanel" hidden={activeTab !== 'insights'}>
            <InsightsList insights={insights} />
          </div>
          <div role="tabpanel" hidden={activeTab !== 'entities'}>
            <EntitiesList entities={entities} />
          </div>
          <div role="tabpanel" hidden={activeTab !== 'tasks'}>
            <TasksView />
          </div>
          <div role="tabpanel" hidden={activeTab !== 'agents'}>
            <AgentsView />
          </div>
          <div role="tabpanel" hidden={activeTab !== 'skills'}>
            <SkillsView />
          </div>
        </main>
      </div>
    </ErrorBoundary>
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
        {content.metrics?.pr_merge_rate !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{Math.round(content.metrics.pr_merge_rate * 100)}%</span>
            <span className="metric-label">PR Merge Rate</span>
          </div>
        )}
        {content.metrics?.merged_prs !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{content.metrics.merged_prs}/{content.metrics.total_prs}</span>
            <span className="metric-label">PRs Merged</span>
          </div>
        )}
        {content.metrics?.total_commits !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{content.metrics.total_commits}</span>
            <span className="metric-label">Commits</span>
          </div>
        )}
        {content.metrics?.active_contributors !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{content.metrics.active_contributors}</span>
            <span className="metric-label">Contributors</span>
          </div>
        )}
        {content.metrics?.bugs_closed !== undefined && (
          <div className="metric-card">
            <span className="metric-value">{content.metrics.bugs_closed}</span>
            <span className="metric-label">Bugs Fixed</span>
          </div>
        )}
        {content.metrics?.open_prs !== undefined && (
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
      {content.highlights?.length > 0 && (
        <div className="section">
          <h3>Highlights</h3>
          <ul className="highlight-list">
            {content.highlights?.map((h, i) => (
              <li key={`h-${i}-${h.slice(0,30)}`} className="highlight-item">{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {content.risks?.length > 0 && (
        <div className="section">
          <h3>Risks</h3>
          <ul className="risk-list">
            {content.risks?.map((r, i) => (
              <li key={`r-${i}-${r.slice(0,30)}`} className="risk-item">{r}</li>
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
                  <li key={`${event.type}-${i}-${event.title.slice(0,20)}`}>
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

// 任务视图组件
function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as Task['priority'], type: '', deadline: '' })

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tasksRes, statsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/tasks/stats'),
      ])
      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setTasks(data.tasks || [])
      }
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch {
      setError('Failed to load tasks.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleAction = async (taskId: string, action: string) => {
    try {
      const res = await fetch(`/api/tasks/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, user_id: 'current-user' }),
      })
      if (res.ok) fetchTasks()
    } catch {
      setError(`Failed to ${action} task.`)
    }
  }

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTask, creator_id: 'current-user' }),
      })
      if (res.ok) {
        setShowForm(false)
        setNewTask({ title: '', description: '', priority: 'medium', type: '', deadline: '' })
        fetchTasks()
      }
    } catch {
      setError('Failed to create task.')
    }
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  if (loading) return <div className="loading">Loading tasks...</div>

  return (
    <div className="tasks-view">
      {error && <div className="error-banner" role="alert"><p>{error}</p><button className="btn" onClick={() => setError(null)}>Dismiss</button></div>}

      <div className="section-header">
        <h2>Tasks</h2>
        <button className="btn btn-refresh" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Task'}
        </button>
      </div>

      {showForm && (
        <div className="form-inline">
          <div className="form-row">
            <input className="form-input" placeholder="Title" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
            <select className="form-input" value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="form-row">
            <input className="form-input" placeholder="Type" value={newTask.type} onChange={e => setNewTask({ ...newTask, type: e.target.value })} />
            <input className="form-input" type="date" placeholder="Deadline" value={newTask.deadline} onChange={e => setNewTask({ ...newTask, deadline: e.target.value })} />
          </div>
          <div className="form-row">
            <textarea className="form-input form-textarea" placeholder="Description" value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} />
          </div>
          <button className="btn btn-refresh" onClick={handleCreate}>Create Task</button>
        </div>
      )}

      <div className="filter-bar" role="group" aria-label="Status filter">
        {['all', 'open', 'in_progress', 'review', 'done'].map(s => (
          <button key={s} className={`filter-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="list">
        {filteredTasks.length === 0 ? (
          <div className="empty">No tasks found.</div>
        ) : (
          filteredTasks.map(task => (
            <div key={task.id} className={`task-card task-status-${task.status}`}>
              <div className="card-header">
                <span className="task-title">{task.title}</span>
                <div className="task-badges">
                  <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                  <span className="badge">{task.type}</span>
                  <span className={`status-badge status-${task.status}`}>{task.status.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="card-body">
                <p className="task-desc">{task.description}</p>
                <div className="task-meta">
                  {task.assignee_id && <span className="meta-item">Assignee: {task.assignee_id}</span>}
                  {task.deadline && <span className="meta-item">Deadline: {new Date(task.deadline).toLocaleDateString()}</span>}
                  {task.contribution_score !== null && <span className="meta-item">Score: {task.contribution_score}</span>}
                </div>
                {task.tags.length > 0 && (
                  <div className="task-tags">
                    {task.tags.map(tag => <span key={tag} className="skill-badge">{tag}</span>)}
                  </div>
                )}
                <div className="action-bar">
                  {task.status === 'open' && <button className="btn" onClick={() => handleAction(task.id, 'claim')}>Claim</button>}
                  {task.status === 'assigned' && <button className="btn" onClick={() => handleAction(task.id, 'start')}>Start</button>}
                  {task.status === 'in_progress' && <button className="btn" onClick={() => handleAction(task.id, 'submit')}>Submit</button>}
                  {task.status === 'review' && (
                    <>
                      <button className="btn" onClick={() => handleAction(task.id, 'approve')}>Approve</button>
                      <button className="btn" onClick={() => handleAction(task.id, 'reject')}>Reject</button>
                    </>
                  )}
                  {task.status === 'revision' && <button className="btn" onClick={() => handleAction(task.id, 'resubmit')}>Resubmit</button>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {stats && (
        <div className="stats-bar">
          <span>Total: {stats.total}</span>
          {Object.entries(stats.by_status).map(([status, count]) => (
            <span key={status}>{status.replace('_', ' ')}: {count}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// 智能体视图组件
function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true)
      setError(null)
      try {
        const [agentsRes, statsRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/agents/stats'),
        ])
        if (agentsRes.ok) {
          const data = await agentsRes.json()
          setAgents(data.agents || [])
        }
        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data)
        }
      } catch {
        setError('Failed to load agents.')
      } finally {
        setLoading(false)
      }
    }
    fetchAgents()
  }, [])

  if (loading) return <div className="loading">Loading agents...</div>

  return (
    <div className="agents-view">
      {error && <div className="error-banner" role="alert"><p>{error}</p><button className="btn" onClick={() => setError(null)}>Dismiss</button></div>}

      <div className="section-header">
        <h2>Agents</h2>
      </div>

      <div className="list">
        {agents.length === 0 ? (
          <div className="empty">No agents found.</div>
        ) : (
          agents.map(agent => (
            <div key={agent.id} className="agent-card">
              <div className="card-header">
                <span className="agent-name">{agent.name}</span>
                <span className={`badge badge-${agent.type}`}>{agent.type}</span>
              </div>
              <div className="card-body">
                <div className="agent-stats-row">
                  <span className="meta-item">Credit: {agent.credit_score}</span>
                  <span className="meta-item">Tasks: {agent.tasks_completed}</span>
                  <span className={`status-badge status-${agent.status}`}>{agent.status}</span>
                </div>
                <div className="credit-bar-container">
                  <div className="credit-bar" style={{ width: `${Math.min(agent.credit_score, 100)}%` }} />
                </div>
                {agent.skills.length > 0 && (
                  <div className="agent-skills">
                    {agent.skills.map(skill => <span key={skill} className="skill-badge">{skill}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {stats && (
        <div className="stats-bar">
          <span>Total Agents: {stats.total}</span>
          <span>Avg Credit Score: {stats.avg_credit_score.toFixed(1)}</span>
        </div>
      )}
    </div>
  )
}

// 技能视图组件
function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [matchTaskId, setMatchTaskId] = useState('')
  const [matchResults, setMatchResults] = useState<MatchResult[]>([])
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    const fetchSkills = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/skills')
        if (res.ok) {
          const data = await res.json()
          setSkills(data.skills || [])
        }
      } catch {
        setError('Failed to load skills.')
      } finally {
        setLoading(false)
      }
    }
    fetchSkills()
  }, [])

  const categories = Array.from(new Set(skills.map(s => s.category)))
  const filteredSkills = categoryFilter === 'all' ? skills : skills.filter(s => s.category === categoryFilter)

  const handleMatch = async () => {
    if (!matchTaskId) return
    setMatching(true)
    setError(null)
    try {
      const res = await fetch('/api/skills/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: matchTaskId }),
      })
      if (res.ok) {
        const data = await res.json()
        setMatchResults(data.results || [])
      }
    } catch {
      setError('Failed to match skills.')
    } finally {
      setMatching(false)
    }
  }

  if (loading) return <div className="loading">Loading skills...</div>

  return (
    <div className="skills-view">
      {error && <div className="error-banner" role="alert"><p>{error}</p><button className="btn" onClick={() => setError(null)}>Dismiss</button></div>}

      <div className="section-header">
        <h2>Skills</h2>
      </div>

      <div className="filter-bar" role="group" aria-label="Category filter">
        <button className={`filter-btn ${categoryFilter === 'all' ? 'active' : ''}`} onClick={() => setCategoryFilter('all')}>All</button>
        {categories.map(cat => (
          <button key={cat} className={`filter-btn ${categoryFilter === cat ? 'active' : ''}`} onClick={() => setCategoryFilter(cat)}>{cat}</button>
        ))}
      </div>

      <div className="list">
        {filteredSkills.length === 0 ? (
          <div className="empty">No skills found.</div>
        ) : (
          filteredSkills.map(skill => (
            <div key={skill.id} className="skill-row">
              <span className="skill-name">{skill.display_name || skill.name}</span>
              <span className="badge">{skill.category}</span>
            </div>
          ))
        )}
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <h3>Match Test</h3>
        <div className="form-inline">
          <div className="form-row">
            <input className="form-input" placeholder="Task ID" value={matchTaskId} onChange={e => setMatchTaskId(e.target.value)} />
            <button className="btn btn-refresh" onClick={handleMatch} disabled={matching}>
              {matching ? 'Matching...' : 'Find Agents'}
            </button>
          </div>
        </div>
        {matchResults.length > 0 && (
          <div className="list" style={{ marginTop: 16 }}>
            {matchResults.map(result => (
              <div key={result.agent.id} className="match-result">
                <div className="match-header">
                  <span className="agent-name">{result.agent.name}</span>
                  <span className="match-score">Score: {result.score.toFixed(2)}</span>
                </div>
                <div className="match-body">
                  {result.matched_skills.length > 0 && (
                    <span className="meta-item">Matched: {result.matched_skills.join(', ')}</span>
                  )}
                  {result.missing_skills.length > 0 && (
                    <span className="meta-item" style={{ color: 'var(--warning)' }}>Missing: {result.missing_skills.join(', ')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
