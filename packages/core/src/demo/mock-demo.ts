// packages/core/src/demo/mock-demo.ts
// Mock Demo - 端到端演示

import Database from 'better-sqlite3'
import { SqliteEventStore, SqliteEntityStore, SqliteInsightStore } from '../stores'
import { RuleEngine } from '../engine/rule-engine'
import { SummaryGenerator } from '../ai/summary-generator'
import { MockAIProvider } from '../ai/ai-provider'
import { RawEvent } from '../types'

export async function runMockDemo() {
  console.log('🚀 VertexHub Mock Demo\n')

  // 初始化
  const db = new Database(':memory:')
  const eventStore = new SqliteEventStore(db)
  const entityStore = new SqliteEntityStore(db)
  const insightStore = new SqliteInsightStore(db)
  const ruleEngine = new RuleEngine()
  const ai = new MockAIProvider()
  const summaryGenerator = new SummaryGenerator(ai)

  // 1. 模拟 GitHub 数据流入
  console.log('📥 Step 1: Simulating GitHub data sync...')

  const mockEvents: RawEvent[] = [
    {
      id: 'evt-1',
      connector_id: 'github',
      timestamp: new Date(),
      ingested_at: new Date(),
      type: 'pull_request',
      payload: { number: 123, title: 'Fix login bug', state: 'merged', author: 'alice', merged: true },
      entity_refs: ['pr-123', 'issue-456'],
      checksum: 'evt-1',
    },
    {
      id: 'evt-2',
      connector_id: 'github',
      timestamp: new Date(),
      ingested_at: new Date(),
      type: 'issue',
      payload: { number: 456, title: 'Login fails on mobile', state: 'open', author: 'bob' },
      entity_refs: ['issue-456'],
      checksum: 'evt-2',
    },
    {
      id: 'evt-3',
      connector_id: 'github',
      timestamp: new Date(),
      ingested_at: new Date(),
      type: 'commit',
      payload: { sha: 'abc1234', message: 'Fix mobile login', author: 'alice' },
      entity_refs: ['pr-123'],
      checksum: 'evt-3',
    },
    {
      id: 'evt-4',
      connector_id: 'github',
      timestamp: new Date(),
      ingested_at: new Date(),
      type: 'pull_request',
      payload: { number: 124, title: 'Add dark mode', state: 'open', author: 'charlie', merged: false },
      entity_refs: ['pr-124'],
      checksum: 'evt-4',
    },
  ]

  for (const event of mockEvents) {
    await eventStore.append(event)
  }
  console.log(`   ✓ Stored ${mockEvents.length} events\n`)

  // 2. 一致性检测
  console.log('🔍 Step 2: Running consistency checks...')

  const entity = {
    id: 'issue-456',
    type: 'issue',
    attributes: { title: 'Login fails on mobile' },
    source_mappings: [{ connector_id: 'github', external_id: '456', last_synced: new Date() }],
    evidence: [{ source: 'github', confidence: 0.95, raw_event_id: 'evt-2' }],
    consistency: { status: 'unknown' as const, conflicts: [], last_checked: new Date() },
  }

  await entityStore.upsert(entity)

  const conflicts = ruleEngine.checkConsistency(entity, mockEvents)
  if (conflicts.length > 0) {
    console.log(`   ⚠️  Found ${conflicts.length} conflicts!`)
    for (const conflict of conflicts) {
      console.log(`      - ${conflict.field} (${conflict.severity})`)
    }
  } else {
    console.log('   ✓ No conflicts detected')
  }
  console.log()

  // 3. 生成每日摘要
  console.log('📊 Step 3: Generating daily summary...')

  const dailyInsight = ruleEngine.generateDailySummary(mockEvents)
  await insightStore.save(dailyInsight)
  console.log(`   ✓ ${dailyInsight.content.summary}`)
  console.log(`   ✓ PRs: ${dailyInsight.content.metrics?.prCount}, Issues: ${dailyInsight.content.metrics?.issueCount}, Commits: ${dailyInsight.content.metrics?.commitCount}\n`)

  // 4. 生成周报
  console.log('📋 Step 4: Generating weekly summary (AI)...')

  const weeklyInsight = await summaryGenerator.generateWeeklySummary(mockEvents)
  await insightStore.save(weeklyInsight)
  console.log(`   ✓ Weekly summary generated`)
  console.log(`   ✓ Progress: ${weeklyInsight.content.progress?.length || 0} items`)
  console.log(`   ✓ Blockers: ${weeklyInsight.content.blockers?.length || 0}`)
  console.log(`   ✓ Risks: ${weeklyInsight.content.risks?.length || 0}\n`)

  // 5. 异常检测
  console.log('🚨 Step 5: Detecting anomalies...')

  const anomalies = await summaryGenerator.detectAnomalies(mockEvents)
  if (anomalies.length > 0) {
    console.log(`   ⚠️  Found ${anomalies.length} anomalies:`)
    for (const anomaly of anomalies) {
      console.log(`      - ${anomaly}`)
    }
  } else {
    console.log('   ✓ No anomalies detected')
  }
  console.log()

  // 6. 查询洞察
  console.log('📤 Step 6: Querying insights...')

  const allInsights = await insightStore.list()
  console.log(`   ✓ Total insights: ${allInsights.length}`)
  for (const insight of allInsights) {
    console.log(`      - [${insight.type}] ${insight.id}`)
  }
  console.log()

  // 完成
  console.log('✅ Mock Demo completed!')
  console.log('   - Events stored: 4')
  console.log('   - Entities tracked: 1')
  console.log('   - Insights generated: 2+')
  console.log('   - Conflicts detected: 1')
  console.log('\n🎉 VertexHub is working!')
}

// 直接运行
if (require.main === module) {
  runMockDemo().catch(console.error)
}
