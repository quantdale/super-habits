## Why

The Habits screen still answers "how decorated is each habit?" instead of "did I complete what is scheduled today, and what should I check in next?" Rendered truth at `d29c67b` (W6.5 captures and the live source) shows a circular 92px grid, five competing state treatments, a permanently expanded filter stack, a screen-wide analytics wall, and neutral `0/99` progress painted in a habit's identity red. W7 reconstructs the daily experience without restarting Calm Momentum or weakening habit domain rules.

## What Changes

- Replace the circular habit grid with a flat daily check-in list. One row anatomy: completion control, name, one secondary progress or current-streak fact, and tertiary schedule/reminder text only when it changes the action.
- Keep `incrementHabit` / `decrementHabit` and `habit_completions` as the write contract. Binary rows check in or undo through those functions. Quantitative rows increment quickly and keep a discoverable decrement. Neither path becomes a silent boolean rewrite.
- Derive actionability, targets, and selected-date progress from the existing schedule, rule-history, creation-boundary, and lifecycle authorities. A selected historical day must not display today's numerator against that day's denominator. Past-day writes must not take the today XP fast path.
- Collapse status and sort into one filter sheet. Keep the seven-day strip as secondary context. Render time-of-day groups as quiet labels and omit empty groups.
- Stop painting not-started or in-progress counts as danger. Danger is reserved for a failed write or a destructive confirm.
- Remove the per-row Progress pill and the screen-wide "Today's rhythm" wall. Route each habit into one existing detail surface (Today / Progress / Settings) and keep aggregate trends behind one secondary entry. Do not add a third analytics modal.
- Remove the global edit-mode grid. Edit, pause, archive, restore, and delete stay reachable from the habit's own detail surface.
- Update affected E2E, Maestro, and simulation selectors to the new semantic contracts without weakening persistence, schedule, linked-action, reminder, or XP assertions.

## Capabilities

### New Capabilities

- `habits-daily-check-in`: the observable daily Habits check-in contract — row anatomy, date-scoped summary, quantitative controls, quiet groups, semantic progress color, and where analytics live.

### Modified Capabilities

- `habit-progress-insights`: the per-habit progress entry is the row's details route, not a persistent Progress pill; the opened surface still exposes the existing schedule-aware metrics.
- `habit-scheduling-and-history-semantics`: a selected non-today summary is labeled for that date and must not reuse today's scheduled/completed counts; unscheduled, masked, and pre-creation dates stay non-actionable.
- `ui-ux-interaction-density-a11y`: the Habits status selector remains the shared single-select control, but it may live in the filter sheet instead of a permanently expanded stack, and it stays visually distinct from the day strip and sort choices.

## Impact

- `features/habits/HabitsScreen.tsx` and habit presentation components (`HabitCircle`, `HabitDetailModal`, `HabitProgressInsightsModal`, `HabitsOverviewGrid`, `ProgressRing` consumers).
- Pure derivations in `features/habits/habitsScreen.derivations.ts` and/or a new check-in view-model beside `habits.domain.ts`. No change to `incrementHabit` / `decrementHabit` semantics, sync enqueue, or schema.
- `docs/ui-ux/14-v3-reference-ledger.md`, `docs/ui-ux/15-v3-defect-ledger.md`, and `docs/ui-ux/v3-audit/w7/`.
- E2E/Maestro/simulation selectors that currently depend on "Add anytime habit", "Enter habit edit mode", "View progress for …", and "Today's rhythm".
- Parent campaign `openspec/changes/frontend-v3-calm-momentum` remains the wave tracker; this change is the W7 implementation slice. No production Supabase, security-policy, or iOS mutation.
