import { IncomingMessage, ServerResponse } from 'http'

export interface AuthOptions {
  apiKey?: string
  publicPaths: string[]
}

export function createAuthMiddleware(options: AuthOptions) {
  const { apiKey, publicPaths } = options
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    if (!apiKey) return false
    const url = new URL(req.url || '/', 'http://localhost')
    if (publicPaths.some(p => url.pathname === p || url.pathname.startsWith(p))) return false
    const providedKey = req.headers['x-api-key'] as string | undefined
    if (providedKey !== apiKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } }))
      return true
    }
    return false
  }
}
