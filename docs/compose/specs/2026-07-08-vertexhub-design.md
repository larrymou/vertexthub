# VertexHub Design Specification

## [S1] System Overview

**Product:** VertexHub — An Organizational Nervous System that eliminates organizational blindness by creating a unified "truth layer" from scattered tools and data sources.

**Core Problem:** Every organization suffers from information silos, where leaders don't know what's really happening, and everyone spends time creating facades instead of doing work.

**Solution:** An AI-native platform that automatically extracts, cross-validates, and synthesizes organizational data into actionable insights — without human reporting.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    VertexHub Core                    │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐         │
│  │ Connector │ │   Truth   │ │  Insight  │         │
│  │  Engine   │ │   Layer   │ │  Engine   │         │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘         │
│        │             │             │                 │
│  ┌─────┴─────────────┴─────────────┴─────┐          │
│  │           Unified Data Bus            │          │
│  └───────────────────────────────────────┘          │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐         │
│  │    Auth   │ │ Scheduler │ │    API    │         │
│  └───────────┘ └───────────┘ └───────────┘         │
│  ┌───────────────────────────────────────┐          │
│  │         Prompt Management             │          │
│  └───────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
         ▲              ▲              ▲
         │              │              │
    ┌────┴────┐   ┌─────┴─────┐  ┌────┴────┐
    │External │   │    AI     │  │ Output  │
    │ Tools   │   │ Providers │  │ Channels│
    └─────────┘   └───────────┘  └─────────┘
```

**Note:** AI Provider abstraction is accessible to both Truth Layer (entity resolution, embeddings) and Insight Engine (synthesis, summaries). The Prompt Management module stores and versions all prompt templates.

**Core Principles:**
- Data never leaves the premises; AI calls are optional (local or cloud)
- Pluggable connectors with community contribution support
- Event-driven architecture with full audit trail

**Explicit Assumptions:**
- MVP targets a single organization (multi-tenancy deferred to Phase 4)
- Phase 1 language: English only (i18n framework in place, translations deferred)

---

## [S2] Core Modules

### 2.1 Connector Engine

Connectors are the system's eyes and ears, responsible for pulling raw data from external tools.

```typescript
interface Connector {
  id: string
  name: string

  // Lifecycle
  authenticate(credentials): Promise<void>
  fetch(config): Promise<RawEvent[]>

  // Error handling
  healthCheck(): Promise<boolean>

  // Metadata
  schema(): EntitySchema
  capabilities(): string[]
}
```

**Connector Error Handling:**
- Transient failures (network timeout, rate limit): Exponential backoff retry, max 3 attempts
- Persistent failures (auth expired, API changed): Disable connector, emit alert, log to audit
- Partial data: Accept partial results, mark gaps in `RawEvent.checksum` for later re-sync
- Dead letter queue: Failed events stored for manual inspection and replay

**Built-in Connectors:**

| Connector | Data Type | Phase | Priority |
|-----------|-----------|-------|----------|
| Google Workspace | Email, Calendar, Docs | Phase 1 | P0 |
| Slack | Messages, Channels, Files | Phase 1 | P0 |
| GitHub | PRs, Issues, Commits | Phase 1 | P0 |
| Microsoft 365 | Email, Calendar, Teams | Phase 2 | P1 |
| Jira / Linear | Tasks, Status Changes | Phase 3 | P1 |
| Notion | Pages, Databases | Phase 3 | P2 |

**Community Contribution Flow:**
1. Fork → Scaffold connector using template generator
2. Implement `Connector Interface`
3. Submit PR with test cases
4. Review → Publish to connector registry

**Connector Configuration UX:**
1. Admin selects connector type from catalog (e.g., "Google Workspace")
2. System displays required credentials and scopes
3. For OAuth connectors (Google, Microsoft, Slack): redirect to provider's OAuth consent flow
4. For API key connectors (GitHub, Jira): paste API key into masked input field
5. System validates credentials via `healthCheck()`, displays sync preview
6. Admin configures sync schedule (default: every 15 minutes)
7. Connector activates, first sync begins

### 2.2 Truth Layer

The brain of the system. Core capabilities: cross-source validation + AI synthesis.

**Workflow:**
```
Raw Event Stream
    ↓
