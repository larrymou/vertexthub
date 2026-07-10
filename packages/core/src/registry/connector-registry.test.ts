// packages/core/src/registry/connector-registry.test.ts
// Connector Registry 测试

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ConnectorRegistry,
  ConnectorMetadata,
  ConnectorNotFoundError,
  VersionConflictError,
  InvalidVersionError,
} from './connector-registry'
import { Connector, RawEvent, EntitySchema } from '../types'

// Mock Connector
class MockConnector implements Connector {
  id: string
  name: string
  type: string

  constructor(id: string, name: string, type: string = 'mock') {
    this.id = id
    this.name = name
    this.type = type
  }

  async authenticate(credentials: any): Promise<void> {}

  async fetch(config: any): Promise<RawEvent[]> {
    return []
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  schema(): EntitySchema {
    return { entity_type: 'test', attributes: [] }
  }

  capabilities(): string[] {
    return ['test']
  }
}

// Mock Metadata
const mockMetadata: ConnectorMetadata = {
  author: 'Test Author',
  description: 'Test connector for unit testing',
  tags: ['test', 'mock'],
  entity_schemas: [],
  capabilities: ['read', 'write'],
}

describe('ConnectorRegistry', () => {
  let registry: ConnectorRegistry

  beforeEach(() => {
    registry = new ConnectorRegistry()
  })

  describe('register', () => {
    it('should register a connector with default version', () => {
      const connector = new MockConnector('github', 'GitHub Connector')
      const result = registry.register('github', connector, mockMetadata)

      expect(result.id).toBe('github')
      expect(result.name).toBe('GitHub Connector')
      expect(result.version).toBe('1.0.0')
      expect(result.connector).toBe(connector)
      expect(result.metadata).toBe(mockMetadata)
    })

    it('should register a connector with custom version', () => {
      const connector = new MockConnector('github', 'GitHub Connector')
      const result = registry.register('github', connector, mockMetadata, '2.0.0')

      expect(result.version).toBe('2.0.0')
    })

    it('should throw InvalidVersionError for invalid version', () => {
      const connector = new MockConnector('github', 'GitHub Connector')

      expect(() => registry.register('github', connector, mockMetadata, '1.0')).toThrow(
        InvalidVersionError
      )
      expect(() => registry.register('github', connector, mockMetadata, 'v1.0.0')).toThrow(
        InvalidVersionError
      )
    })

    it('should throw VersionConflictError for duplicate version', () => {
      const connector1 = new MockConnector('github', 'GitHub Connector')
      const connector2 = new MockConnector('github', 'GitHub Connector v2')

      registry.register('github', connector1, mockMetadata, '1.0.0')
      expect(() => registry.register('github', connector2, mockMetadata, '1.0.0')).toThrow(
        VersionConflictError
      )
    })
  })

  describe('update', () => {
    it('should update an existing connector version', () => {
      const connector1 = new MockConnector('github', 'GitHub Connector')
      const connector2 = new MockConnector('github', 'GitHub Connector Updated')

      registry.register('github', connector1, mockMetadata, '1.0.0')
      const result = registry.update('github', connector2, mockMetadata, '1.0.0')

      expect(result.connector).toBe(connector2)
    })

    it('should add a new version when updating', () => {
      const connector1 = new MockConnector('github', 'GitHub Connector')
      const connector2 = new MockConnector('github', 'GitHub Connector v2')

      registry.register('github', connector1, mockMetadata, '1.0.0')
      const result = registry.update('github', connector2, mockMetadata, '2.0.0')

      expect(result.version).toBe('2.0.0')

      const versions = registry.getVersions('github')
      expect(versions).toHaveLength(2)
    })

    it('should throw ConnectorNotFoundError for non-existent connector', () => {
      const connector = new MockConnector('github', 'GitHub Connector')

      expect(() => registry.update('github', connector, mockMetadata, '1.0.0')).toThrow(
        ConnectorNotFoundError
      )
    })
  })

  describe('get', () => {
    it('should get the latest version by default', () => {
      const connector1 = new MockConnector('github', 'GitHub Connector v1')
      const connector2 = new MockConnector('github', 'GitHub Connector v2')

      registry.register('github', connector1, mockMetadata, '1.0.0')
      registry.register('github', connector2, mockMetadata, '2.0.0')

      const result = registry.get('github')
      expect(result?.version).toBe('2.0.0')
      expect(result?.connector).toBe(connector2)
    })

    it('should get a specific version', () => {
      const connector1 = new MockConnector('github', 'GitHub Connector v1')
      const connector2 = new MockConnector('github', 'GitHub Connector v2')

      registry.register('github', connector1, mockMetadata, '1.0.0')
      registry.register('github', connector2, mockMetadata, '2.0.0')

      const result = registry.get('github', '1.0.0')
      expect(result?.version).toBe('1.0.0')
      expect(result?.connector).toBe(connector1)
    })

    it('should return null for non-existent connector', () => {
      const result = registry.get('nonexistent')
      expect(result).toBeNull()
    })

    it('should return null for non-existent version', () => {
      const connector = new MockConnector('github', 'GitHub Connector')
      registry.register('github', connector, mockMetadata, '1.0.0')

      const result = registry.get('github', '2.0.0')
      expect(result).toBeNull()
    })
  })

  describe('getVersions', () => {
    it('should return versions sorted by semver descending', () => {
      const connector1 = new MockConnector('github', 'GitHub Connector')
      const connector2 = new MockConnector('github', 'GitHub Connector')

      registry.register('github', connector1, mockMetadata, '1.0.0')
      registry.register('github', connector2, mockMetadata, '2.0.0')

      const versions = registry.getVersions('github')
      expect(versions).toHaveLength(2)
      expect(versions[0].version).toBe('2.0.0')
      expect(versions[1].version).toBe('1.0.0')
    })

    it('should return empty array for non-existent connector', () => {
      const versions = registry.getVersions('nonexistent')
      expect(versions).toHaveLength(0)
    })
  })

  describe('search', () => {
    it('should search by type', () => {
      const github = new MockConnector('github', 'GitHub', 'scm')
      const jira = new MockConnector('jira', 'Jira', 'project-management')
      const linear = new MockConnector('linear', 'Linear', 'project-management')

      registry.register('github', github, mockMetadata)
      registry.register('jira', jira, mockMetadata)
      registry.register('linear', linear, mockMetadata)

      const results = registry.search({ type: 'project-management' })
      expect(results).toHaveLength(2)
    })

    it('should search by tag', () => {
      const connector1 = new MockConnector('github', 'GitHub')
      const connector2 = new MockConnector('jira', 'Jira')

      const metadata1: ConnectorMetadata = { ...mockMetadata, tags: ['scm', 'popular'] }
      const metadata2: ConnectorMetadata = { ...mockMetadata, tags: ['project-management'] }

      registry.register('github', connector1, metadata1)
      registry.register('jira', connector2, metadata2)

      const results = registry.search({ tag: 'popular' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('github')
    })

    it('should search by capability', () => {
      const connector1 = new MockConnector('github', 'GitHub')
      const connector2 = new MockConnector('jira', 'Jira')

      const metadata1: ConnectorMetadata = { ...mockMetadata, capabilities: ['read', 'write'] }
      const metadata2: ConnectorMetadata = { ...mockMetadata, capabilities: ['read'] }

      registry.register('github', connector1, metadata1)
      registry.register('jira', connector2, metadata2)

      const results = registry.search({ capability: 'write' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('github')
    })

    it('should exclude deprecated by default', () => {
      const connector1 = new MockConnector('github', 'GitHub')
      const connector2 = new MockConnector('jira', 'Jira')

      registry.register('github', connector1, mockMetadata)
      registry.register('jira', connector2, mockMetadata)

      registry.deprecate('github', '1.0.0')

      const results = registry.search({})
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('jira')
    })

    it('should include deprecated when specified', () => {
      const connector1 = new MockConnector('github', 'GitHub')
      const connector2 = new MockConnector('jira', 'Jira')

      registry.register('github', connector1, mockMetadata)
      registry.register('jira', connector2, mockMetadata)

      registry.deprecate('github', '1.0.0')

      const results = registry.search({ include_deprecated: true })
      expect(results).toHaveLength(2)
    })

    it('should search by specific version', () => {
      const connector1 = new MockConnector('github', 'GitHub v1')
      const connector2 = new MockConnector('github', 'GitHub v2')

      registry.register('github', connector1, mockMetadata, '1.0.0')
      registry.register('github', connector2, mockMetadata, '2.0.0')

      const results = registry.search({ version: '1.0.0' })
      expect(results).toHaveLength(1)
      expect(results[0].version).toBe('1.0.0')
    })
  })

  describe('deprecate', () => {
    it('should deprecate a connector version', () => {
      const connector = new MockConnector('github', 'GitHub')
      registry.register('github', connector, mockMetadata, '1.0.0')

      registry.deprecate('github', '1.0.0')

      const versions = registry.getVersions('github')
      expect(versions[0].deprecated).toBe(true)
    })

    it('should update latest version when latest is deprecated', () => {
      const connector1 = new MockConnector('github', 'GitHub v1')
      const connector2 = new MockConnector('github', 'GitHub v2')

      registry.register('github', connector1, mockMetadata, '1.0.0')
      registry.register('github', connector2, mockMetadata, '2.0.0')

      registry.deprecate('github', '2.0.0')

      const latest = registry.get('github')
      expect(latest?.version).toBe('1.0.0')
    })

    it('should handle deprecating all versions', () => {
      const connector = new MockConnector('github', 'GitHub')
      registry.register('github', connector, mockMetadata, '1.0.0')

      registry.deprecate('github', '1.0.0')

      const latest = registry.get('github')
      expect(latest).toBeNull()
    })

    it('should throw ConnectorNotFoundError for non-existent connector', () => {
      expect(() => registry.deprecate('nonexistent', '1.0.0')).toThrow(ConnectorNotFoundError)
    })
  })

  describe('remove', () => {
    it('should remove a specific version', () => {
      const connector1 = new MockConnector('github', 'GitHub v1')
      const connector2 = new MockConnector('github', 'GitHub v2')

      registry.register('github', connector1, mockMetadata, '1.0.0')
      registry.register('github', connector2, mockMetadata, '2.0.0')

      const removed = registry.remove('github', '1.0.0')
      expect(removed).toBe(true)

      const versions = registry.getVersions('github')
      expect(versions).toHaveLength(1)
      expect(versions[0].version).toBe('2.0.0')
    })

    it('should remove all versions when version not specified', () => {
      const connector = new MockConnector('github', 'GitHub')
      registry.register('github', connector, mockMetadata)

      const removed = registry.remove('github')
      expect(removed).toBe(true)

      const result = registry.get('github')
      expect(result).toBeNull()
    })

    it('should return false for non-existent connector', () => {
      const removed = registry.remove('nonexistent')
      expect(removed).toBe(false)
    })
  })

  describe('list', () => {
    it('should list all registered connectors', () => {
      const github = new MockConnector('github', 'GitHub')
      const jira = new MockConnector('jira', 'Jira')

      registry.register('github', github, mockMetadata)
      registry.register('jira', jira, mockMetadata)

      const list = registry.list()
      expect(list).toHaveLength(2)
    })
  })

  describe('stats', () => {
    it('should return correct statistics', () => {
      const github = new MockConnector('github', 'GitHub', 'scm')
      const jira = new MockConnector('jira', 'Jira', 'project-management')

      const githubMeta: ConnectorMetadata = {
        ...mockMetadata,
        capabilities: ['read', 'write'],
      }
      const jiraMeta: ConnectorMetadata = {
        ...mockMetadata,
        capabilities: ['read'],
      }

      registry.register('github', github, githubMeta, '1.0.0')
      registry.register('github', github, githubMeta, '2.0.0')
      registry.register('jira', jira, jiraMeta, '1.0.0')

      const stats = registry.stats()
      expect(stats.total_connectors).toBe(2)
      expect(stats.total_versions).toBe(3)
      expect(stats.types).toEqual({ scm: 1, 'project-management': 1 })
      expect(stats.capabilities).toEqual({ read: 2, write: 1 })
    })
  })

  describe('clear', () => {
    it('should clear the registry', () => {
      const connector = new MockConnector('github', 'GitHub')
      registry.register('github', connector, mockMetadata)

      registry.clear()

      const list = registry.list()
      expect(list).toHaveLength(0)
    })
  })
})
