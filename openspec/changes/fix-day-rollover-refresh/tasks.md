# Tasks — fix-day-rollover-refresh

Companion change closing contract gap **CG-1** (day-rollover presentation freshness, decided contract D9b of `add-real-world-user-simulation-testing`). Implementation is complete; final full-suite verification remains in the campaign plan.

## 1. Provider-level day-key watcher

- [x] 1.1 Created `core/providers/DayRolloverProvider.tsx`: a provider/hook mounted once that tracks the last-seen local calendar day via `toDateKey()`, compares it on a single app-wide interval and visibility/foreground checks, and exposes a monotonically increasing generation.
- [x] 1.2 Mounted `DayRolloverProvider` in `AppProviders` so every mounted section is a descendant; platform guards mirror existing web/native event handling.
- [x] 1.3 Kept `didLocalDayRollOver` pure and the watcher presentation-only with no DB/data-layer imports.

## 2. Section refresh consumption

- [x] 2.1 All six day-scoped section screens pass the day generation into the existing `useActiveForegroundRefresh` plumbing.
- [x] 2.2 Inactive mounted sections retain their state until activation, when the generation-aware refresh path re-reads current-day data; no section is unmounted and no test IDs were added.
- [x] 2.3 Preserved D9a; no data-layer or DB files changed.

## 3. Unit tests

- [x] 3.1 Added `tests/dayRollover.test.ts` covering boundary detection, same-day no-op behavior, monotonic transitions, and initial-baseline semantics.

## 4. Release the CG-1 quarantine

- [x] 4.1 Released `past-midnight-freshness.spec.ts` from `test.describe.fixme` with all assertions unchanged; J2b passes 4/4.
- [x] 4.2 Closed CG-1 in `docs/testing/known-gaps.md` with provider and strict-journey evidence.

## 5. Verification

- [x] 5.1 `npm run typecheck` and `npm run lint` pass with 0 errors and warnings under the existing cap.
- [x] 5.2 `npm test` passes (656 tests), including the new day-rollover unit tests.
- [x] 5.3 J2b and J2a each pass 4/4 when run in isolated Playwright processes against the fresh export; the combined invocation is not used because the module-level clock helper intentionally shares installation state across files.
