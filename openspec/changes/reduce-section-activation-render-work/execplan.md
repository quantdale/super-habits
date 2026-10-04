# ExecPlan: Reduce section-activation render work

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Apply the [reduce-section-activation-render-work OpenSpec change](proposal.md)
and its [tasks](tasks.md): one foreground transition produces exactly one refresh
per mounted consumer on every platform, and the Habits surface derives its active
list, today counts, and day strip once per data change instead of once per render.
Both are app-owned costs on the measured J8 section-switch hot path; no threshold,
ceiling, floor, or harness is touched.

## Context

- Starting HEAD `c1bc380ce330cda1e089fd79b49a12029defbb72` on `main`, with three
  earlier changes from this wave already applied on top of it.
- `lib/useForegroundRefresh.ts` registered an `AppState` "change" listener and,
  on web, its own `visibilitychange` listener. react-native-web's `AppState`
  re-emits `change` from that same DOM event, so one web foreground invoked
  `onRefresh` twice — for all six mounted section screens and
  `GamificationProvider` alike. `useGuardedAsyncRefresh` prevented stale
  overwrites, not duplicated work.
- `features/habits/HabitsScreen.tsx` computed `activeHabits`,
  `scheduledTodayCount`, `completedTodayCount` on every render with no
  memoization, so `activeHabits` was a fresh array identity each render and the
  `stripDays` memo (which depended on it) recomputed every render, re-parsing
  each habit's rule history for every one of the strip's 7 days.
- The repository has no component-render test library (unit tests mock
  `react-native` to `Platform` only) and `CLAUDE.md` limits component rendering
  tests, so both contracts had to be made executable without a renderer. The
  established convention for this is a pure factory module beside the hook
  (`lib/useGuardedAsyncRefresh.ts` + `tests/useGuardedAsyncRefresh.test.ts`).

## Scope

The three task groups in tasks.md: one refresh per foreground (1.1-1.4),
memoized Habits derived state (2.1-2.5), and validation (3.1-3.7).

## Non-Goals

No change to the refresh hook's public signature or its activation semantics. No
restructuring of the six mounted section trees or the permanent-mount tradeoff.
No change to any benchmark harness, fixture, ceiling, headroom floor, or timing
boundary. No optimization of the other five sections' read batches.

## Current Checkpoint

- Current milestone: COMPLETE — all 16 tasks in tasks.md are checked, each backed
  by code and executing coverage, with the validation gate recorded from the
  final tree.
- Completed: the listener registration moved into
  `lib/foregroundListeners.ts` and the DOM listener is now registered only when
  the platform's `AppState` is not already DOM-driven; the Habits derivations
  moved into `features/habits/habitsScreen.derivations.ts` and are memoized on
  the data.
- In progress: none.
- Important modified files: `lib/foregroundListeners.ts` (new),
  `lib/useForegroundRefresh.ts`, `features/habits/habitsScreen.derivations.ts`
  (new), `features/habits/HabitsScreen.tsx`, and two test files.
- Last successful validation: pinned Node `v22.23.2` — `npm run qa:fast` green
  (typecheck 0, lint 0/0, unit 161 files / 1973 tests, both parity scripts OK);
  `npm run qa:integration` 79 files / 386 tests passed, 1 file / 2 tests skipped
  (pre-existing); `npm run qa:timezones` 5 zones; J8 7/7 green twice with
  recorded numbers; the day-rollover freshness journey 4/4; `openspec validate
--all` 68/68.
- Current failures: none attributable to this change.
- Relevant quarantines: none — no test weakened, skipped, or relaxed, and no
  ceiling, floor, harness, or fixture touched.
- Blockers: none.
- Condition required to unblock: not applicable.
- Exact resume action after unblock: not applicable.
- Exact next action: none — the change is fully applied. Archiving into
  `openspec/specs/` and committing the tree are separate, user-invoked steps.
- Remaining definition of done: complete.

## Progress

- [x] Wave 0 — confirm both defect surfaces and the sanctioned patterns.
- [x] Wave 1 — listener registration extracted and gated (1.2) with coverage for
      the web, DOM-driven, non-DOM-driven, hidden, background, native, and
      cleanup cases (1.1, 1.3).
- [x] Wave 2 — the activation/rollover signal kept independent of the
      deduplicated listeners, with coverage (1.4).