┌───────────────────┐
│  Entity Resolution │ ← Link "the same thing" across different tools
│                    │   e.g., GitHub PR #123 ↔ Jira PROJ-456
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Cross-Source      │ ← Detect contradictions
│  Validation        │   e.g., Jira says "done" but PR not merged
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  AI Synthesis      │ ← Generate structured summaries
│                    │   "Team completed X, blocker is Y"
└───────────────────┘
```

**Entity Resolution Example:**
```json
// Input: Events from different tools
[
  { "source": "github", "type": "pr_merged", "pr": "#123", "repo": "backend" },
  { "source": "jira", "type": "status_change", "issue": "PROJ-456", "to": "Done" },
  { "source": "slack", "type": "message", "channel": "#backend", "text": "PR #123 merged, PROJ-456 done!" }
]

// Output: Unified entity
{
  "entity": "task",
  "id": "PROJ-456",
  "status": "completed",
  "evidence": [
    { "source": "github", "confidence": 0.95 },
    { "source": "jira", "confidence": 0.90 },
    { "source": "slack", "confidence": 0.85 }
  ],
  "consistency": "high"
}
```

### 2.3 Insight Engine

Transforms Truth Layer outputs into consumable insights, delivered across channels.

**Output Channels:**

| Channel | Purpose | Format |
|---------|---------|--------|
| Web Dashboard | Global view | Real-time updates |
| Slack/Teams Bot | Daily digest | Scheduled push |
| Email Report | Weekly/Monthly | PDF/HTML |
| API | System integration | JSON |
| Voice (future) | Audio briefing | TTS |

**Insight Types:**
- **Daily Digest** — Key progress + anomaly flags
- **Anomaly Alert** — Real-time contradiction detection push
- **Weekly Summary** — AI-generated weekly review
- **Deep Dive** — On-demand query for project/person details

---

## [S3] Data Types

Centralized type definitions referenced throughout the spec.

```typescript
interface RawEvent {
  id: string
  connector_id: string
  timestamp: Date
  ingested_at: Date
  type: string
  payload: Record<string, any>
  entity_refs: string[]
  checksum: string
}

interface Entity {
  id: string
  type: string  // extensible: "person", "project", "task", "document", etc.
  source_mappings: {
    connector_id: string
    external_id: string
    last_synced: Date
  }[]
  attributes: Record<string, any>
  evidence: {
    source: string
    confidence: number  // 0-1, calculated by AI provider or rule engine
    raw_event_id: string
  }[]
  consistency: {
    status: "verified" | "conflicting" | "unknown"
    conflicts: Conflict[]
    last_checked: Date
  }
}

interface Conflict {
  field: string
  sources: { connector_id: string; value: any }[]
  severity: "low" | "medium" | "high"
}

interface Insight {
  id: string
  type: "daily" | "anomaly" | "weekly" | "deep_dive"
  target_entity_id: string | null
  content: Record<string, any>
  channel: "web" | "slack" | "email" | "api"
  delivered_at: Date
}

interface EntitySchema {
  entity_type: string
  attributes: { name: string; type: string; required: boolean }[]
}

interface EventFilter {
  connector_id?: string
  type?: string
  since?: Date
  until?: Date
  entity_id?: string
  limit?: number
  cursor?: string  // pagination cursor for large datasets
}
```

**RawEvent Payload Validation:** Each connector type must declare a JSON Schema for its payload. On ingestion, payloads are validated against the schema. Invalid payloads are rejected with a logged error and stored in the dead letter queue for inspection.

---

## [S4] Data Model

**Scope Note:** Phase 1 uses single-org deployment. Schema includes `org_id` placeholder for future multi-tenancy but does not implement org isolation until Phase 4.

### 4.1 Storage Architecture

```
vertexhub-data/
├── db.sqlite              # Main database (entities, relations, indexes)
├── events/                # Raw events (organized by date)
│   ├── 2026-01-15/
│   │   ├── evt_xxx.jsonl
│   │   └── evt_xxx.jsonl
│   └── 2026-01-16/
├── blobs/                 # File objects (documents, images)
│   └── {hash}/
└── embeddings/            # Vector index (FAISS / sqlite-vss)
```

### 4.2 Abstraction Layer (Extensibility)

```typescript
interface EventStore {
  append(event: RawEvent): Promise<void>
  query(filter: EventFilter): AsyncIterable<RawEvent>
  // Future implementations: PostgreSQL, ClickHouse
}

interface EntityStore {
  upsert(entity: Entity): Promise<void>
  get(id: string): Promise<Entity | null>
  search(query: string): Promise<Entity[]>
  // Future implementations: PostgreSQL + pgvector
}

