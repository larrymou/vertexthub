#!/usr/bin/env node

// packages/sdk/templates/generate.js
// VertexHub Connector 模板生成器 CLI

const fs = require('fs')
const path = require('path')
const { ConnectorGenerator } = require('../dist/generator')

// 解析命令行参数
const args = process.argv.slice(2)
const command = args[0]
const name = args[1]
const template = args[2] || 'basic'

// 显示帮助
function showHelp() {
  console.log(`
VertexHub Connector Generator

Usage:
  vertexhub-connector generate <name> [template]

Commands:
  generate <name> [template]  Generate a new connector
  list                       List available templates
  help                       Show this help message

Templates:
  basic    - Basic connector template (default)
  api      - API connector with HTTP client
  webhook  - Webhook connector with event handling

Examples:
  vertexhub-connector generate slack
  vertexhub-connector generate jira api
  vertexhub-connector list
`)
}

// 列出可用模板
function listTemplates() {
  const generator = new ConnectorGenerator()
  const templates = generator.listTemplates()

  console.log('Available templates:\n')
  for (const template of templates) {
    console.log(`  ${template.name} - ${template.description}`)
  }
}

// 生成连接器
function generateConnector(name, templateName) {
  if (!name) {
    console.error('Error: Connector name is required')
    process.exit(1)
  }

  const generator = new ConnectorGenerator()

  try {
    const result = generator.generate(name, templateName)
    const outputDir = path.join(process.cwd(), name)

    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // 写入文件
    for (const file of result.files) {
      const filePath = path.join(outputDir, file.path)
      const fileDir = path.dirname(filePath)

      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true })
      }

      fs.writeFileSync(filePath, file.content)
      console.log(`Created: ${file.path}`)
    }

    console.log(`\nConnector "${name}" generated successfully!`)
    console.log(`\nNext steps:`)
    console.log(`  1. cd ${name}`)
    console.log(`  2. Install dependencies: npm install`)
    console.log(`  3. Implement your connector logic`)
    console.log(`  4. Add tests`)
    console.log(`  5. Submit a pull request`)
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

// 主函数
function main() {
  switch (command) {
    case 'generate':
      generateConnector(name, template)
      break
    case 'list':
      listTemplates()
      break
    case 'help':
    case '--help':
    case '-h':
      showHelp()
      break
    default:
      if (command) {
        console.error(`Unknown command: ${command}`)
        console.error('Run "vertexhub-connector help" for usage information')
        process.exit(1)
      } else {
        showHelp()
      }
  }
}

main()