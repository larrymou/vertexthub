// apps/server/src/middleware/rate-limiter.ts
// Token bucket rate limiter

import { IncomingMessage, ServerResponse } from 'http'

interface RateLimitEntry {
  count: number
  resetTime: number
}

export interface RateLimiterOptions {
  windowMs: number
  maxRequests: number
  keyGenerator?: (req: IncomingMessage) => string
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimitEntry>()
  const { windowMs, maxRequests } = options

  const keyGenerator = options.keyGenerator || ((req: IncomingMessage) => {
    return req.headers['x-forwarded-for'] as string ||
           req.socket.remoteAddress ||
           'unknown'
  })

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetTime <= now) {
        store.delete(key)
      }
    }
  }, windowMs)

  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const key = keyGenerator(req)
    const now = Date.now()

    let entry = store.get(key)
    if (!entry || entry.resetTime <= now) {
      entry = { count: 0, resetTime: now + windowMs }
      store.set(key, entry)
    }

    entry.count++

    const remaining = Math.max(0, maxRequests - entry.count)
    const resetSeconds = Math.ceil((entry.resetTime - now) / 1000)

    res.setHeader('X-RateLimit-Limit', maxRequests.toString())
    res.setHeader('X-RateLimit-Remaining', remaining.toString())
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString())

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds.toString())
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'Too many requests',
        retryAfter: resetSeconds,
      }))
      return true
    }

    return false
  }
}
