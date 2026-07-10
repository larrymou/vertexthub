// packages/core/src/errors.ts
// Custom error class hierarchy

export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly timestamp: string

  constructor(message: string, code: string, statusCode: number, isOperational = true) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.timestamp = new Date().toISOString()
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
    }
  }
}

export class ValidationError extends AppError {
  public readonly field?: string

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400)
    this.field = field
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} with id '${id}' not found` : `${resource} not found`
    super(msg, 'NOT_FOUND', 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500, false)
  }
}

export class ConnectorError extends AppError {
  public readonly connectorId: string

  constructor(message: string, connectorId: string) {
    super(message, 'CONNECTOR_ERROR', 502)
    this.connectorId = connectorId
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number

  constructor(retryAfter: number) {
    super('Too many requests', 'RATE_LIMIT_EXCEEDED', 429)
    this.retryAfter = retryAfter
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 500, false)
  }
}

export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational
  }
  return false
}