- [x] Wave 3 — Habits derivations extracted to a pure module (2.1, 2.2, 2.4) and
      memoized on the data (2.3).
- [x] Wave 4 — value coverage for the counts, the strip, the retarget rule, and
      the parse boundary (2.5).
- [x] Wave 5 — validation gate and full-diff review (3.1-3.7).

## Surprises & Discoveries

- The rendered Habits behaviour is fully covered by pure extraction: the day
  strip, the today counts, and the rest-day progress are all deterministic
  functions of `(habits, counts, today)`, so no renderer is needed to pin them —
  and the reference day is now an injectable input, which also makes the strip
  deterministic under a seeded corpus.
- The completion definition is asymmetric by design: the today counts compare
  against `habit.target_per_day`, while the day strip compares against
  `getHabitTargetForDate(history, dateKey, …)`. The extraction preserves both
  exactly; a test would have silently "fixed" the asymmetry and changed visible
  numbers, so it is pinned instead (see the retarget-rule test).
- Registering the DOM listener behind `!appStateIsDomDriven` leaves it registered
  on no platform that exists today (only web has a `document`, and there
  `AppState` is DOM-driven). That is intentional and covered: the non-DOM-driven
  branch is exercised directly in the unit test, so the code path cannot rot
  unnoticed.
- Host memory during the J8 measurements was 2.78 GB free of 31.73 GB — better
  than the 0.57-1.57 GB recorded in known-gaps gap 15 as "not credible", so the
  numbers are recorded as measured rather than classified `ENVIRONMENT`, with the
  exact host state recorded beside them.

## Decision Log

- Gate the DOM listener on whether the platform's `AppState` is DOM-driven rather
  than deduplicating by timestamp (which reintroduces a race for genuinely
  distinct events) or dropping `AppState` (which breaks native).
- Memoize on the data (`[habits]` for the active list, `[activeHabits]` for the
  rule-history index), not with a ref-based "last computed" cache.
- Parse each habit's rule history once per data change into an index the day loop
  reads, leaving `habits.domain.ts` untouched; the index holds already-parsed
  history, so the loop's per-day calls no longer re-parse JSON.
- Extract the derivations into a module rather than asserting React internals:
  coverage is behavioural (one parse per habit per data change, stable values),
  never a render-count or duration assertion.

## Adversarial Review and Dispositions

- **Both signals are independent.** The activation/rollover refresh runs through
  its own signal (`createActivationRefresh`), so removing the duplicate DOM
  listener cannot suppress a day-generation bump; the unit test pins that, and
  the J2b past-midnight freshness journey (4/4) proves the rollover behaviour end
  to end on the built app.
- **No behavioural drift in the Habits numbers.** The extracted derivations
  reproduce the previous arithmetic exactly, including the asymmetric completion
  comparison, the paused/archived exclusion, the rest-day `null` progress, and
  the strip's 7-day window and weekday labels — pinned by value assertions on a
  fixed corpus, including a habit retargeted mid-window.
