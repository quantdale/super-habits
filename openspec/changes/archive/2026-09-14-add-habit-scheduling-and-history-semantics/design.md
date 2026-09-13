## Context

The current `habits` row is the synced main entity and stores only the current target; `habit_completions` stores one local count per habit/date. The six-section shell is permanently mounted, and the working tree already contains the day-rollover provider that HabitsScreen consumes. Local dates are `toDateKey()` values, while the remote disposable schema is a manually maintained reference whose adapter currently upserts every local column with `SELECT *`.

## Goals / Non-Goals

**Goals:**

- Make schedule and target lookup a pure, centralized domain operation.
- Keep the data model small, forward-compatible with current push backup, and safe for existing rows.
- Calculate streaks over all available history while keeping the existing one-year consistency/heatmap window.
- Keep range/grid work bounded to the existing single completion query and in-memory rule resolution.
- Preserve all current linked-action and completion-row compatibility behavior.

**Non-Goals:**

- Monthly, every-N-days, pause, skip, reminder, notification, or full sync-v2 behavior.
- A separate synced completion history, event-sourcing framework, or remote pull/conflict system.
- Reinterpreting pre-migration completion date keys; the existing local-date cutover remains authoritative.

## Decisions

### 1. Embed effective rule history in the synced habit row

Add one SQLite column, `habits.rule_history TEXT NOT NULL DEFAULT '[]'`, containing a compact JSON array of records:

```json
[
  { "effective_from_date": "2026-01-01", "weekdays": [1, 2, 3, 4, 5, 6, 7], "target_per_day": 1 },
  { "effective_from_date": "2026-03-11", "weekdays": [1, 3, 5], "target_per_day": 2 }
]
```

Weekdays use ISO values 1=Monday through 7=Sunday. The array is sorted by effective date; editing again on the same local date replaces that date's rule rather than creating ambiguity. `target_per_day` remains on the row as the current/latest target for existing APIs and remote compatibility, while the rule is authoritative for historical calculations.

**Why this over a `habit_rules` table:** the main habit row is already the only synced and restored habit representation. Embedding history keeps schedule data from silently disappearing through the existing adapter and restore v1, avoids a second outbox entity, and needs one append-only local migration. A separate table would require a new remote table, remote restore contract, and coordinated sync semantics that are outside this phase.

### 2. Initialize legacy and incomplete remote rows conservatively

Migration 12 adds the column and initializes every existing habit with one every-day rule effective on `timestampToLocalDateKey(created_at)`, preserving its current target. If a remote row lacks `rule_history`, `applyRemoteHabits` applies the same fallback before insertion. Invalid or empty histories are never allowed to make a habit disappear from statistics; the domain falls back to an every-day rule from the supplied creation boundary or, for legacy test-shaped inputs without a boundary, the beginning of the requested window.

### 3. Make date semantics explicit in pure domain types

The domain exports `HabitWeekday`, `HabitRule`, rule parsing/serialization helpers, `getHabitRuleForDate`, `isHabitScheduledOn`, `getHabitTargetForDate`, and a normalized weekday/preset formatter. `DayCompletion` and `DayCell` carry `scheduled` and `eligible` flags. A date is eligible only when it is on or after the first rule's effective date, scheduled by that rule, and not in the future.

All date-key comparisons are lexicographic valid `YYYY-MM-DD` strings; weekday extraction uses a local `Date` constructed from the date key. No domain function uses UTC string slicing or database access.

### 4. Separate scheduled occurrence math from presentation

`buildDayCompletions` resolves the active rule per generated local date. `calculateCurrentStreak` walks only scheduled, eligible dates and applies grace only to an incomplete scheduled today. `calculateLongestStreak` ignores unscheduled dates and resets on scheduled misses. The UI and Overview pass each habit's rule history into these functions rather than duplicating weekday checks.

`buildHabitGrid` resolves every habit/date in one in-memory pass over the already-loaded completion rows. Consistency counts only eligible cells. The aggregate heatmap sums completed cells and scheduled eligible cells per date; a zero denominator yields neutral value 0. The grid remains 364 days and `GitHubHeatmap` continues to request 52 columns, preserving CG-6's fixed-width contract.

### 5. Remove the streak lookback cap at the data boundary

`getCompletionHistory(habitId, days?)` retains the optional bounded query for callers that need it, but no argument means all history. HabitsScreen, Overview, and command retrieval use the unbounded form for streak correctness. The one-year reporting window remains bounded for consistency and heatmap semantics.

### 6. Preserve off-day completion compatibility

Increment and linked-action effect paths continue to write completion rows without schedule mutation; this avoids breaking existing automation and makes the off-day rule explicit in the domain rather than adding a second write policy. HabitsScreen supplies `scheduledToday` to the circle: off-day cards are neutral and do not accept normal increment/decrement taps, while edit mode and linked actions remain available.

### 7. Use the existing migration/sync boundaries

The runtime schema advances append-only from v11 to v12. `core/db/schema.sql` is updated as a current reference snapshot, `simulation/backend/schema.sql` gains the matching Postgres column, and `supabase/migrations/20260810130000_add_habits_rule_history.sql` records the additive remote deployment contract. The actual Supabase project must apply the migration before backup flushes; until then, the existing adapter preserves the outbox on rejected upserts rather than falsely dropping schedule data. No new synced entity or pull path is introduced.

### 8. Test deterministic local-calendar behavior

Pure domain tests cover presets, creation/effective-date boundaries, target changes, all streak cases including >30 occurrences, consistency, heatmap neutrality, leap/year boundaries, and explicit timezone-derived local date keys. Real-SQLite integration tests cover v12 migration/rerun, rule JSON persistence, edits, remote fallback, completion compatibility, and soft deletion. Playwright uses the existing fake-clock helpers for schedule creation, off-day, scheduled-day, midnight rollover, and historical edit journeys. Simulation seeds use deterministic schedule diversity; Maestro proves Android create/terminate/relaunch persistence.

## Risks / Trade-offs

- [Risk] The live Supabase dashboard may not yet have `rule_history` → the reference schema and sync contract are updated together; rejected pushes remain queued and the plan records dashboard application as an external deployment prerequisite rather than silently claiming backup success.
- [Risk] A malformed history payload could hide a habit from reports → parsing falls back to a conservative every-day rule from creation/current window, and migration only writes valid initialized rules.
- [Risk] Full-history streak reads grow with old completion data → one bounded SQL read per habit remains the current architecture, no per-grid DB query is added, and the existing one-year grid stays bounded; an index is added only if query-plan evidence requires it.
- [Risk] Off-day rows created by automation may surprise users → they remain visible in raw completion data but are explicitly neutral in all scheduled metrics and the normal card is non-actionable.
- [Risk] JSON history creates a larger synced row → weekly edits are rare, the history is small, and this avoids a separate remote table and sync protocol.

## Migration Plan

1. Add v12 `rule_history` with a non-null empty-array default, then initialize legacy active and deleted habit rows from their local creation timestamps and existing targets.
2. On fresh and upgraded databases, verify the schema version, column, initialized history, and v12 rerun no-op against real SQLite.
3. Add the column to the disposable Supabase reference schema and commit the matching additive Supabase migration; restore fallback handles rows from older backups. Apply the migration only after the intended remote target is identified and migration status is inspected.
4. Deploy code, then apply the remote additive column before enabling production backup flushes for scheduled habits. Rollback of app code leaves the additive column harmless; rollback of the local migration is not destructive and must use a forward repair, never a downgrade/drop.

## Open Questions

None. The remote dashboard is not observable from this workstation, so its application is recorded as a deployment prerequisite and the disposable reference lane is updated for validation.
