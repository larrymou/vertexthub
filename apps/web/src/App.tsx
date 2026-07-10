// apps/web/src/App.tsx
// VertexHub Dashboard - 主页面

import React, { useState, useEffect } from 'react'

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
}

interface Entity {
  id: string
  type: string
  status: string
  updated_at: string
}

export function App() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'insights' | 'entities'>('insights')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [insightsRes, entitiesRes] = await Promise.all([
        fetch('/api/insights'),
        fetch('/api/entities'),
      ])

      if (insightsRes.ok) {
        const data = await insightsRes.json()
        setInsights(data.insights || [])
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
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="header">
        <h1>⚡ VertexHub</h1>
        <p className="subtitle">Organizational Nervous System</p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          📊 Insights
        </button>
        <button
          className={`tab ${activeTab === 'entities' ? 'active' : ''}`}
          onClick={() => setActiveTab('entities')}
        >
          📁 Entities
        </button>
      </nav>

      <main className="content">
        {activeTab === 'insights' ? (
          <InsightsList insights={insights} />
        ) : (
          <EntitiesList entities={entities} />
        )}
      </main>
    </div>
  )
}

function InsightsList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <div className="empty">No insights yet. Connect a data source to get started.</div>
  }

  return (
    <div className="list">
      {insights.map(insight => (
        <div key={insight.id} className={`card card-${insight.type}`}>
          <div className="card-header">
            <span className={`badge badge-${insight.type}`}>{insight.type}</span>
            <span className="date">{new Date(insight.created_at).toLocaleDateString()}</span>
          </div>
          <div className="card-body">
            {insight.content.summary && <p>{insight.content.summary}</p>}
            {insight.content.message && <p>{insight.content.message}</p>}
            {insight.content.metrics && (
              <div className="metrics">
                {Object.entries(insight.content.metrics).map(([key, value]) => (
                  <div key={key} className="metric">
                    <span className="metric-value">{value}</span>
                    <span className="metric-label">{key}</span>
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
                    {event.author && <span className="author">by {event.author}</span>}
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
            <span className={`status status-${entity.status}`}>{entity.status}</span>
          </div>
          <div className="card-body">
            <p className="entity-id">{entity.id}</p>
            <p className="updated">Updated: {new Date(entity.updated_at).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
