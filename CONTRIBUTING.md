# Contributing to VertexHub

Thank you for your interest in contributing to VertexHub! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Connector Development](#connector-development)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [License](#license)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Contribute

### Types of Contributions

1. **Report Bugs** - Submit an issue with detailed reproduction steps
2. **Fix Bugs** - Look for issues labeled "good first issue"
3. **Add Features** - Discuss in an issue first before implementing
4. **Improve Documentation** - Fix typos, add examples, clarify explanations
5. **Add Connectors** - Create new data source integrations

### Before You Start

1. Check existing issues to avoid duplicate work
2. For large changes, open an issue first to discuss the approach
3. Fork the repository and create a feature branch

## Development Setup

### Prerequisites

- Node.js 20+
- npm or yarn
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/your-username/vertexhub.git
cd vertexhub

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

### Project Structure

```
vertexhub/
├── packages/
│   ├── core/           # Core logic and interfaces
│   ├── connectors/     # Built-in connectors
│   └── sdk/            # Connector SDK
├── apps/
│   ├── server/         # HTTP API server
│   └── web/            # Dashboard UI
└── docs/               # Documentation
```

## Connector Development

### Quick Start

1. **Generate Connector Template**
   ```bash
   cd packages/sdk
   node templates/generate.js my-connector
   ```

2. **Implement Connector**
   - Extend `BaseConnector` from `@vertexhub/sdk`
   - Implement required methods: `authenticate`, `fetch`, `healthCheck`
   - Define entity schema and capabilities

3. **Add Tests**
   - Write unit tests for all connector methods
   - Test error handling and edge cases
   - Ensure 80%+ code coverage

4. **Submit for Review**
   - Create a PR with your connector
   - Include documentation and examples
   - Add integration tests if possible

### Connector Requirements

- [ ] Implements `Connector` interface
- [ ] Has comprehensive error handling
- [ ] Includes unit tests
- [ ] Has documentation with examples
- [ ] Follows TypeScript best practices
- [ ] Uses minimal external dependencies
- [ ] Includes manifest.json with metadata

### Example Connector Structure

```
my-connector/
├── src/
│   ├── my-connector.ts      # Main implementation
│   └── my-connector.test.ts # Unit tests
├── manifest.json            # Connector metadata
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── README.md                # Documentation
```

## Pull Request Process

### Before Submitting

1. **Update Documentation** - Add/update relevant docs
2. **Add Tests** - Ensure new code has test coverage
3. **Run Linter** - Fix any linting issues
4. **Update Changelog** - Add entry to CHANGELOG.md
5. **Check Dependencies** - Minimize new dependencies

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated Checks** - CI must pass
2. **Code Review** - At least one maintainer approval
3. **Testing** - Verify functionality works
4. **Documentation** - Check docs are updated
5. **Merge** - Squash and merge to main

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Environment**
   - OS and version
   - Node.js version
   - Browser (if applicable)

2. **Steps to Reproduce**
   - Clear, numbered steps
   - Expected vs actual behavior
   - Screenshots if applicable

3. **Additional Context**
   - Error messages
   - Console logs
   - Related issues

### Feature Requests

When requesting features:

1. **Problem Statement** - What problem does this solve?
2. **Proposed Solution** - How should it work?
3. **Alternatives Considered** - Other approaches?
4. **Additional Context** - Use cases, examples

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Getting Help

- **Discord** - Join our community chat
- **GitHub Issues** - Search existing issues
- **Documentation** - Check the docs folder
- **Email** - Contact maintainers directly

Thank you for contributing to VertexHub! 🚀