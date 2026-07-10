// packages/core/src/config.ts
// Environment variable validation

import { ConfigError } from './errors'

export interface AppConfig {
  PORT: number
  DB_PATH: string
  NODE_ENV: 'development' | 'production' | 'test'
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
  CORS_ORIGIN: string
  RATE_LIMIT_WINDOW_MS: number
  RATE_LIMIT_MAX_REQUESTS: number
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`)
  }
  return value
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

function optionalInt(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new ConfigError(`Invalid integer for ${name}: ${value}`)
  }
  return parsed
}

export function loadConfig(): AppConfig {
  const nodeEnv = optional('NODE_ENV', 'development')
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new ConfigError(`Invalid NODE_ENV: ${nodeEnv}`)
  }

  const logLevel = optional('LOG_LEVEL', 'info')
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    throw new ConfigError(`Invalid LOG_LEVEL: ${logLevel}`)
  }

  return {
    PORT: optionalInt('PORT', 3000),
    DB_PATH: optional('DB_PATH', './data/vertexhub.db'),
    NODE_ENV: nodeEnv as AppConfig['NODE_ENV'],
    LOG_LEVEL: logLevel as AppConfig['LOG_LEVEL'],
    CORS_ORIGIN: optional('CORS_ORIGIN', '*'),
    RATE_LIMIT_WINDOW_MS: optionalInt('RATE_LIMIT_WINDOW_MS', 60000),
    RATE_LIMIT_MAX_REQUESTS: optionalInt('RATE_LIMIT_MAX_REQUESTS', 100),
  }
}
