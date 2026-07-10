// packages/sdk/src/docs.ts
// VertexHub Connector SDK 文档帮助

import { ConnectorManifest } from './types'
import { validateManifest, compareVersions } from './utils'

// ═══════════════════════════════════════════════════════════════
// 文档生成器
// ═══════════════════════════════════════════════════════════════

export class DocumentationGenerator {
  // 生成连接器文档
  generateConnectorDocs(manifest: ConnectorManifest): string {
    const { metadata, config, credentials, capabilities, events } = manifest

    let docs = `# ${metadata.name}\n\n`
    docs += `${metadata.description}\n\n`

    // 元数据
    docs += `## Metadata\n\n`
    docs += `| Property | Value |\n`
    docs += `|----------|-------|\n`
    docs += `| ID | ${metadata.id} |\n`
    docs += `| Version | ${metadata.version} |\n`
    docs += `| Author | ${metadata.author} |\n`
    docs += `| License | ${metadata.license} |\n`
    if (metadata.homepage) {
      docs += `| Homepage | ${metadata.homepage} |\n`
    }
    if (metadata.repository) {
      docs += `| Repository | ${metadata.repository} |\n`
    }
    docs += `\n`

    // 配置
    docs += `## Configuration\n\n`
    if (config.properties && Object.keys(config.properties).length > 0) {
      docs += `### Config Properties\n\n`
      docs += `| Property | Type | Required | Description |\n`
      docs += `|----------|------|----------|-------------|\n`
      for (const [name, prop] of Object.entries(config.properties)) {
        const required = config.required.includes(name) ? 'Yes' : 'No'
        docs += `| ${name} | ${prop.type} | ${required} | ${prop.description} |\n`
      }
      docs += `\n`
    } else {
      docs += `No configuration required.\n\n`
    }

    // 凭证
    docs += `### Credentials\n\n`
    if (credentials.properties && Object.keys(credentials.properties).length > 0) {
      docs += `| Property | Type | Required | Description |\n`
      docs += `|----------|------|----------|-------------|\n`
      for (const [name, prop] of Object.entries(credentials.properties)) {
        const required = credentials.required.includes(name) ? 'Yes' : 'No'
        docs += `| ${name} | ${prop.type} | ${required} | ${prop.description} |\n`
      }
      docs += `\n`
    } else {
      docs += `No credentials required.\n\n`
    }

    // 能力
    docs += `## Capabilities\n\n`
    if (capabilities.length > 0) {
      docs += `- ${capabilities.join('\n- ')}\n\n`
    } else {
      docs += `No specific capabilities defined.\n\n`
    }

    // 事件
    docs += `## Events\n\n`
    if (events.length > 0) {
      for (const event of events) {
        docs += `### ${event.type}\n\n`
        docs += `${event.description}\n\n`
        if (event.payload && Object.keys(event.payload).length > 0) {
          docs += `| Property | Type | Description |\n`
          docs += `|----------|------|-------------|\n`
          for (const [name, prop] of Object.entries(event.payload)) {
            docs += `| ${name} | ${prop.type} | ${prop.description} |\n`
          }
          docs += `\n`
        }
        docs += `Entity References: ${event.entityRefs.join(', ')}\n\n`
      }
    } else {
      docs += `No events defined.\n\n`
    }

    return docs
  }

  // 生成使用示例
  generateUsageExample(manifest: ConnectorManifest): string {
    const { metadata } = manifest
    const className = `${metadata.id.charAt(0).toUpperCase() + metadata.id.slice(1)}Connector`

    let example = `// Usage example for ${metadata.name}\n\n`
    example += `import { ${className} } from '@vertexhub/${metadata.id}-connector'\n\n`
    example += `// Create connector instance\n`
    example += `const connector = new ${className}(\n`
    example += `  'my-${metadata.id}',\n`
    example += `  'My ${metadata.name}'\n`
    example += `)\n\n`
    example += `// Authenticate\n`
    example += `await connector.authenticate({\n`
    example += `  // credentials\n`
    example += `})\n\n`
    example += `// Configure (if needed)\n`
    example += `connector.configure({\n`
    example += `  // config\n`
    example += `})\n\n`
    example += `// Fetch events\n`
    example += `const events = await connector.fetch()\n`
    example += `console.log(\`Fetched \${events.length} events\`)\n\n`
    example += `// Health check\n`
    example += `const healthy = await connector.healthCheck()\n`
    example += `console.log(\`Connector healthy: \${healthy}\`)\n`

    return example
  }

