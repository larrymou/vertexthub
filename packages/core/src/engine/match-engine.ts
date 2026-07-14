import type { Agent, AgentSkill, TaskSkill, MatchResult } from '../types'

export class MatchEngine {
  matchAgents(
    taskSkills: TaskSkill[],
    agents: Agent[],
    agentSkillsMap: Map<string, AgentSkill[]>,
  ): MatchResult[] {
    const requiredSkills = taskSkills.filter((ts) => ts.required)
    const optionalSkills = taskSkills.filter((ts) => !ts.required)

    const results: MatchResult[] = []

    for (const agent of agents) {
      const agentSkills = agentSkillsMap.get(agent.id) ?? []
      const skillMap = new Map<string, AgentSkill>()
      for (const as of agentSkills) {
        skillMap.set(as.skill_id, as)
      }

      let score = 0
      const matched_skills: string[] = []
      const missing_skills: string[] = []

      // Required skills
      for (const ts of requiredSkills) {
        const as = skillMap.get(ts.skill_id)
        if (as) {
          if (as.proficiency >= ts.min_proficiency) {
            score += 20
          } else {
            score += 5
          }
          matched_skills.push(ts.skill_id)
        } else {
          missing_skills.push(ts.skill_id)
        }
      }

      // Optional skills
      for (const ts of optionalSkills) {
        const as = skillMap.get(ts.skill_id)
        if (as && as.proficiency >= ts.min_proficiency) {
          score += 10
          matched_skills.push(ts.skill_id)
        } else if (as && as.proficiency < ts.min_proficiency) {
          score += 5
        }
      }

      // Proficiency bonus: +2 per level above min, cap +10
      let proficiencyBonus = 0
      for (const ts of taskSkills) {
        const as = skillMap.get(ts.skill_id)
        if (as && as.proficiency > ts.min_proficiency) {
          proficiencyBonus += Math.min((as.proficiency - ts.min_proficiency) * 2, 10)
        }
      }
      score += proficiencyBonus

      // Credit score weight
      score += Math.floor(agent.credit_score / 200 * 10)

      // Clamp to 0-100
      score = Math.max(0, Math.min(100, score))

      // Filter: score >= 10 AND no missing required skills
      if (score < 10) continue
      if (missing_skills.length > 0) continue

      results.push({ agent, score, matched_skills, missing_skills })
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score)

    return results
  }
}
