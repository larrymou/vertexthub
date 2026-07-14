// apps/server/src/middleware/request-logger.ts
// Request logging middleware

import { IncomingMessage, ServerResponse } from 'http'
import { Logger } from '@vertexhub/core/src/logger'

export function createRequestLogger(logger: Logger) {
  return (req: IncomingMessage, res: ServerResponse, startTime: number) => {
    res.on('finish', () => {
      const duration = Date.now() - startTime
      const statusCode = res.statusCode || 200

      const logContext = {
        method: req.method,
        url: req.url,
        statusCode,
        duration,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }

      if (statusCode >= 500) {
        logger.error(`${req.method} ${req.url} ${statusCode} ${duration}ms`, logContext)
      } else if (statusCode >= 400) {
        logger.warn(`${req.method} ${req.url} ${statusCode} ${duration}ms`, logContext)
      } else {
        logger.info(`${req.method} ${req.url} ${statusCode} ${duration}ms`, logContext)
      }
    })
  }
}
