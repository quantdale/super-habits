## Context

See proposal.md for the motivation. Current `main` is `c1bc380`. `lib/useForegroundRefresh.ts:6-24` registers `AppState.addEventListener('change', …)` and, when `Platform.OS === 'web'`, its own `document.addEventListener('visibilitychange', …)`. react-native-web's `AppState` re-emits `change` from `visibilitychange`, so the two listeners observe the same DOM event and one web foreground invokes `onRefresh` twice. The consumers are all six section screens plus `GamificationProvider`, each through `useActiveForegroundRefresh` (`:36-51`), whose `useGuardedAsyncRefresh` guard prevents stale overwrites but not duplicated work. On the Habits surface, `features/habits/HabitsScreen.tsx:691-699` computes `activeHabits`, `scheduledTodayCount`, and `completedTodayCount` on every render with no memoization, so `activeHabits` is a fresh array identity each render; `:707-730`'s `stripDays` memo therefore recomputes every render, and each of its 7 × H iterations calls `isHabitScheduledOn` / `getHabitTargetForDate`, which parse and sort the habit's rule history (`features/habits/habits.domain.ts:81-103`). The repository's own heavy-state journey measures this path: `docs/testing/known-gaps.md` gap 15 records the CDP attribution of the section switch as harness ~31% / browser ~53% / app JS ~16% with no single app function above 2.3%.

## Goals / Non-Goals

**Goals:**

- Exactly one refresh per foreground transition per consumer, on every platform, with the rollover and activation guarantees unchanged.
- Habits derived aggregates computed once per data change, and per-habit rule history parsed once per habit per data change.
- Coverage that fails if either property regresses.

**Non-Goals:**

- Changing the refresh hook's public signature or its activation semantics.
- Restructuring the six mounted section trees, their render windows, or the permanent-mount tradeoff, which is a documented architectural decision.
- Changing any benchmark harness, fixture, ceiling, headroom floor, or timing boundary. This change is app-owned work only.
- Optimizing the other five sections' read batches, which are bounded and already measured as in-budget.

## Decisions

### 1. Gate the DOM listener on whether the platform's AppState is DOM-driven

Register the `visibilitychange` listener only when the platform's `AppState` is not already derived from that event. On web, the `AppState` listener alone is sufficient; the DOM listener is the duplicate.

Alternative: keep both listeners and deduplicate by timestamp. Rejected. It reintroduces a race for genuinely distinct events milliseconds apart and makes the hook's contract time-dependent. Alternative: always use the DOM listener and drop `AppState`. Rejected. That would break native, where there is no DOM.

### 2. Memoize on the data, not on the derived identity

Wrap `activeHabits` in `useMemo` keyed on the source list, then compute the counts from the memoized value. The existing `stripDays` memo then has a stable dependency and stops recomputing.

Alternative: leave `activeHabits` unmemoized and add a ref-based "last computed" cache. Rejected. It is the same work with more state and no benefit.

### 3. Parse rule history once per habit per data change

Build a per-habit map of the parsed rule-history value used by both `isHabitScheduledOn` and `getHabitTargetForDate`, memoized alongside the active list, and read from that map inside the day loop. The domain functions stay pure and unchanged; the screen stops calling them repeatedly with the same argument.

Alternative: memoize inside `habits.domain.ts` with a module-level cache. Rejected. A module-level cache keyed on an object argument leaks and needs invalidation; a per-render derived map is honest and cheap.

### 4. Coverage is behavioral, not a render-count assertion

Assert the observable contract: one foreground produces one refresh call per consumer (a spy on the refresh callback), and a re-render with unchanged data produces no additional rule-history parse (a counter on the parse boundary, or an equivalent observable). Do not assert on React internals such as fiber render counts.

Alternative: assert `React.Profiler` durations. Rejected. Duration assertions are timing-dependent and would be flaky on the same host this campaign already documents as noisy.

## Risks / Trade-offs

- [Dropping the DOM listener could miss a web foreground] → react-native-web's `AppState` re-emits from the same event, so the `AppState` listener alone covers it; the coverage in this change pins exactly one refresh, and a missed foreground would surface as zero.
- [Memoizing `activeHabits` changes identity semantics a consumer depends on] → The memo is keyed on the source list, so the value is referentially stable while the data is unchanged, which is strictly stronger than today's fresh identity; consumers that compare by value are unaffected.
- [A per-habit parsed map increases peak memory on the HEAVY fixture] → The map holds one parsed value per active habit (11 on the HEAVY fixture) and is rebuilt per data change, which is smaller than the per-render parse count it replaces.
- [Performance improvements are hard to verify on this host] → Verification is the behavioral coverage plus a repeated J8 run under the documented credible-host conditions, not a single noisy measurement; no threshold is claimed.

## Migration Plan

No data or schema migration. Apply order: (1) add failing coverage for the duplicated web foreground and for per-render Habits recomputation; (2) fix the refresh hook's listener registration; (3) memoize `activeHabits` and the Habits counts; (4) build the per-habit parsed map and read it in the day loop; (5) re-run the new coverage, the affected unit tests, and the timezone matrix. If a credible J8 measurement is possible after the change, run it against a fresh hermetic `dist/` and record it; if host memory is not credible, record that and leave the ceiling and floor unchanged. Rollback is a revert of the single commit.

## Open Questions

None. Both defects, their sites, and the sanctioned patterns are identified in the current tree, and the behavioral contracts are directly assertable.
