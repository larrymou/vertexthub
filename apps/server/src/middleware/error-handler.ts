// apps/server/src/middleware/error-handler.ts
// Global error handler

import { IncomingMessage, ServerResponse } from 'http'
import { AppError, RateLimitError, isOperationalError } from '@vertexhub/core/src/errors'
import { Logger } from '@vertexhub/core/src/logger'

export function createErrorHandler(logger: Logger) {
  return (error: Error, req: IncomingMessage, res: ServerResponse) => {
    if (error instanceof AppError) {
      if (!isOperationalError(error)) {
        logger.error('Non-operational error', {
          error: error.message,
          stack: error.stack,
          url: req.url,
          method: req.method,
        })
      } else {
        logger.warn('Operational error', {
          code: error.code,
          message: error.message,
          url: req.url,
        })
      }

      res.writeHead(error.statusCode, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          ...(error instanceof RateLimitError
            ? { retryAfter: error.retryAfter }
            : {}),
        },
      }))
      return
    }

    logger.error('Unexpected error', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
    })

    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
      },
    }))
  }
}
