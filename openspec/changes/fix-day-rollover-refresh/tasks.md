# Tasks — fix-day-rollover-refresh

Companion change closing contract gap **CG-1** (day-rollover presentation freshness, decided contract D9b of `add-real-world-user-simulation-testing`). None of this work has been done yet.

## 1. Provider-level day-key watcher

- [ ] 1.1 Create `core/providers/DayRolloverProvider.tsx`: a provider/hook mounted once that tracks the last-seen local calendar day via `toDateKey()` from `lib/time.ts`, compares it against the current key on an interval (e.g. 30s) and on a `visibilitychange`-plus-timeout comparison (web; `AppState` equivalent on native), and exposes a `DayRolloverContext` whose value is a monotonically increasing "day generation" number.
- [ ] 1.2 Mount `DayRolloverProvider` in `AppProviders` (`core/providers/AppProviders.tsx`, inside `ThemeProvider` / alongside `InAppNoticeProvider`) so every mounted section is a descendant and receives the bump without any new per-section listeners; mirror the existing platform guards (`Platform.OS === 'web'`, `document`) used by the sync-flush visibility listener.
- [ ] 1.3 If the day-key comparison is extracted as a pure function (e.g. `detectDayRollover(previousKey, currentKey)` in the provider module or `lib/time.ts`), keep it side-effect free so it is unit-testable; keep the watcher itself presentation-only (no DB, no data-layer imports).

## 2. Section refresh consumption

- [ ] 2.1 Make the day-scoped sections (at minimum `features/calories/CaloriesScreen.tsx` and `features/habits/HabitsScreen.tsx`, plus Todos/Overview/Pomodoro/Workout as applicable) re-trigger their existing refresh path on a day-generation change — the **active** section refreshes immediately on rollover. Prefer reusing the existing `useActiveForegroundRefresh`/refresh plumbing (`lib/useForegroundRefresh.ts`, `isActive` from `NavigationContext.activeSection`) rather than adding new refresh machinery.
- [ ] 2.2 Ensure **inactive** mounted sections mark themselves stale on rollover so they re-read on activation instead of rendering held values; no section is unmounted, and no `data-testid` attributes are added.
- [ ] 2.3 Preserve the write half (D9a): data-layer writes keep deriving their day key from `toDateKey()` at call time and rows written before the boundary keep their original keys — no changes to any `*.data.ts` file or to `core/db/`.

## 3. Unit tests

- [ ] 3.1 Add Vitest coverage for the new day-key comparison logic (repo convention: `tests/*.test.ts`, e.g. `tests/dayRollover.test.ts`): a rollover across a day boundary bumps the generation; same-day ticks / non-rollover visibility changes do not; generation is monotonic; initial mount seeds the baseline without a spurious bump.

## 4. Release the CG-1 quarantine

- [ ] 4.1 In `e2e/journeys/past-midnight-freshness.spec.ts`, remove the `test.describe.fixme` quarantine wrapper (restore `test.describe`), update the file-header comment that describes the quarantined state, and keep every assertion exactly as written — step 3's `Today: 0 kcal` visible / `Today: 410 kcal` absent, and step 4's `ringLabel(0)` plus the `habit_completions` row oracle. No assertions are weakened.
- [ ] 4.2 In `docs/testing/known-gaps.md`, resolve the CG-1 entry: mark the gap closed by this change (per the register's resolution-note convention) while keeping the decided-contract wording intact.

## 5. Verification

- [ ] 5.1 `npm run typecheck` and `npm run lint` clean (warnings under the existing cap).
- [ ] 5.2 `npm test` passes, including the new day-rollover unit tests.
- [ ] 5.3 Run the journeys lane covering the release: `e2e/journeys/past-midnight-freshness.spec.ts` (J2b, now un-quarantined) passes, and `e2e/journeys/past-midnight-writes.spec.ts` (J2a, write half) still passes — e.g. via `npm run e2e:journeys:p0` and/or the full `npm run e2e` journeys project (J2b is @p0-tagged, TZ/clock-based, not dist-sync bound).
