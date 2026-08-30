## Why

Super Habits already records useful work across tasks, habits, focus, workouts,
nutrition, and planning, but that effort remains split across feature-specific
metrics and the isolated Focus sprout. The Warm Momentum roadmap calls for one
cross-product living-progress artifact now that the day-oriented Overview,
Progress, Activity Timeline, planning, and Gym V2 foundations are in place.

## What Changes

- Add a derived Momentum Garden feature that reconstructs bounded Today and
  recent-week growth directly from authoritative feature data.
- Define transparent, domain-separated contribution semantics for completed
  todos, scheduled habit completions, completed focus sessions, completed
  workouts, nutrition tracking days, daily-plan/reflection activity, weekly
  reviews, and supported goal/project milestones.
- Add an accessible, theme-aware native SVG Garden visual with static and
  reduced-motion variants, plus textual contribution summaries and neutral
  zero/inactivity states.
- Add a compact Today Garden surface to Overview while preserving the existing
  Next Best Action, Today progress, card customization, and planning access.
- Add a deeper Garden view inside the existing Planning/Progress surface with
  bounded recent history and source explanations; do not add a primary tab.
- Keep the representation deterministic, offline-first, read-only, bounded,
  and reconstructable after reload or backup restore without a new table,
  event ledger, sync entity, or remote service.
- Add pure domain, read-model, integration-contract, and focused web journey
  coverage for empty, single-domain, multi-domain, date-boundary, inactivity,
  accessibility, reduced-motion, reload, and non-mutation behavior.

## Capabilities

### New Capabilities

- `momentum-garden`: Derived cross-domain Garden models, transparent contribution
  semantics, Today/recent views, accessible visual presentation, and bounded
  Progress integration.

### Modified Capabilities

- None.

## Impact

- New `features/momentum/` domain, read-model, types, and visual components.
- Read-only coordination with existing todos, habits, pomodoro, workout,
  calories, daily-plan, weekly-review, goals/projects, and Activity/Progress
  data APIs; no persistence or schema migration.
- Overview and Planning Hub/Progress presentation changes, plus focused Vitest,
  SQLite integration, and Playwright journey coverage.
- Existing theme/motion/accessibility primitives and the Focus sprout may gain
  small reusable visual helpers, with Pomodoro behavior preserved.
- No new dependency, Supabase table, backup entity, sync queue record, or
  portable-export field.
