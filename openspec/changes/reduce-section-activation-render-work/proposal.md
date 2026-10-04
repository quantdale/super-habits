## Why

The section-activation and foreground-refresh paths are the measured hot path for the J8 section-switch budget, and two defects on that path are app-owned rather than harness-owned. `lib/useForegroundRefresh.ts` registers both an `AppState` "active" listener and its own `visibilitychange` listener; on web, react-native-web's `AppState` is itself driven by the same DOM event, so a single foreground fires both handlers and every mounted screen's refresh callback runs twice, doubling its query and aggregate batch. Separately, the Habits screen derives its active-habit list and counts on every render rather than memoizing them, so the `stripDays` memo — whose dependency is that fresh array identity — recomputes on every render, and each recomputation re-parses rule history per habit per day. Neither defect changes behavior; both add unbounded per-render work on the path the budget measures.

## What Changes

- Deduplicate the foreground refresh so one foreground transition triggers exactly one refresh per mounted consumer, on every platform, without weakening the rollover or activation guarantees.
- Memoize the Habits screen's derived active-habit list and its scheduled/completed counts so they are computed once per data change rather than once per render, and hoist per-habit rule-history parsing out of the per-day loop.
- Add coverage that a single web foreground triggers exactly one refresh per consumer, and that a Habits re-render with unchanged data performs no additional rule-history parsing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `day-rollover-refresh`: Add a requirement that one foreground transition triggers exactly one refresh per mounted consumer, so the rollover contract is preserved without duplicated work on web.
- `reliability-heavy-state-completion`: Add a requirement that a mounted section's derived screen state is memoized against its data, so activating or re-rendering a section does not recompute derived state the budget measures.

## Impact

Touches `lib/useForegroundRefresh.ts`, `features/habits/HabitsScreen.tsx`, and their tests. No schema change, no migration, no change to any section's data contract, refresh timing, or rollover semantics, and no change to any benchmark harness, fixture, or ceiling. Applying it removes duplicated query batches on every web foreground and removes per-render recomputation on the Habits surface; both are app-owned costs on the measured path, and neither is a threshold change.
