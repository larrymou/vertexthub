// packages/core/src/logger.ts
// Lightweight structured logger

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export interface LogContext {
  [key: string]: unknown
}

export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  child(context: LogContext): Logger
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = formatTimestamp()
  const base = JSON.stringify({
    timestamp,
    level,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  })
  return base
}

function createLogger(minLevel: LogLevel, defaultContext?: LogContext): Logger {
  const minLevelNum = LOG_LEVELS[minLevel]

  const log = (level: LogLevel, message: string, context?: LogContext) => {
    if (LOG_LEVELS[level] < minLevelNum) return

    const mergedContext = defaultContext
      ? { ...defaultContext, ...context }
      : context

    const formatted = formatMessage(level, message, mergedContext)

    if (level === 'error') {
      console.error(formatted)
    } else if (level === 'warn') {
      console.warn(formatted)
    } else {
      console.log(formatted)
    }
  }

  return {
    debug: (msg, ctx) => log('debug', msg, ctx),
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
    child: (context) => createLogger(minLevel, { ...defaultContext, ...context }),
  }
}

export function getLogger(level?: LogLevel): Logger {
  const envLevel = level || (process.env.LOG_LEVEL as LogLevel) || 'info'
  return createLogger(envLevel)
}
