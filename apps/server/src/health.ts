// apps/server/src/health.ts
// Enhanced health check and system metrics

import { Database } from 'better-sqlite3'
import { Logger } from '@vertexhub/core/src/logger'

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  uptime: number
  timestamp: string
  checks: Record<string, CheckResult>
  system: SystemMetrics
}

export interface CheckResult {
  status: 'pass' | 'fail' | 'warn'
  message?: string
  duration?: number
}

export interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage
  cpuUsage: NodeJS.CpuUsage
  dbSize?: number
}

const startTime = Date.now()
const VERSION = process.env.npm_package_version || '0.1.0'

export function createHealthChecker(db: Database, logger: Logger) {
  const checkDatabase = (): CheckResult => {
    try {
      const start = Date.now()
      db.prepare('SELECT 1').get()
      const duration = Date.now() - start
      return { status: duration < 100 ? 'pass' : 'warn', duration }
    } catch (error) {
      return { status: 'fail', message: 'Database connection failed' }
    }
  }

  const getDbSize = (): number | undefined => {
    try {
      const result = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get() as { size: number } | undefined
      return result?.size
    } catch {
      return undefined
    }
  }

  const getSystemMetrics = (): SystemMetrics => {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      dbSize: getDbSize(),
    }
  }

  const getHealth = async (): Promise<HealthStatus> => {
    const dbCheck = checkDatabase()
    const checks = { database: dbCheck }
    const allPass = Object.values(checks).every(c => c.status === 'pass')
    const anyFail = Object.values(checks).some(c => c.status === 'fail')

    return {
      status: anyFail ? 'unhealthy' : allPass ? 'healthy' : 'degraded',
      version: VERSION,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks,
      system: getSystemMetrics(),
    }
  }

  return { getHealth, getSystemMetrics }
}