interface BlobStore {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer | null>
  // Future implementations: S3, MinIO
}
```

### 4.3 SQLite Schema

```sql
-- System tables
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  oidc_provider TEXT,
  oidc_subject TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE connectors (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  schedule TEXT DEFAULT '*/15 * * * *',
  enabled INTEGER DEFAULT 1,
  last_sync_at DATETIME,
  last_error TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  timestamp DATETIME
);

-- Domain tables
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT,
  priority TEXT,
  attributes TEXT,
  consistency_status TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE entity_mappings (
  entity_id TEXT REFERENCES entities(id),
  connector_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  last_synced DATETIME,
  PRIMARY KEY (entity_id, connector_id)
);

CREATE TABLE consistency_checks (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id),
  status TEXT,
  conflicts TEXT,
  checked_at DATETIME
);

CREATE TABLE insights (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  target_entity_id TEXT,
  content TEXT,
  channel TEXT,
  created_at DATETIME,
  delivered_at DATETIME
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_status ON entities(status);
CREATE INDEX idx_mappings_external ON entity_mappings(connector_id, external_id);
CREATE INDEX idx_insights_type ON insights(type, delivered_at);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp);
```

**Design Note:** Frequently queried fields (`status`, `priority`) are promoted to dedicated columns for indexability. The `attributes` JSON column stores low-frequency or dynamic fields only. Phase 2 migration to PostgreSQL enables JSONB indexing for arbitrary attribute queries.

**Data Retention Policy:**
- Raw events: Default 90 days, configurable per connector
- Entities: Retained while at least one active connector maps to them
- Insights: Retained indefinitely (small footprint)
- Audit logs: Retained for 1 year, then archived to compressed files
- Dead letter queue: 30 days, then purged
- Scheduled cleanup job runs nightly at 03:00 UTC

### 4.4 Migration Path

```
Phase 1: SQLite + File Storage
    ↓ (Data > 10GB or concurrency > 50)
Phase 2: PostgreSQL + S3
    ↓ (Time-series queries become bottleneck)
Phase 3: ClickHouse + S3 + pgvector
```

**Key Design Principle:** All storage operations go through interfaces. Business code never writes SQL directly. Migration only requires swapping implementations.

---

## [S5] AI Integration

### 5.1 Architecture Principle

**AI is an optional enhancement, not a hard dependency.** The system works without AI (rule engine), and AI provides smarter synthesis and detection.

```
┌─────────────────────────────────────────────┐
│               VertexHub Core                │
│                                             │
│  ┌──────────────┐      ┌──────────────┐    │
│  │  Truth Layer │      │ Insight      │    │
│  │  (entity     │      │ Engine       │    │
│  │  resolution) │      │ (synthesis)  │    │
│  └──────┬───────┘      └──────┬───────┘    │
│         │                     │            │
│         └──────────┬──────────┘            │
│                    │                       │
│           ┌────────┴────────┐              │
│           │  AI Provider    │              │
│           │  Abstraction    │              │
│           └────────┬────────┘              │
└────────────────────┼──────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────┴────┐    ┌─────┴─────┐   ┌────┴────┐
│ OpenAI  │    │ Anthropic │   │ Ollama  │
│  API    │    │   API     │   │(local)  │
└─────────┘    └───────────┘   └─────────┘
```

AI Provider is shared infrastructure. Truth Layer uses it for entity resolution and embeddings. Insight Engine uses it for synthesis and summaries.

### 5.2 Provider Abstraction

```typescript
interface AIProvider {
  id: string
  name: string

  complete(prompt: string, options?: CompleteOptions): Promise<string>
  embed(text: string): Promise<number[]>

  models(): string[]
  maxContextLength(): number
}

interface CompleteOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}
```

**Built-in Providers:**

| Provider | Use Case | Requirement |
|----------|----------|-------------|
| Ollama | Default, local-first | Local Ollama install |
| OpenAI | High-quality synthesis | API Key |
| Anthropic | Long text processing | API Key |
| Azure OpenAI | Enterprise compliance | Azure subscription |

### 5.3 AI Use Cases

**Entity Resolution:**
```
Input: Raw events from 3 sources
Task: Determine if they refer to the same thing

