export interface AIProvider {
  id: string
  name: string
  complete(prompt: string, options?: CompleteOptions): Promise<string>
  embed(text: string): Promise<number[]>
  models(): string[]
  maxContextLength(): number
}

export interface CompleteOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export class OllamaProvider implements AIProvider {
  id = 'ollama'
  name = 'Ollama (Local)'
  private baseUrl: string
  constructor(baseUrl: string = 'http://localhost:11434') { this.baseUrl = baseUrl }
  async complete(prompt: string, options?: CompleteOptions): Promise<string> {
    const r = await fetch(this.baseUrl + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: options?.model || 'llama3', prompt, system: options?.systemPrompt, stream: false }) })
    if (!r.ok) throw new Error('Ollama error: ' + r.status)
    return (await r.json()).response
  }
  async embed(text: string): Promise<number[]> {
    const r = await fetch(this.baseUrl + '/api/embeddings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }) })
    if (!r.ok) throw new Error('Ollama embed error: ' + r.status)
    return (await r.json()).embedding
  }
  models(): string[] { return ['llama3', 'mistral'] }
  maxContextLength(): number { return 4096 }
}

export class MockAIProvider implements AIProvider {
  id = 'mock'
  name = 'Mock AI'
  async complete(prompt: string): Promise<string> { return 'Mock: ' + prompt.substring(0, 50) }
  async embed(text: string): Promise<number[]> { return Array.from({ length: 384 }, () => Math.random()) }
  models(): string[] { return ['mock'] }
  maxContextLength(): number { return 4096 }
}
