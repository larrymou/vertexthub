// packages/sdk/src/generator.ts
// VertexHub Connector SDK 模板生成器

import { ConnectorTemplate, TemplateFile } from './types'
import { toPascalCase, toKebabCase, generateClassName, generateInterfaceName } from './utils'

// ═══════════════════════════════════════════════════════════════
// 模板生成器类
// ═══════════════════════════════════════════════════════════════

export class ConnectorGenerator {
  private templates: Map<string, ConnectorTemplate> = new Map()

  constructor() {
    this.registerDefaultTemplates()
  }

  // 注册默认模板
  private registerDefaultTemplates(): void {
    this.templates.set('basic', this.createBasicTemplate())
    this.templates.set('api', this.createApiTemplate())
    this.templates.set('webhook', this.createWebhookTemplate())
  }

  // 生成连接器
  generate(name: string, template: string = 'basic'): ConnectorTemplate {
    const templateObj = this.templates.get(template)
    if (!templateObj) {
      throw new Error(`Template "${template}" not found`)
    }

    const className = generateClassName(name)
    const interfaceName = generateInterfaceName(name)
    const fileName = toKebabCase(name)

    const files: TemplateFile[] = templateObj.files.map(file => ({
      path: file.path
        .replace(/\{\{name\}\}/g, fileName)
        .replace(/\{\{className\}\}/g, className)
        .replace(/\{\{interfaceName\}\}/g, interfaceName)
        .replace(/\{\{pascalName\}\}/g, toPascalCase(name)),
      content: file.content
        .replace(/\{\{name\}\}/g, fileName)
        .replace(/\{\{className\}\}/g, className)
        .replace(/\{\{interfaceName\}\}/g, interfaceName)
        .replace(/\{\{pascalName\}\}/g, toPascalCase(name))
        .replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]),
    }))

    return {
      name,
      description: `${toPascalCase(name)} Connector for VertexHub`,
      files,
    }
  }

  // 列出可用模板
  listTemplates(): Array<{ name: string; description: string }> {
    return Array.from(this.templates.entries()).map(([name, template]) => ({
      name,
      description: template.description,
    }))
  }

  // 注册自定义模板
  registerTemplate(name: string, template: ConnectorTemplate): void {
    this.templates.set(name, template)
  }

  // 创建基础模板
  private createBasicTemplate(): ConnectorTemplate {
    return {
      name: 'basic',
      description: 'Basic connector template with minimal functionality',
      files: [
        {
          path: '{{name}}.ts',
          content: `// {{name}}.ts
// {{pascalName}} Connector 实现

import { Connector, RawEvent, EntitySchema } from '@vertexhub/core'
import { BaseConnector } from '@vertexhub/sdk'

interface {{interfaceName}} {
  // 添加配置属性
}

interface {{pascalName}}Credentials {
  // 添加凭证属性
}

export class {{className}} extends BaseConnector {
  id: string
  name: string
  type = '{{name}}'

  private credentials: {{pascalName}}Credentials = {}
  private config: {{interfaceName}} = {}

  constructor(id: string, name: string) {
    super()
    this.id = id
    this.name = name
  }

  async authenticate(credentials: {{pascalName}}Credentials): Promise<void> {
    this.credentials = credentials
  }

  configure(config: {{interfaceName}}): void {
    this.config = config
  }

  async fetch(since?: Date): Promise<RawEvent[]> {
    const events: RawEvent[] = []

    // TODO: 实现数据获取逻辑

    return events
  }

  async healthCheck(): Promise<boolean> {
    try {
      // TODO: 实现健康检查逻辑
      return true
    } catch {
      return false
    }
  }

  schema(): EntitySchema {
    return {
      entity_type: '{{name}}',
      attributes: [
        // TODO: 定义实体属性
      ],
    }
  }

  capabilities(): string[] {
    return [
      // TODO: 定义连接器能力
    ]
  }
}
`,
        },
        {
          path: '{{name}}.test.ts',
          content: `// {{name}}.test.ts
// {{pascalName}} Connector 测试

import { describe, it, expect, beforeEach } from 'vitest'
import { {{className}} } from './{{name}}'

describe('{{className}}', () => {
  let connector: {{className}}

  beforeEach(() => {
    connector = new {{className}}('test-{{name}}', 'Test {{pascalName}}')
  })

  it('should create instance', () => {
    expect(connector).toBeInstanceOf({{className}})
    expect(connector.id).toBe('test-{{name}}')
    expect(connector.name).toBe('Test {{pascalName}}')
    expect(connector.type).toBe('{{name}}')
  })

  it('should authenticate', async () => {
    await expect(connector.authenticate({})).resolves.toBeUndefined()
  })

  it('should fetch events', async () => {
    const events = await connector.fetch()
    expect(Array.isArray(events)).toBe(true)
  })

  it('should check health', async () => {
    const healthy = await connector.healthCheck()
    expect(typeof healthy).toBe('boolean')
  })

  it('should return schema', () => {
    const schema = connector.schema()
    expect(schema.entity_type).toBe('{{name}}')
    expect(Array.isArray(schema.attributes)).toBe(true)
  })

  it('should return capabilities', () => {
    const capabilities = connector.capabilities()
    expect(Array.isArray(capabilities)).toBe(true)
  })
})
`,
        },
        {
          path: 'manifest.json',
          content: `{
  "metadata": {
    "id": "{{name}}",
    "name": "{{pascalName}} Connector",
    "version": "0.1.0",
    "description": "{{pascalName}} Connector for VertexHub",
    "author": "Your Name",
    "license": "MIT",
    "keywords": ["{{name}}", "connector"],
    "minCoreVersion": "0.1.0"
  },
  "config": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "credentials": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "capabilities": [],
  "events": []
}
`,
        },
        {
          path: 'README.md',
          content: `# {{pascalName}} Connector

{{pascalName}} Connector for VertexHub.

## Installation

\`\`\`bash
npm install @vertexhub/{{name}}-connector
\`\`\`

## Configuration

### Credentials

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| | | | |

### Config

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| | | | | |

## Usage

\`\`\`typescript
import { {{className}} } from '@vertexhub/{{name}}-connector'

const connector = new {{className}}('my-{{name}}', 'My {{pascalName}}')

await connector.authenticate({
  // credentials
})

const events = await connector.fetch()
\`\`\`

## Capabilities

- 

## Events

### 

| Property | Type | Description |
|----------|------|-------------|
| | | |

## Development

### Build

\`\`\`bash
npm run build
\`\`\`

### Test

\`\`\`bash
npm test
\`\`\`

## License

MIT
`,
        },
      ],
    }
  }

  // 创建 API 模板
  private createApiTemplate(): ConnectorTemplate {
    const basicTemplate = this.createBasicTemplate()
    return {
      name: 'api',
      description: 'API connector template with HTTP client setup',
      files: basicTemplate.files.map(file => {
        if (file.path.endsWith('.ts') && !file.path.endsWith('.test.ts')) {
          return {
            ...file,
            content: file.content.replace(
              '// TODO: 实现数据获取逻辑',
              `// HTTP 请求示例
    const response = await fetch('https://api.example.com/data', {
      headers: {
        'Authorization': \`Bearer \${this.credentials.token}\`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(\`API error: \${response.status} \${response.statusText}\`)
    }

    const data = await response.json()

    // 转换为 RawEvent 格式
    return data.map((item: any) => this.createEvent({
      id: this.generateEventId('{{name}}', item.id),
      type: 'data',
      payload: item,
      entityRefs: [\`\${item.id}\`],
    }))`
            ),
          }
        }
        return file
      }),
    }
  }

  // 创建 Webhook 模板
  private createWebhookTemplate(): ConnectorTemplate {
    const basicTemplate = this.createBasicTemplate()
    return {
      name: 'webhook',
      description: 'Webhook connector template with event handling',
      files: basicTemplate.files.map(file => {
        if (file.path.endsWith('.ts') && !file.path.endsWith('.test.ts')) {
          return {
            ...file,
            content: file.content.replace(
              '// TODO: 实现数据获取逻辑',
              `// Webhook 处理示例
    // Webhook 连接器通常由外部事件触发
    // 这里提供一个模拟的事件处理方法
    return []`
            ),
          }
        }
        return file
      }),
    }
  }
}