# Design: Habit Progress Insights V1

## Context

The Habit Engine V2 domain already resolves effective-dated rules through
`getHabitRuleForDate`, builds local `DayCompletion` values with
`buildDayCompletions`, and defines current/longest streak behavior. The feature
must compose those APIs rather than reimplement weekday, creation, target, or
current-day semantics in a screen.

## Domain model

Add a pure `habitInsights.domain.ts` module. Its public calculator accepts an
active `Habit`-shaped input, ordered `HabitCompletion[]`, and an explicit
`todayKey` for deterministic tests. It first builds the complete available
history through today with `buildDayCompletions(..., undefined, ..., todayKey)`.
It then derives:

- `currentStreak` with `calculateCurrentStreak`.
- `longestStreak` with `calculateLongestStreak`.
- `totalEligibleOccurrences` and `totalCompletedOccurrences` from eligible
  scheduled days.
- `last7`, `last30`, and `last90` windows by filtering the same day list by
  local date-key bounds. This means schedule/target history is resolved once.
- `recentDays`, the last 30 date rows, preserving off-day actual counts and
  historical targets.
- `trend` by splitting the 14-day calendar slice into older/newer seven-day
  windows, reusing the same rate helper and requiring two eligible occurrences
  in both windows.

Rates are nullable when their denominator is zero. A completed occurrence means
`DayCompletion.completed`, so a target-two day with count one is not satisfied.
`todayKey` is explicit at the domain boundary; callers use `toDateKey()` so
the local timezone remains the source of truth.

Deleted habits return `null` from the calculator and are never loaded by the
active list. No new table or migration is needed.

## Data loading and list performance

Add `getAllHabitCompletions()` to `habits.data.ts` as one ordered query for the
active local completion table. The Habits screen will index those rows by
habit/date in memory for today counts and full-history streaks, while retaining
the existing 364-day range query for the heatmap. The opened progress detail
uses the existing one-query `getCompletionHistory(habitId)` API; no per-date
queries are introduced.

If a shared read returns no row for a visible habit, its count is zero and the
existing domain calculation receives an empty completion list. The completion
table is local-only and does not need sync enqueue behavior for reads.

## UI

Add a compact `Progress` button below each non-edit-mode habit item. It opens an
existing `Modal` with the habit name as title. A focused
`HabitProgressInsights` component owns loading/error state and renders:

1. A short summary for current and longest streak.
2. Three labeled rate cards with `completed / eligible` detail and an empty
   denominator message.
3. A labeled trend sentence with the two comparison rates when supported.
4. A vertically readable 30-row recent history, each row labeled with date,
   scheduled/neutral state, target, actual count, and satisfaction.

Use existing `Card`, `Button`, `Modal`, theme tokens, and NativeWind classes.
No chart dependency or global analytics dashboard is needed. Progress bars may
be used as decoration, but every row and metric gets an accessible text label.

The habit icon/color editor controls will also receive `accessibilityRole`,
descriptive labels, and `accessibilityState={{ selected }}` so the new entry
surface does not leave an adjacent core workflow inaccessible.

## Verification

- Pure domain tests cover daily, M/W/F, weekdays, weekends, creation boundary,
  target/schedule edits, target >1, current-day grace, prior miss, >30 streak,
  off-day rows, empty windows, year/leap boundaries, and explicit local date
  keys.
- Real-SQLite integration coverage proves one ordered history read contract,
  effective rule persistence, and list-equivalent batched completion data.
- Focused Playwright coverage creates a habit, opens Progress, and checks
  accessible metric/history text; no test-only selectors are added.
- Typecheck, lint, focused Vitest, `qa:affected`, web build/E2E, and the
  serialized native targeted lane are run before completion.