Prompt template:
"""
Below are data snippets from different tools. Please determine if they refer to the same work item.

GitHub: PR #123 "Fix login bug", author: alice, merged
Jira: PROJ-456 "Fix login issue", status: Done
Slack: "alice: Login bug is fixed"

Return JSON: { match: boolean, confidence: 0-1, reasoning: string }
"""
```

**Cross-Source Validation:**
```
Input: Multi-source evidence for unified entity
Task: Detect contradictions

Prompt template:
"""
Below is multi-source data about Project X. Please detect any contradictions:

- Jira: 3 tasks completed, 1 in progress
- GitHub: No code merged this week
- Calendar: No related meetings this week

Return: { consistent: boolean, conflicts: string[], explanation: string }
"""
```

**Summary Generation:**
```
Input: Event stream over a time period
Task: Generate structured summary

Prompt template:
"""
Below is the team's work event stream for the past week. Please generate a summary:

{events_json}

Output format:
- Key progress (3-5 items)
- Blockers (if any)
- Risk alerts (if any)
- Suggested focus for next week
"""
```

### 5.4 Prompt Management

Prompt templates are a core product asset, not implementation detail.

**Storage:** Prompts stored in SQLite `prompts` table with version history.

```sql
CREATE TABLE prompts (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  template TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  variables TEXT,  -- JSON array of required variable names
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE prompt_versions (
  prompt_id TEXT REFERENCES prompts(id),
  version INTEGER NOT NULL,
  template TEXT NOT NULL,
  changelog TEXT,
  created_at DATETIME,
  PRIMARY KEY (prompt_id, version)
);
```

**Management:**
- Built-in prompts ship as defaults, seeded on first run
- Admin can edit prompts via Web UI (Settings → Prompts)
- All changes versioned; rollback to any previous version
- Prompt variables (event count, time range, entity data) injected at runtime
- Each prompt has a `name` used as a stable key (e.g., `entity_resolution`, `weekly_summary`)

### 5.5 Embedding Usage

The `AIProvider.embed()` method generates vector embeddings for semantic search and clustering:

- **Entity semantic search** — "Find all tasks related to authentication"
- **Event similarity clustering** — Automatically group duplicate events from different sources
- **Smart entity linking** — Match entities across connectors by semantic similarity, not just explicit IDs

Embeddings stored in `sqlite-vss` extension (Phase 2: migrate to pgvector with PostgreSQL).

### 5.6 Fallback Strategy

When AI is unavailable, the system degrades gracefully to rule-based processing:
- Entity resolution: ID mapping + fuzzy matching
- Consistency detection: Threshold rules (status mismatch = conflict)
- Summary generation: Template filling + key metric aggregation

### 5.7 Cost Control

| Strategy | Implementation |
|----------|----------------|
| Local-first | Default to Ollama, no API costs |
| Batching | Accumulate non-realtime scenarios for batch processing |
| Caching | Same input + same model = cached result |
| Tiering | Small models for simple tasks, large models for complex ones |
| Token budget | Configurable daily/monthly token usage limits |

---

## [S6] Security Model

### 6.1 Core Principles

- **Data stays on-premises** — All processing local; only outbound is AI API calls (configurable to disable)
- **Least privilege** — Each connector requests only necessary read permissions
- **Full audit trail** — Every data access and operation logged immutably

### 6.2 Authentication & Authorization

```typescript
type AuthMethod =
  | { type: "local"; username: string; passwordHash: string }
  | { type: "oidc"; provider: string }
  | { type: "api_key"; keyHash: string }

enum Role {
  Admin = "admin",
  Viewer = "viewer",
  Operator = "operator",
}
```

**Permission Matrix:**

| Resource | Admin | Operator | Viewer |
|----------|-------|----------|--------|
| Connector config | Read/Write | Read-only | None |
| Raw events | Read/Write | Read-only | None |
| Entities & insights | Read/Write | Read/Write | Read-only |

**Connector Token Lifecycle:**
- Admin can **write** tokens (enter API keys when configuring connectors)
- Admin **reads** return masked value (e.g., `sk-***abc`)
- Only the backend process decrypts tokens for API calls
- No role (including Admin) can retrieve plaintext tokens via the UI or API

### 6.3 Data Flow Rules

- Connectors → Local storage: Encrypted transfer (TLS)
- Local storage → AI Provider: Only necessary summaries sent; configurable redaction rules
- AI Provider → Local: Returned results encrypted
- User access: Mandatory HTTPS, session tokens with expiration

### 6.4 Sensitive Data Handling

- Connector credentials: AES-256 encrypted, keys from env vars or secret management service
- Sensitive fields in raw events (emails, phone numbers): Configurable auto-redaction
- Before AI calls: Optional PII detection, automatic placeholder replacement

### 6.5 API Security

- **Rate limiting** — Configurable per-endpoint limits (default: 100 req/min per user)
- **CSRF protection** — SameSite cookies + CSRF token for form submissions
- **Encryption at rest** — SQLite database encryption via SQLCipher (optional, config flag)
- **Session management** — JWT with short expiry (15 min) + refresh token rotation

---

## [S7] Tech Stack

### 7.1 Backend: TypeScript + Node.js

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| HTTP | Fastify | High performance, strong plugin ecosystem |
| ORM | Drizzle | Type-safe, native SQLite support |
| Queue | BullMQ | Task scheduling, connector sync (requires Redis) |
| Cache/Queue broker | Redis | Required by BullMQ; also used for session cache |
| Auth | Lucia | Lightweight, multi-provider support |
| Logging | Pino | Fastify native, structured logging |
| Metrics | prom-client | Prometheus metrics exporter |

### 7.2 Frontend: React + Vite

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React 19 | Largest ecosystem, most contributors |
| Build | Vite | Fast, good HMR |
| State | Zustand | Lightweight, sufficient |
| UI | shadcn/ui | Customizable, no design system lock-in |
| Charts | Recharts | Simple, sufficient |

### 7.3 AI Integration: Vercel AI SDK

Unified interface for OpenAI / Anthropic / Ollama, with built-in streaming and tool calling.

### 7.4 Monorepo Structure

```
vertexhub/
├── packages/
│   ├── core/           # Core logic (storage, entities, events)
│   ├── connectors/     # Connector plugins
│   ├── ai/             # AI Provider abstraction + prompt management
│   ├── server/         # HTTP API
│   └── web/            # Frontend
├── docker/
│   └── Dockerfile
└── pnpm-workspace.yaml
```

Managed with pnpm workspace. Each package can be independently published. Community can contribute only connectors.

### 7.5 Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit tests | Vitest | 80% core logic |
| Integration tests | Vitest + in-memory SQLite (`:memory:`) | All store implementations |
| E2E tests | Playwright | Critical user flows |
| API tests | Supertest + Fastify inject | All endpoints |

**Conventions:**
- Tests co-located with source: `*.test.ts` next to `*.ts`
- CI runs tests on every PR; merge blocked on failure
- Connector tests mock external APIs using `msw` (Mock Service Worker); no real API calls in CI
- Each test suite creates a fresh in-memory SQLite database for isolation

### 7.6 Observability

**Health Checks:**
- `GET /health` — Returns system status (database, connectors, scheduler)
- `GET /health/ready` — Returns 200 only when all subsystems initialized

**Metrics (Prometheus endpoint at `/metrics`):**
- `connector_sync_duration_seconds` — Per-connector sync latency
- `events_processed_total` — Event ingestion rate
- `ai_call_duration_seconds` — LLM provider latency
- `insights_generated_total` — Insight output rate

**Logging:**
- Pino structured JSON logs
- Log levels: debug | info | warn | error
- Request ID propagated through all logs for traceability

---

## [S8] Deployment

**Goal: One command to start, first insight within five minutes.**

### 8.1 Docker Compose

```yaml
services:
  vertexhub:
    image: vertexhub/vertexhub:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=file:/app/data/db.sqlite
      - REDIS_URL=redis://redis:6379
      - SECRET_KEY=${SECRET_KEY}
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

### 8.2 Deployment Modes

**Development:** Direct access at `localhost:3000` (HTTP). No TLS required.

**Production:** Must configure reverse proxy (Caddy, Nginx, or Traefik) with TLS termination. The application enforces HTTPS when `NODE_ENV=production`.

```yaml
# Production example with Caddy
services:
  vertexhub:
    image: vertexhub/vertexhub:latest
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - ./data:/app/data
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  caddy:
    image: caddy:2
    ports:
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  redis_data:
  caddy_data:
```

### 8.3 First-Run Wizard

After startup, visit `localhost:3000` for guided setup:
1. Create admin account
2. Select AI Provider (Ollama local / OpenAI / Skip)
3. Add first connector (Google Workspace / Slack / GitHub) — wizard guides through OAuth flow or API key entry
4. Wait for initial sync (typically 1-5 minutes depending on data volume), view first insight

### 8.4 Configuration Priority

Environment variables > Config file > Defaults

Core settings:
- `SECRET_KEY` — Session encryption (required)
- `AI_PROVIDER` — ollama | openai | anthropic | none
- `AI_API_KEY` — Cloud AI API key
- `LOG_LEVEL` — debug | info | warn | error
- `DATA_DIR` — Data storage path

### 8.5 Upgrade Process

```bash
docker compose pull
docker compose up -d
```

Auto-detect schema version on startup, run incremental migrations. SQLite has limited DDL transaction support, so rollback uses backup-based strategy: automatic backup of `db.sqlite` before migration; restore from backup on failure.

### 8.6 Backup

All data in `./data` directory. Standard file backup:
```bash
tar -czf vertexhub-backup-$(date +%Y%m%d).tar.gz ./data
```

Built-in backup command planned: `vertexhub backup create`

### 8.7 Resource Requirements

| Scale | CPU | Memory | Disk | Notes |
|-------|-----|--------|------|-------|
| Small team (10) | 2 cores | 4GB | 20GB | Includes ~256MB for Redis |
| Medium team (50) | 4 cores | 8GB | 100GB | Includes ~512MB for Redis |
| Large team (200) | 8 cores | 16GB | 500GB | Includes ~1GB for Redis |

Local Ollama requires additional GPU (8GB+ VRAM recommended). Cloud AI has no such requirement.

---

## [S9] Open Source Strategy

### 9.1 License: MIT

Enterprise-friendly, lowers adoption barrier. Validated by global projects (React, K8s, VS Code).

### 9.2 Open Source Boundary

Core engine, built-in connectors, Web dashboard — all MIT open source.

Commercial directions: managed cloud version (for teams that don't want self-hosting) and enterprise features (SSO integration via SAML/OIDC, audit compliance reports, priority support). Model validated by Grafana and GitLab.

**Clarification:** Basic OIDC login (Google, Azure AD) is open source. Enterprise SSO (SAML, custom IdP, SCIM provisioning) is a commercial feature in Phase 4.

### 9.3 Community Operations

First 6 months focus on three things:
1. High-quality documentation, especially "5-minute quick start" tutorials
2. `good first issue` labeled tasks to lower contribution barrier
3. Weekly community sync meetings for transparency

Contributor incentives: Connector contributors listed in README acknowledgments. Core contributors get Committer permissions.

### 9.4 Internationalization

Phase 1 ships English only. Frontend uses i18next framework with translation files structured for community contribution. Translation PRs welcome from Phase 2 onward.

### 9.5 Governance

Initial phase: Founding team makes technical decisions. As project matures: transition to technical committee. All design discussions public in GitHub Discussion. Major decisions require RFC process.

---

## [S10] Roadmap

### 10.1 Phase 1 (Month 1-2) — Core Validation

**Goal:** Run through minimum closed loop, validate core value.

**Deliverables:**
- SQLite storage layer + 3 basic connectors (Google Workspace, Slack, GitHub)
- Rule engine generating basic insights
- Prompt management system (versioned templates, admin UI)
- Web Dashboard read-only view
- Docker one-click deployment (including Redis)

**Success Criteria:** A 10-person team uses it for two weeks and reports "better than writing weekly reports manually."

### 10.2 Phase 2 (Month 3-4) — AI Enhancement

**Goal:** Integrate LLM, elevate insight quality.

**Deliverables:**
- Ollama local AI integration
- Cross-source consistency detection
- Intelligent summary generation
- Slack Bot daily push
- Distortion alerts

**Success Criteria:** Users say "the system found a problem I didn't know about."

### 10.3 Phase 3 (Month 5-6) — Ecosystem Launch

**Goal:** Enable community connector contributions.

**Deliverables:**
- Connector development SDK
- Contribution documentation
- 5 community-contributed connectors (Jira, Linear, Notion, Salesforce, HubSpot)
- Plugin registry

**Success Criteria:** 3+ connector PRs from non-core team members.

### 10.4 Phase 4 (Month 7-12) — Scale

**Goal:** Support larger teams, validate business model.

**Deliverables:**
- Optional PostgreSQL storage backend
- Granular permissions
- Multi-team views
- Managed cloud version Beta
- Enterprise SSO integration

**Success Criteria:** 5+ paying customers, or 50+ active open source deployments.
