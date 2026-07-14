# VertexHub

[![CI](https://github.com/larrymou/vertexthub/actions/workflows/ci.yml/badge.svg)](https://github.com/larrymou/vertexthub/actions/workflows/ci.yml)

**Organizational Nervous System** — Eliminate organizational blindness by creating a unified "truth layer" from scattered tools and data sources.

## 🎉 MVP Complete!

VertexHub MVP is now complete with all three phases delivered:

- ✅ **Phase 1**: Core validation with SQLite storage, GitHub connector, rule engine
- ✅ **Phase 2**: AI enhancement with provider abstraction, intelligent summaries, anomaly detection
- ✅ **Phase 3**: Ecosystem with Connector SDK, plugin registry, community contributions

**Test Coverage**: 59 tests passing across 7 test files

## Quick Start (5 minutes)

### Prerequisites
- Node.js 20+
- Docker (optional)

### Option 1: Run Locally

```bash
# Clone the repo
git clone https://github.com/larrymou/vertexthub.git
cd vertexhub

# Install dependencies
npm install

# Run the demo
cd packages/core
npx ts-node src/demo/mock-demo.ts
```

### Option 2: Run with Docker

```bash
# Clone the repo
git clone https://github.com/larrymou/vertexthub.git
cd vertexhub

# Start with Docker Compose
docker-compose up -d

# Access the API
open http://localhost:3000/health
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
- ✅ SQLite storage layer with WAL mode
- ✅ GitHub Connector (PRs, Issues, Commits)
- ✅ Rule Engine (consistency detection)
- ✅ Daily summary generation

### Phase 2 (AI Enhancement)
- ✅ AI Provider abstraction (Ollama, Mock)
- ✅ Intelligent summary generation (weekly, deep dive)
- ✅ Anomaly detection
- ✅ Slack Bot integration
- ✅ Connector Manager (scheduled sync)

### Phase 3 (Ecosystem)
- ✅ Connector SDK with template generator
- ✅ Plugin registry with version management
- ✅ Community contribution workflow
- ✅ Example connectors and documentation

### Production Ready
- ✅ Structured logging system
- ✅ Error handling with custom error classes
- ✅ Rate limiting and CORS configuration
- ✅ Health checks and system metrics
- ✅ Graceful shutdown handling
- ✅ Docker deployment with multi-stage builds

## API Reference

### Authentication

When `API_KEY` is set, all API endpoints (except `/health`) require the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-secret-key" http://localhost:3000/api/insights
```

### Health & Metrics
```
GET /health              - System health check (public)
GET /metrics             - System performance metrics
```

### Insights
```
GET  /api/insights?type=daily     - List insights
POST /api/insights/daily          - Generate daily summary
POST /api/insights/weekly         - Generate weekly report
```

### Entities
```
GET /api/entities?type=task
```

### Events
```
GET /api/events?connector_id=github&limit=50
```

## Connector SDK

### Generate New Connector

```bash
# Using the SDK template generator
cd packages/sdk
node templates/generate.js my-connector

# Or using the CLI
npx vertexhub-connector generate my-connector --template api
```

### Connector Structure

```
my-connector/
├── src/
│   ├── my-connector.ts      # Main implementation
│   └── my-connector.test.ts # Unit tests
├── manifest.json            # Connector metadata
├── package.json             # Dependencies
└── README.md                # Documentation
```

### Plugin Registry

```typescript
import { ConnectorRegistry } from '@vertexhub/core'

const registry = new ConnectorRegistry()

// Register connector
registry.register('my-connector', connector, metadata, '1.0.0')

// Search connectors
const results = registry.search({ type: 'api', tag: 'productivity' })

// Version management
registry.update('my-connector', newConnector, newMetadata, '1.1.0')
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./data/vertexhub.db` | SQLite database path |
| `NODE_ENV` | `development` | Environment (development, production, test) |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `CORS_ORIGIN` | `http://localhost:5173` | CORS allowed origins |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `API_KEY` | _(empty)_ | API key for authentication (optional, empty = no auth) |

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
│   ├── core/           # Core logic and types
│   ├── connectors/     # Built-in connectors
│   └── sdk/            # Connector SDK
├── apps/
│   ├── server/         # HTTP API server
│   └── web/            # Dashboard UI
├── docker-compose.yml
└── Dockerfile
```

### Running the Dashboard (Development)

```bash
# Start the API server
cd apps/server && npm run dev

# In another terminal, start the web dashboard
cd apps/web && npm run dev

# Dashboard at http://localhost:5173
# API server at http://localhost:3000
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific package tests
cd packages/core
npx vitest run

# Run with coverage
npx vitest run --coverage
```

### Test Coverage
```
✓ src/engine/rule-engine.test.ts (7 tests)
✓ src/registry/connector-registry.test.ts (29 tests)
✓ src/stores/event-store.test.ts (5 tests)
✓ src/stores/entity-store.test.ts (5 tests)
✓ src/ai/summary-generator.test.ts (3 tests)
✓ src/demo/mock-demo.test.ts (1 test)
✓ src/connectors/connector-manager.test.ts (9 tests)

Test Files  7 passed (7)
Tests       59 passed (59)
```

## Deployment

### Docker Production Deployment

```bash
# Build and start
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f vertexhub

# Health check
curl http://localhost:3000/health
```

### Environment Configuration

Create `.env` file:
```env
PORT=3000
DB_PATH=/data/vertexhub.db
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
API_KEY=your-secret-key
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Connector Development

See the [Connector SDK source](packages/sdk/) for creating custom connectors.

## License

MIT

## Support

- **Issues**: [GitHub Issues](https://github.com/larrymou/vertexthub/issues)
- **Discussions**: [GitHub Discussions](https://github.com/larrymou/vertexthub/discussions)

---

**Built with ❤️ by the VertexHub Team**