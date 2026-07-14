# Dashboard Redesign Spec

## [S1] Overview

Add 3 operational tabs to existing dashboard (Tasks, Agents, Skills), keeping existing 3 read-only tabs (Report, Insights, Entities). Total: 6 tabs.

Design system: reuse existing CSS variables, card pattern, badge pattern, btn pattern. No new dependencies.

## [S2] Tasks Tab — Task Operations Console

Features:
- Status filter bar: All / Open / In Progress / Review / Done
- Task cards with: title, priority badge, type badge, status badge, assignee, deadline
- Action buttons per card based on status (claim/start/submit/approve/reject/cancel)
- Create task form (modal or inline): title, description, priority, type, deadline
- Stats bar: total, by_status counts

State-to-action mapping:
- open → [Claim]
- assigned (user=assignee) → [Start]
- in_progress (user=assignee) → [Submit for Review]
- review (user=creator) → [Approve] [Reject]
- revision (user=assignee) → [Resubmit]

## [S3] Agents Tab

Features:
- Agent cards: name, type badge, credit score bar, skills list, task stats
- Stats bar: total, by_type, avg_credit

## [S4] Skills Tab

Features:
- Skill list: name, category badge, agent count
- Category filter bar
- Match test: select task → show ranked agent results

## [S5] File Map

| File | Changes |
|------|---------|
| `apps/web/src/App.tsx` | Add Task/Agent/Skill interfaces, 3 new tab components, update tab nav |
| `apps/web/src/styles.css` | Add styles for task cards, agent cards, skill list, match results, forms |
