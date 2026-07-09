// packages/connectors/src/github.ts
// GitHub Connector 实现

import { Connector, RawEvent, EntitySchema } from '@vertexhub/core'

interface GitHubConfig {
  owner: string
  repo: string
}

interface GitHubCredentials {
  token: string
}

export class GitHubConnector implements Connector {
  id: string
  name: string
  type = 'github'

  private token: string = ''
  private config: GitHubConfig = { owner: '', repo: '' }

  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }

  async authenticate(credentials: GitHubCredentials): Promise<void> {
    this.token = credentials.token
  }

  configure(config: GitHubConfig): void {
    this.config = config
  }

  async fetch(since?: Date): Promise<RawEvent[]> {
    const events: RawEvent[] = []

    // Fetch PRs
    const prs = await this.fetchPRs(since)
    events.push(...prs)

    // Fetch Issues
    const issues = await this.fetchIssues(since)
    events.push(...issues)

    // Fetch Commits
    const commits = await this.fetchCommits(since)
    events.push(...commits)

    return events
  }

  private async fetchPRs(since?: Date): Promise<RawEvent[]> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/pulls?state=all&sort=updated&direction=desc&per_page=50`
    const data = await this.githubFetch(url)

    return data.map((pr: any) => ({
      id: `gh-pr-${pr.id}`,
      connector_id: this.id,
      timestamp: new Date(pr.updated_at),
      ingested_at: new Date(),
      type: 'pull_request',
      payload: {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        merged: pr.merged_at !== null,
        author: pr.user.login,
        url: pr.html_url,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
      },
      entity_refs: [`pr-${pr.number}`],
      checksum: `pr-${pr.id}-${pr.updated_at}`,
    }))
  }

  private async fetchIssues(since?: Date): Promise<RawEvent[]> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/issues?state=all&sort=updated&direction=desc&per_page=50`
    const data = await this.githubFetch(url)

    return data
      .filter((issue: any) => !issue.pull_request) // Exclude PRs
      .map((issue: any) => ({
        id: `gh-issue-${issue.id}`,
        connector_id: this.id,
        timestamp: new Date(issue.updated_at),
        ingested_at: new Date(),
        type: 'issue',
        payload: {
          number: issue.number,
          title: issue.title,
          state: issue.state,
          author: issue.user.login,
          labels: issue.labels.map((l: any) => l.name),
          url: issue.html_url,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
        },
        entity_refs: [`issue-${issue.number}`],
        checksum: `issue-${issue.id}-${issue.updated_at}`,
      }))
  }

  private async fetchCommits(since?: Date): Promise<RawEvent[]> {
    let url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/commits?per_page=50`
    if (since) {
      url += `&since=${since.toISOString()}`
    }
    const data = await this.githubFetch(url)

    return data.map((commit: any) => ({
      id: `gh-commit-${commit.sha.substring(0, 8)}`,
      connector_id: this.id,
      timestamp: new Date(commit.commit.author.date),
      ingested_at: new Date(),
      type: 'commit',
      payload: {
        sha: commit.sha.substring(0, 8),
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author.name,
        url: commit.html_url,
      },
      entity_refs: [`commit-${commit.sha.substring(0, 8)}`],
      checksum: `commit-${commit.sha}`,
    }))
  }

  private async githubFetch(url: string): Promise<any[]> {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'VertexHub',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${this.token}`,
          'User-Agent': 'VertexHub',
        },
      })
      return response.ok
    } catch {
      return false
    }
  }

  schema(): EntitySchema {
    return {
      entity_type: 'repository',
      attributes: [
        { name: 'owner', type: 'string', required: true },
        { name: 'repo', type: 'string', required: true },
      ],
    }
  }

  capabilities(): string[] {
    return ['pull_requests', 'issues', 'commits']
  }
}
