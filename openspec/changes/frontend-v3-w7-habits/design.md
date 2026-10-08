## Context

See `proposal.md` for why. The live screen is `features/habits/HabitsScreen.tsx` (about 1,650 lines). It already loads completions once, parses rule history once, and gates writes with `isHabitActionableOn`. The circular grid, global edit mode, per-row Progress pill, and "Today's rhythm" wall are presentation. `incrementHabit` / `decrementHabit`, linked-action notices, and `shouldAwardHabitFastPath` are the write contract and must stay.

Rendered truth at W6.5 still shows SYS-12: Habit 5's `0/99` is red because `HabitCircle` paints the count in `habit.color`, and the visual-audit palette includes `#ef4444`. That is identity color misread as failure, not a separate threshold function.

Parent campaign tasks 7.1–7.3 live in `frontend-v3-calm-momentum`. This change is the implementation slice.

## Goals / Non-Goals

**Goals:**

- One check-in interaction for a binary habit, and a safe increment plus discoverable decrement for a quantitative habit.
- A pure check-in view-model so date, schedule, lifecycle, and color semantics are unit-tested without rendering the screen.
- One detail surface for history, insights, and lifecycle. One secondary trends entry for the aggregate heatmap.
- Selector updates that preserve behavioral oracles.

**Non-Goals:**

- No schema migration, no change to completion-row uniqueness, no sync/backup scope change.
- No rewrite of the habit editor's domain validation, reminder scheduling, or linked-action engine.
- No W8 Focus work, no Android certification, no production Supabase mutation.
- No new third analytics modal.

## Decisions

### D1. View-model owns row semantics

Add a pure `buildHabitCheckInModel` next to the existing screen derivations. For each displayed habit and the selected date it returns: date-specific target, count, actionable flag, reason when not actionable (`unscheduled`, `before_creation`, `paused`, `archived`, `masked`), binary vs quantitative, completion state (`not_started`, `in_progress`, `complete`), current streak as a labeled aggregate, and tertiary schedule/reminder text.

The screen renders that model. It does not re-derive targets from `habit.target_per_day` when a historical rule differs.

Alternative considered: keep derivations inline in `HabitsScreen`. Rejected because the screen is already the defect source and the date/target bugs are easiest to pin in pure tests.

### D2. Two control grammars, one write API

- Target 1: the leading control is a checkbox. Incomplete calls `incrementHabit`. Complete calls `decrementHabit`. That is undo, not a new boolean column.
- Target > 1: the leading control is a button, "Add one {name}, {count} of {target}". A separate "Remove one {name}" button is visible whenever count > 0 and is always exposed as an accessibility action. At count 0, decrement is a disabled explained action in the detail surface rather than a persistent minus on every untouched row.
- The row body opens details. It does not also check in.

Alternative considered: always show a minus and plus stepper. Rejected because that recreates the five-treatment pile. Alternative considered: long-press-only decrement. Rejected because decrement would not be discoverable.

### D3. Selected-date summary is a different fact from today's summary

`summarizeHabitsForDate` uses `isHabitActionableOn` and `getHabitTargetForDate`, not the current target column and not schedule-only. The visible line is "N of M done today" or "N of M done on {date}". Rest days say nothing is scheduled for that named date. Streak text says "Current streak".

`summarizeHabitsToday` currently ignores lifecycle masks and historical targets. The new selected-date helper replaces it for the visible summary. Today remains the special case of that helper when the selected key is today, so the existing "today denominator excludes off-day habits" scenario still holds.

### D4. Semantic tone, not identity color

A pure tone helper returns neutral, accent, complete, inactive, or danger. Danger is only for a failed write or a destructive confirm. Habit identity color may tint a small icon. It must not color a zero count. Completion uses a check icon plus a "Complete" or "Done" label, not green alone.

### D5. One detail surface, trends demoted

Compose the existing detail heatmap and `calculateHabitProgressInsights` into the current detail modal as Today / Progress / Settings. Retire the separate insights modal entry and the per-row Progress pill. Move the aggregate ring, best streak, consistency, and `HabitsOverviewGrid` behind one "Trends" control. Do not leave the old wall under the list.

Global edit mode goes away. Header actions are Add and Filter. Lifecycle actions move into Settings on the detail surface. The editor modal itself stays.

### D6. List owns scrolling when the dataset is large

The check-in list uses FlashList v2 with flattened group/header items, matching the repository convention. `Screen` holds the summary, day strip, and filter affordance outside the scrolling list with a 720px content cap. Empty groups are omitted. No eagerly mapped rows inside a parent `ScrollView`; 50+ habits do not mount the analytics wall or a per-habit history query.

Query rule: one shared completion load feeds list, detail calendar and insight content. Detail reads the refreshed parent snapshot, not a second overlapping history query. HEAVY120 habits/10800 completions mounts25 rows and meets the existing800ms warm activation/check-in ceilings.

### D7. Reference lock

Primary: Not Boring Habits list density and Joi/Structured day-list check control (one control, quiet separators, completion is a state not a card). Borrowed: Atoms detail heatmap as the reflection centerpiece, not the daily screen. Roots streak ladder stays off the daily screen. Rejected: circular grids, per-habit progress rings, saturated group slabs, persistent steppers, analytics walls, all-caps display type, and copying any reference wholesale.

## Risks / Trade-offs

- [E2E and Maestro still say "Add anytime habit" / "Enter habit edit mode" / "View progress for"] → Update selectors to Add habit, the row details route, and detail delete. Do not weaken SQL oracles.
- [Removing the Progress pill violates the archived insights spec] → The delta spec makes the details route the progress entry and keeps the metric announcements.
- [Selected-date summary changes today's denominator if lifecycle masks were previously ignored] → Pin both behaviors in unit tests. Masked dates must not count as scheduled misses.
- [Virtualized list inside the existing `Screen` scroll nests virtualization] → Habits content owns scroll; `Screen` does not also scroll the list.
- [Quantitative undo hidden at count 0] → Decrement is a no-op at 0. The detail surface still exposes the disabled action with an explanation so it is discoverable.
- [Wide layouts tempt a return to the circle grid] → Keep the same list. A secondary trends column is allowed at ≥1024 only if the check-in column stays list-first.

## Migration Plan

No data migration. Rollback is reverting the presentation commit; completion rows and outbox intents are unchanged. Ship as normal branch commits and a PR. Do not force-push.

## Open Questions

None that change the spec. Exact row height is measured after render and corrected if simple rows fall outside about 48–64pt.
