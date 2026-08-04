## Why

`add-real-world-user-simulation-testing` defined the decided day-rollover contract, CG-1 (**D9b** in its design): a mounted surface must never label a stale day "Today". When the local calendar day changes while the app is open, the **active** section refreshes its day-scoped data, and **inactive** mounted sections are marked stale so they refresh on activation rather than rendering yesterday's numbers from memory.

Today the app does not satisfy that contract. All six sections live in one React tree (`app/index.tsx`), are created lazily and never unmounted, and hold day-scoped data (date-keyed lists, streaks, Overview day aggregates) in state captured at mount. `useActiveForegroundRefresh(isActive, …)` refreshes on `isActive` transitions and on `visibilitychange`/`AppState` foreground — and a midnight tick is neither. Leave the app open past midnight and the "Today" panel is yesterday; a habit ticked at 00:10 lands in the database on the new day while the UI still renders a "Today" that the database disagrees with. The write half of the contract (D9a) already holds; this change fixes the presentation half.

The regression for this contract already exists, written to the decided contract and quarantined: `J2b past-midnight-freshness.spec.ts` (`test.fixme()`), tracked as contract gap **CG-1** in `docs/testing/known-gaps.md`. This change releases that quarantine.

## What Changes

- Add a **provider-level day-key watcher**: a single component or hook mounted once (in `AppProviders`, alongside `NavigationProvider` / theme) that tracks the last-seen local calendar day via `toDateKey()` from `lib/time.ts`, and detects a rollover by comparing against the current key on an interval and on `visibilitychange` (a `visibilitychange`-plus-timeout comparison, per the shape already recommended in the parent design).
- The watcher **bumps a context value the sections already consume for refresh** — e.g. a `DayRolloverContext` with a monotonically increasing "day generation" number — without adding new per-section listeners. Sections that already re-trigger their refresh on context change get the new signal for free.
- On rollover, the **active section refreshes** its day-scoped data immediately; **inactive mounted sections mark themselves stale**, so they re-read on activation instead of rendering held values. No section is unmounted.
- Preserve the existing behaviour everywhere else: writes keep deriving their day key from `toDateKey()` at call time (D9a is asserted as a passing invariant in `J2a` and must not regress), and rows written before the boundary keep their original keys.
- **Release CG-1's quarantine**: remove the `test.fixme()` from `e2e/journeys/J2b past-midnight-freshness.spec.ts` and remove the CG-1 entry's quarantine status from `docs/testing/known-gaps.md`. The gap is closed by this change, not weakened.

## Capabilities

### New Capabilities

- `day-rollover-refresh`: a mounted surface never labels a stale day "Today" — the active section refreshes its day-scoped data when the local calendar day changes while the app is open, and inactive mounted sections refresh on activation rather than rendering captured state.

### Modified Capabilities

- None. This is a provider-level presentation fix; no prior capability spec changes. The write-correctness half of the day-rollover contract (D9a) is unchanged and remains asserted as a passing invariant.

## Impact

- **New files**: a day-rollover provider/hook (e.g. `core/providers/DayRolloverProvider.tsx` or similar) and possibly a context module; wiring into `AppProviders`.
- **Modified files**: `AppProviders` bootstrap (mount the watcher), consumption points where sections register their refresh trigger (minimal — the context replacement reuses the existing refresh path), `e2e/journeys/J2b*` (remove quarantine).
- **No schema/migration impact**: no SQLite or `app_meta` changes; the watcher is presentation-only.
- **Feels-like impact**: none for a user who never leaves the app open across midnight; the fix shows the correct day for the (very common) rollover case.
- **Testing**: the previously-quarantined `J2b` journey becomes a passing regression test; `J2a` continues to assert write correctness. Unit coverage lives with the provider's day-key comparison logic if any is extracted as a pure function.
- **Follow-up changes**: none anticipated; this closes CG-1.