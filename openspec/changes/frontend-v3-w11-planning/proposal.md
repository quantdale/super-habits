---
schema: spec-driven
created: 2026-10-13
---

## Why

W10.5 is merged. Frontend V3 parent tasks §11 owns Planning, Goals, Projects
and Daily Plan. The baseline still leads with multiple visible filter/sort rows,
oversized ornamental bullets, monolithic metadata strings and early exposure of
secondary fields. Daily Plan presents notes, focus target, reflection, energy,
history and all pending priority candidates in a continuous form on initial
render. These compete with the actual objective and next action.

## What Changes

- Common presentation grammar across Goals and Projects: objective name,
  readable status, contextual next-action, target date (when present), and
  progress with a consistent slim bar where meaningful.
- Compact list-first surfaces and a shared optional "Filters & sort" disclosure:
  default action is browse/open/create, not configuring filters.
- Goal and Project details begin with the objective and progress; advanced
  attributes and associations are progressively disclosed without changing
  persistence or status semantics. Existing field labels remain available when
  expanded.
- Daily Plan prioritizes intention, selected top priorities, and save/commit;
  candidate search is revealed on demand, planning extras and end-of-day
  reflection are opt-in sections. Preserve existing draft arbitration, plan
  state transitions and carry-forward behavior.
- Keep Today briefing and guided planner mounted/persisted without duplicate
  primary calls to action or gratuitous novelty.
- Add targeted structural and journey regressions, baseline/after rendered
  evidence where a browser capture environment is available, and reconcile
  the parent V3 campaign record.

## Impact

- `features/planning-hub/`, `features/goals/*View.tsx`,
  `features/projects/*View.tsx`, `features/daily-plan/DailyPlanView.tsx`,
  new `features/planning-hub/PlanningSummaryRow.tsx` if useful.
- E2E planning journeys, structural regressions, reference/evidence ledger.
- No schema, migration, domain math, data-layer, sync, backup, Supabase,
  dependency, security-audit policy, or navigation change.