- **No threshold work.** No benchmark harness, fixture, ceiling, headroom floor,
  or timing boundary was touched (verified by the diff's file list), and the J8
  numbers are recorded as measurements, not claimed as an improvement.

## Validation Ledger

| Date       | Command / source                                                                 | Outcome                                                                                                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-29 | `npx vitest run tests/foregroundListeners.test.ts`                               | PASS — 12/12 (web AppState-only, no duplicate DOM listener, DOM-driven and non-DOM-driven platforms, hidden/background ignored, native, cleanup)                                                                                                                        |
| 2026-09-29 | `npx vitest run tests/habitsScreenDerivations.test.ts`                           | PASS — 9/9 (one parse per habit, no parse from a prebuilt index, counts, rest day, strip window/labels, retarget mid-window, determinism)                                                                                                                               |
| 2026-09-29 | `npm run qa:fast` (pinned Node v22.23.2)                                         | PASS — typecheck 0 errors; lint 0/0; unit 161 files / 1973 tests; journey-label-parity OK; quarantine-register-parity OK                                                                                                                                                |
| 2026-09-29 | `npm run qa:integration` (pinned Node v22.23.2)                                  | PASS — 79 files / 386 tests passed, 1 file / 2 tests skipped (pre-existing)                                                                                                                                                                                             |
| 2026-09-29 | `npm run qa:timezones` (pinned Node v22.23.2)                                    | PASS — Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati                                                                                                                                                                                         |
| 2026-09-29 | `npm run build:e2e` (fresh hermetic `dist/`)                                     | PASS — `[build:e2e] OK — hermetic export (0 Supabase hosts in dist/)`                                                                                                                                                                                                   |
| 2026-09-29 | J8 journey `three-months-in.spec.ts -g "Tom"`, run 1 (host: 31.73 GB total)      | PASS — 7/7; coldOverview=590/5000 ms (88.2 % headroom); maxSwitch=587/800 ms (26.6 % headroom: calories→todos 587, todos→habits 336, habits→focus 329, focus→workout 341, workout→calories 491, calories→overview 317); diarySearch=359/500 ms; pickerSearch=176/500 ms |
| 2026-09-29 | J8 journey, run 2 (same tree, fresh `dist/`)                                     | PASS — 7/7; coldOverview=535/5000 ms (89.3 %); maxSwitch=558/800 ms (30.3 %); diarySearch=369/500 ms; pickerSearch=110/500 ms                                                                                                                                           |
| 2026-09-29 | J2b `past-midnight-freshness.spec.ts`                                            | PASS — 4/4 (rollover/activation refresh unaffected)                                                                                                                                                                                                                     |
| 2026-09-29 | `npx prettier --check` on every changed file                                     | PASS — all clean                                                                                                                                                                                                                                                        |
| 2026-09-29 | `npm run openspec:validate` (`--all`)                                            | PASS — 68 passed / 0 failed                                                                                                                                                                                                                                             |
| 2026-09-29 | `openspec validate reduce-section-activation-render-work --type change --strict` | PASS — change is valid                                                                                                                                                                                                                                                  |
| 2026-09-29 | `node scripts/agent-execplan.mjs validate --plan …`                              | PASS — ExecPlan valid                                                                                                                                                                                                                                                   |
| 2026-09-29 | Full-diff review                                                                 | App-owned only: no harness, fixture, ceiling, floor, or timing boundary in the changed-file list                                                                                                                                                                        |

## Changed Files / Areas

- `lib/foregroundListeners.ts` (new) — `registerForegroundListeners` (one refresh per foreground; the DOM listener only when `AppState` is not DOM-driven) and `createActivationRefresh` (the separate activation/rollover signal).
- `lib/useForegroundRefresh.ts` — delegates registration to the new module; `useActiveForegroundRefresh` routes its activation refresh through `createActivationRefresh`.
- `features/habits/habitsScreen.derivations.ts` (new) — `buildHabitRuleHistoryIndex`, `summarizeHabitsToday`, `buildHabitDayStrip`, and `HABIT_STRIP_DAYS`.
- `features/habits/HabitsScreen.tsx` — memoized `activeHabits`, the rule-history index, the today summary, and the day strip; the inline derivations and the duplicated weekday-letter constant removed.
- `tests/foregroundListeners.test.ts` (new), `tests/habitsScreenDerivations.test.ts` (new).
- `openspec/changes/reduce-section-activation-render-work/tasks.md` — all 16 tasks checked.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the change's
   `proposal.md` / `specs/` / `tasks.md`.
2. `git status --short` and `git diff --stat`; reconcile this checkpoint against
   the real tree.
3. Re-run `npx vitest run tests/foregroundListeners.test.ts
tests/habitsScreenDerivations.test.ts`.
4. No implementation action remains. Archiving the change into
   `openspec/specs/` and committing the tree are separate, user-invoked steps.

## Outcomes & Retrospective

- Status: Completed.
- Summary: one web foreground now produces one refresh per mounted consumer
  instead of two, and the Habits surface's derived state is computed once per
  data change instead of once per render (with each habit's rule history parsed
  once per data change rather than once per day per render). Both contracts are
  pinned by executing coverage rather than by a measurement, and the measured J8
  numbers are recorded without claiming a threshold change.
- Follow-up: archive this change into `openspec/specs/` when the user invokes the
  OpenSpec archive step. Three pending changes remain in `openspec/changes/`
  (`harden-ci-lane-integrity`, `harden-native-evidence-and-release-posture`,
  `harden-silent-failure-certification`), each needing its own apply pass. If a
  quieter host is ever available, a longer J8 battery would tighten the headroom
  record; the 800 ms ceiling and 15 % floor stay unchanged either way.