  // 生成贡献指南
  generateContributingGuide(): string {
    let guide = `# Contributing to VertexHub Connectors\n\n`
    guide += `Thank you for your interest in contributing to VertexHub!\n\n`
    guide += `## Getting Started\n\n`
    guide += `1. Fork the repository\n`
    guide += `2. Create a feature branch (\`git checkout -b feature/my-connector\`)\n`
    guide += `3. Make your changes\n`
    guide += `4. Add tests\n`
    guide += `5. Submit a pull request\n\n`
    guide += `## Development Setup\n\n`
    guide += `### Prerequisites\n\n`
    guide += `- Node.js 20+\n`
    guide += `- npm or yarn\n\n`
    guide += `### Installation\n\n`
    guide += `\`\`\`bash\n`
    guide += `git clone https://github.com/your-org/vertexhub.git\n`
    guide += `cd vertexhub\n`
    guide += `npm install\n`
    guide += `\`\`\`\n\n`
    guide += `### Creating a New Connector\n\n`
    guide += `1. Use the connector generator:\n`
    guide += `\`\`\`bash\n`
    guide += `npx vertexhub-connector generate my-connector\n`
    guide += `\`\`\`\n\n`
    guide += `2. Implement the connector interface\n`
    guide += `3. Add tests\n`
    guide += `4. Create a manifest.json file\n`
    guide += `5. Add documentation\n\n`
    guide += `### Testing\n\n`
    guide += `\`\`\`bash\n`
    guide += `npm test\n`
    guide += `\`\`\`\n\n`
    guide += `### Linting\n\n`
    guide += `\`\`\`bash\n`
    guide += `npm run lint\n`
    guide += `\`\`\`\n\n`
    guide += `## Connector Standards\n\n`
    guide += `### File Structure\n\n`
    guide += `\`\`\`\n`
    guide += `my-connector/\n`
    guide += `├── src/\n`
    guide += `│   └── index.ts\n`
    guide += `├── tests/\n`
    guide += `│   └── index.test.ts\n`
    guide += `├── manifest.json\n`
    guide += `├── package.json\n`
    guide += `└── README.md\n`
    guide += `\`\`\`\n\n`
    guide += `### Manifest Requirements\n\n`
    guide += `Every connector must include a \`manifest.json\` file with:\n\n`
    guide += `- \`metadata\`: Connector metadata (id, name, version, etc.)\n`
    guide += `- \`config\`: Configuration schema\n`
    guide += `- \`credentials\`: Credentials schema\n`
    guide += `- \`capabilities\`: List of capabilities\n`
    guide += `- \`events\`: Event definitions\n\n`
    guide += `### Code Standards\n\n`
    guide += `- Use TypeScript\n`
    guide += `- Follow the existing code style\n`
    guide += `- Add JSDoc comments for public APIs\n`
    guide += `- Write tests for all functionality\n`
    guide += `- Handle errors gracefully\n\n`
    guide += `### Pull Request Process\n\n`
    guide += `1. Update the README.md with details of changes\n`
    guide += `2. Add tests for new functionality\n`
    guide += `3. Ensure all tests pass\n`
    guide += `4. Update the manifest.json version\n`
    guide += `5. Request review from maintainers\n\n`
    guide += `## Code of Conduct\n\n`
    guide += `Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) in all interactions.\n\n`
    guide += `## Questions?\n\n`
    guide += `Feel free to open an issue for any questions.\n`

    return guide
  }
}