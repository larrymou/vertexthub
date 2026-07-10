// apps/server/src/middleware/cors.ts
// CORS configuration

import { IncomingMessage, ServerResponse } from 'http'

export interface CorsOptions {
  origin: string | string[]
  methods: string[]
  allowedHeaders: string[]
  maxAge: number
}

const DEFAULT_OPTIONS: CorsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}

export function createCorsMiddleware(options: Partial<CorsOptions> = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const origin = req.headers.origin || '*'

    if (opts.origin === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*')
    } else if (Array.isArray(opts.origin)) {
      if (opts.origin.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
      }
    } else {
      if (opts.origin === origin) {
        res.setHeader('Access-Control-Allow-Origin', origin)
      }
    }

    res.setHeader('Access-Control-Allow-Methods', opts.methods.join(', '))
    res.setHeader('Access-Control-Allow-Headers', opts.allowedHeaders.join(', '))
    res.setHeader('Access-Control-Max-Age', opts.maxAge.toString())

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return true
    }

    return false
  }
}
