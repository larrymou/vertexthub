// apps/server/src/middleware/validator.ts
// Input validation utilities

import { ValidationError } from '@vertexhub/core/src/errors'

export interface ValidationSchema {
  [field: string]: {
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required?: boolean
    min?: number
    max?: number
    pattern?: RegExp
    enum?: readonly (string | number)[]
    custom?: (value: any) => boolean | string
  }
}

export function validate(data: Record<string, any>, schema: ValidationSchema): void {
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field]

    if (rules.required && (value === undefined || value === null || value === '')) {
      throw new ValidationError(`Field '${field}' is required`, field)
    }

    if (value === undefined || value === null) continue

    if (rules.type) {
      if (rules.type === 'array') {
        if (!Array.isArray(value)) {
          throw new ValidationError(`Field '${field}' must be an array`, field)
        }
      } else if (typeof value !== rules.type) {
        throw new ValidationError(`Field '${field}' must be of type ${rules.type}`, field)
      }
    }

    if (rules.min !== undefined && typeof value === 'string' && value.length < rules.min) {
      throw new ValidationError(`Field '${field}' must be at least ${rules.min} characters`, field)
    }

    if (rules.max !== undefined && typeof value === 'string' && value.length > rules.max) {
      throw new ValidationError(`Field '${field}' must be at most ${rules.max} characters`, field)
    }

    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      throw new ValidationError(`Field '${field}' format is invalid`, field)
    }

    if (rules.enum && !rules.enum.includes(value)) {
      throw new ValidationError(`Field '${field}' must be one of: ${rules.enum.join(', ')}`, field)
    }

    if (rules.custom) {
      const result = rules.custom(value)
      if (result === false) {
        throw new ValidationError(`Field '${field}' is invalid`, field)
      } else if (typeof result === 'string') {
        throw new ValidationError(result, field)
      }
    }
  }
}

export function parseJsonBody(body: string): Record<string, any> {
  try {
    return JSON.parse(body)
  } catch {
    throw new ValidationError('Invalid JSON body')
  }
}

export function validateQueryParams(
  params: URLSearchParams,
  schema: Record<string, { type?: 'string' | 'number' | 'boolean'; required?: boolean }>
): Record<string, any> {
  const result: Record<string, any> = {}

  for (const [field, rules] of Object.entries(schema)) {
    const value = params.get(field)

    if (rules.required && !value) {
      throw new ValidationError(`Query parameter '${field}' is required`, field)
    }

    if (!value) continue

    if (rules.type === 'number') {
      const num = Number(value)
      if (isNaN(num)) {
        throw new ValidationError(`Query parameter '${field}' must be a number`, field)
      }
      result[field] = num
    } else if (rules.type === 'boolean') {
      result[field] = value === 'true'
    } else {
      result[field] = value
    }
  }

  return result
}
