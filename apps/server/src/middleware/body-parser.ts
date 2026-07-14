import { IncomingMessage } from 'http'
import { ValidationError } from '@vertexhub/core/src/errors'

const MAX_BODY_SIZE = 1024 * 1024

export function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
      resolve({})
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_SIZE) {
        reject(new ValidationError('Request body too large (max 1MB)'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8')
      if (!body) { resolve({}); return }
      try { resolve(JSON.parse(body)) } catch { reject(new ValidationError('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}
