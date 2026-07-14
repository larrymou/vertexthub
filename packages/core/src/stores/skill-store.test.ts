import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SqliteSkillStore } from './skill-store'

describe('SqliteSkillStore', () => {
  let db: Database.Database
  let store: SqliteSkillStore

  beforeEach(() => {
    db = new Database(':memory:')
    store = new SqliteSkillStore(db)
  })

  const createSkillData = (overrides: Record<string, any> = {}) => ({
    name: 'typescript',
    display_name: 'TypeScript',
    category: 'programming',
    description: 'TypeScript language',
    parent_id: null,
    ...overrides,
  })

  describe('create', () => {
    it('generates id, sets timestamps, and persists all fields', async () => {
      const skill = await store.create(createSkillData())
      expect(skill.id).toBeDefined()
      expect(skill.name).toBe('typescript')
      expect(skill.display_name).toBe('TypeScript')
      expect(skill.category).toBe('programming')
      expect(skill.description).toBe('TypeScript language')
      expect(skill.parent_id).toBeNull()
      expect(skill.created_at).toBeInstanceOf(Date)
      expect(skill.updated_at).toBeInstanceOf(Date)
    })
  })

  describe('get', () => {
    it('returns the skill by id', async () => {
      const created = await store.create(createSkillData())
      const fetched = await store.get(created.id)
      expect(fetched).toEqual(created)
    })

    it('returns null for missing id', async () => {
      expect(await store.get('nonexistent')).toBeNull()
    })
  })

  describe('getByName', () => {
    it('returns the skill by name', async () => {
      const created = await store.create(createSkillData())
      const fetched = await store.getByName('typescript')
      expect(fetched).toEqual(created)
    })

    it('returns null for missing name', async () => {
      expect(await store.getByName('nonexistent')).toBeNull()
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      await store.create(createSkillData({ name: 'ts', display_name: 'TypeScript', category: 'programming' }))
      await store.create(createSkillData({ name: 'py', display_name: 'Python', category: 'programming' }))
      await store.create(createSkillData({ name: 'pm', display_name: 'Project Management', category: 'management' }))
    })

    it('returns all skills', async () => {
      const skills = await store.list()
      expect(skills).toHaveLength(3)
    })

    it('filters by category', async () => {
      const skills = await store.list({ category: 'programming' })
      expect(skills).toHaveLength(2)
    })

    it('filters by search on name', async () => {
      const skills = await store.list({ search: 'py' })
      expect(skills).toHaveLength(1)
      expect(skills[0].name).toBe('py')
    })

    it('filters by search on display_name', async () => {
      const skills = await store.list({ search: 'Project' })
      expect(skills).toHaveLength(1)
      expect(skills[0].display_name).toBe('Project Management')
    })

    it('respects limit', async () => {
      const skills = await store.list({ limit: 2 })
      expect(skills).toHaveLength(2)
    })
  })

  describe('update', () => {
    it('updates specified fields', async () => {
      const skill = await store.create(createSkillData())
      const updated = await store.update(skill.id, { display_name: 'TS' })
      expect(updated.display_name).toBe('TS')
      expect(updated.name).toBe('typescript')
    })

    it('throws for missing skill', async () => {
      await expect(store.update('nonexistent', { name: 'x' })).rejects.toThrow('Skill nonexistent not found')
    })
  })

  describe('delete', () => {
    it('removes the skill and related associations', async () => {
      const skill = await store.create(createSkillData())
      await store.addAgentSkill('a1', skill.id, 5)
      await store.addTaskSkill('t1', skill.id, 3, true)
      await store.delete(skill.id)
      expect(await store.get(skill.id)).toBeNull()
      expect(await store.getAgentSkills('a1')).toHaveLength(0)
      expect(await store.getTaskSkills('t1')).toHaveLength(0)
    })
  })

  describe('agent-skill CRUD', () => {
    it('adds and retrieves agent skills', async () => {
      const skill = await store.create(createSkillData())
      const as = await store.addAgentSkill('agent1', skill.id, 7)
      expect(as.agent_id).toBe('agent1')
      expect(as.skill_id).toBe(skill.id)
      expect(as.proficiency).toBe(7)
      expect(as.verified).toBe(false)

      const skills = await store.getAgentSkills('agent1')
      expect(skills).toHaveLength(1)
    })

    it('upserts on duplicate agent_id + skill_id', async () => {
      const skill = await store.create(createSkillData())
      await store.addAgentSkill('agent1', skill.id, 5)
      await store.addAgentSkill('agent1', skill.id, 9)
      const skills = await store.getAgentSkills('agent1')
      expect(skills).toHaveLength(1)
      expect(skills[0].proficiency).toBe(9)
    })

    it('removes agent skill', async () => {
      const skill = await store.create(createSkillData())
      await store.addAgentSkill('agent1', skill.id, 5)
      await store.removeAgentSkill('agent1', skill.id)
      expect(await store.getAgentSkills('agent1')).toHaveLength(0)
    })

    it('updates proficiency', async () => {
      const skill = await store.create(createSkillData())
      await store.addAgentSkill('agent1', skill.id, 5)
      const updated = await store.updateProficiency('agent1', skill.id, 8)
      expect(updated.proficiency).toBe(8)
    })

    it('throws on updateProficiency for missing pair', async () => {
      await expect(store.updateProficiency('a', 's', 5)).rejects.toThrow('AgentSkill (a, s) not found')
    })
  })

  describe('task-skill CRUD', () => {
    it('adds and retrieves task skills', async () => {
      const skill = await store.create(createSkillData())
      const ts = await store.addTaskSkill('task1', skill.id, 4, true)
      expect(ts.task_id).toBe('task1')
      expect(ts.skill_id).toBe(skill.id)
      expect(ts.min_proficiency).toBe(4)
      expect(ts.required).toBe(true)

      const skills = await store.getTaskSkills('task1')
      expect(skills).toHaveLength(1)
    })

    it('upserts on duplicate task_id + skill_id', async () => {
      const skill = await store.create(createSkillData())
      await store.addTaskSkill('task1', skill.id, 3, false)
      await store.addTaskSkill('task1', skill.id, 7, true)
      const skills = await store.getTaskSkills('task1')
      expect(skills).toHaveLength(1)
      expect(skills[0].min_proficiency).toBe(7)
      expect(skills[0].required).toBe(true)
    })

    it('removes task skill', async () => {
      const skill = await store.create(createSkillData())
      await store.addTaskSkill('task1', skill.id, 3, false)
      await store.removeTaskSkill('task1', skill.id)
      expect(await store.getTaskSkills('task1')).toHaveLength(0)
    })
  })

  describe('stats', () => {
    it('returns total, by_category, and top_skills', async () => {
      const s1 = await store.create(createSkillData({ name: 'ts', category: 'programming' }))
      const s2 = await store.create(createSkillData({ name: 'py', category: 'programming' }))
      await store.create(createSkillData({ name: 'pm', category: 'management' }))

      await store.addAgentSkill('a1', s1.id, 5)
      await store.addAgentSkill('a2', s1.id, 5)
      await store.addAgentSkill('a1', s2.id, 5)

      const stats = await store.stats()
      expect(stats.total).toBe(3)
      expect(stats.by_category).toEqual({ programming: 2, management: 1 })
      expect(stats.top_skills).toHaveLength(3)
      expect(stats.top_skills[0].skill_id).toBe(s1.id)
      expect(stats.top_skills[0].agent_count).toBe(2)
    })
  })
})
