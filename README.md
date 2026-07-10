# VertexHub

**Organizational Nervous System** — Eliminate organizational blindness by creating a unified "truth layer" from scattered tools and data sources.

## Quick Start (5 minutes)

### Prerequisites
- Node.js 20+
- Docker (optional)

### Option 1: Run Locally

```bash
# Clone the repo
git clone https://github.com/your-org/vertexhub.git
cd vertexhub

# Install dependencies
cd packages/core && npm install

# Run the demo
npx ts-node src/demo/mock-demo.ts
```

### Option 2: Run with Docker

```bash
# Clone the repo
git clone https://github.com/your-org/vertexhub.git
cd vertexhub

# Start with Docker Compose
docker-compose up -d

# Access the dashboard
open http://localhost:3000
```

## Architecture

```
┌─────────────────────────────────────────────┐
│                VertexHub Core               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │ Connector │ │   Truth   │ │  Insight  │ │
│  │  Engine   │ │   Layer   │ │  Engine   │ │
│  └───────────┘ └───────────┘ └───────────┘ │
└─────────────────────────────────────────────┘
         ▲              ▲              ▲
    ┌────┴────┐   ┌─────┴─────┐  ┌────┴────┐
    │External │   │    AI     │  │ Output  │
    │ Tools   │   │ Providers │  │ Channels│
    └─────────┘   └───────────┘  └─────────┘
```

### Core Modules

| Module | Description |
|--------|-------------|
| **Connector Engine** | Pulls data from external tools (GitHub, Slack, etc.) |
| **Truth Layer** | Entity resolution, cross-source validation, AI synthesis |
| **Insight Engine** | Generates actionable insights (daily digest, anomaly alerts) |

## Features

### Phase 1 (Core Validation)
- ✅ SQLite storage layer
- ✅ GitHub Connector (PRs, Issues, Commits)
- ✅ Rule Engine (consistency detection)
- ✅ Daily summary generation

### Phase 2 (AI Enhancement)
- ✅ AI Provider abstraction (Ollama, Mock)
- ✅ Intelligent summary generation (weekly, deep dive)
- ✅ Anomaly detection
- ✅ Slack Bot integration
- ✅ Connector Manager (scheduled sync)

### Phase 3 (Ecosystem - Coming Soon)
- Connector SDK
- Community contributions
- Plugin registry

## API Reference

### Health Check
```
GET /health
```

### Insights
```
GET /api/insights?type=daily
POST /api/insights/daily
```

### Entities
```
GET /api/entities?type=task
```

### Events
```
GET /api/events?connector_id=github&limit=50
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `DATABASE_URL` | `./data/vertexhub.db` | SQLite database path |
| `AI_PROVIDER` | `mock` | AI provider (ollama, mock) |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API URL |
| `SLACK_WEBHOOK` | - | Slack webhook URL |

### Connectors

#### GitHub
```json
{
  "type": "github",
  "credentials": { "token": "ghp_xxx" },
  "config": { "owner": "your-org", "repo": "your-repo" }
}
```

## Development

### Project Structure
```
vertexhub/
├── packages/
│   ├── core/           # Core logic
│   │   ├── src/ai/     # AI providers
│   │   ├── src/engine/ # Rule engine
│   │   ├── src/stores/ # SQLite stores
│   │   └── src/demo/   # Mock demo
│   └── connectors/     # Connector plugins
├── apps/
│   ├── server/         # HTTP API
│   └── web/            # Dashboard
├── docker-compose.yml
└── Dockerfile
```

### Running Tests
```bash
cd packages/core
npx vitest run
```

### Test Coverage
```
✓ src/engine/rule-engine.test.ts (7 tests)
✓ src/stores/event-store.test.ts (5 tests)
✓ src/stores/entity-store.test.ts (5 tests)
✓ src/connectors/connector-manager.test.ts (4 tests)
✓ src/ai/summary-generator.test.ts (3 tests)

Test Files  5 passed (5)
Tests       24 passed (24)
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.
