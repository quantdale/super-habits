# ExecPlan: SuperHabits production-correctness hardening

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close every currently resolvable in-scope production-correctness gap in the repository, one at a time, while retaining strict regression coverage, documenting environment-dependent lanes honestly, and leaving a recoverable record for a zero-context agent.

## Context

- Local SQLite is authoritative; synced main entities use soft delete and enqueue writes; `getDatabase()` is the singleton; IDs and local date keys use `createId()` and `toDateKey()`; migrations are append-only.
- The app is a permanently-mounted single-page shell. Settings is a modal, the Command Center is a global overlay, and web E2E runs against static `dist/` with an optional dummy-Supabase `dist-sync/` boundary.
- Existing companion OpenSpecs are normative for the individual fixes: `fix-todo-add-double-submit`, `fix-restore-emptiness-counts-deleted-rows`, `fix-linked-action-habit-increment-reentry`, `fix-recurring-todo-expansion-idempotency`, `fix-day-rollover-refresh`, `fix-pomodoro-defaults-propagation`, and `fix-restore-service-worker`.
- The umbrella proposal/design/tasks are coordination artifacts only; implementation belongs in the companion changes and their referenced source/tests.

## Scope

- Re-audit and fix the seven in-repo items from the production-readiness TODO manifest when still unresolved.
- Close the five current contract/performance entries in `docs/testing/known-gaps.md` when proven: CG-1 rollover, CG-2 restore tombstones, CG-3 todo double-submit, CG-4 recurring switch latency, CG-5 HEAVY diary search.
- Include Linked Actions, Pomodoro propagation, and service-worker restore because their active companion changes remain unfinished and the historical backlog names them as correctness work.
- Run risk-appropriate unit, real-SQLite integration, Playwright, deterministic simulation, timezone, and sync-boundary validation.

## Non-Goals

- Weekly scheduling, sync v2, product redesign, new AI work, native notification enhancements, observability infrastructure, unrelated UI polish, and large refactors.
- Treating standard-lane remote skips, native device absence, real Supabase credentials, or CI-only baselines as passing product evidence.

## Current Checkpoint

- Current milestone: Completed — all P0 data-integrity and P1 state/boundary fixes are proven; the newly discovered heatmap week-column boundary bug is fixed and J8 is green for it. CG-4 recurrence switching and CG-5 diary search remain strict performance quarantines after targeted optimization attempts. Deterministic QA and artifact validation are green; native-capability lanes are explicitly environment-blocked.
- Completed: Startup documents read; Git branch/log/status inspected; `npm run agent:plans`; `npm run qa:affected`; Vitest/Playwright inventories; OpenSpec changes/spec validation; companion artifact review; current code audit for all historical candidates; J7 reproduction; synchronous submit guard implementation; strict J7 release; CG-2 real-SQLite reproduction; count-query fix; strict restore integration release; fresh-event habit increment reproduction; stable source/day lookup; linked-action unit/integration coverage; new and unchanged J6 journeys; recurrence duplicate reproduction; atomic recurrence insert implementation; concurrent recurrence integration coverage; strict J8 row invariant with fresh web export; CG-1 strict J2b reproduction and provider fix; J2b/J2a isolated strict passes; Pomodoro strict stale-live-settings reproduction; idle/running/paused settings helper and unit coverage; strict J10 live-settings regression; real-worker SW restore reproduction; same-origin/cross-origin SW routing fix; J5 real-worker restore release; J4 real-worker backend-failure release; CG-5 strict reproduction; local quick-add search state/memo optimization; CG-5 picker/search behavior preservation; mounted-screen and recurrence-path performance attempts; standard Chromium and simulation projects; full Vitest and real-SQLite integration; timezone matrix; dist-sync build and 19/19 sync journeys; 16/16 deterministic scenarios; seeded J7 and J6 runs with seed `20260810`; J8 heatmap boundary reproduction, pure fix, unit regression, and focused release.
- In progress: None — native capability results, companion OpenSpecs, known gaps, and final plan validation are recorded below.
- Important modified files: Existing unrelated agent/QA lifecycle work is dirty in `.agent/PLANS.md`, `AGENTS.md`, `.github/workflows/ci.yml`, `package.json`, `qa/impact-map.json`, `scripts/qa-impact.mjs`, plus untracked lifecycle artifacts. Campaign changes now also include `core/providers/DayRolloverProvider.tsx`, `core/providers/AppProviders.tsx`, `lib/useForegroundRefresh.ts`, all six section screens, `tests/dayRollover.test.ts`, `e2e/journeys/past-midnight-freshness.spec.ts`, `docs/testing/known-gaps.md`, and the day-rollover companion tasks, in addition to the todo/restore/linked-action areas and companion checklists. Preserve all of it.
- Modified files: Campaign implementation covers task entities, restore, linked actions, recurrence, Pomodoro, rollover, the service worker, journeys, tests, documentation, and their companion checklists; unrelated lifecycle work remains preserved.
- Last successful validation: day-rollover unit = 3/3; day-rollover targeted typecheck and ESLint = 0 errors (warnings only); fresh web build passed; strict J2b = 4/4 and isolated J2a = 4/4; Pomodoro domain = 44/44; fresh web build passed; strict J10 = 5/5; linked-action unit/data/habit/integration Vitest = 34/34; recurrence unit + real-SQLite integration = 15/15; strict J8 row invariant passed with latest code; the new habit-increment journey and unchanged J6 = 7/7; restore coordinator/helper/integration Vitest = 26/26; strict J7 and CG-2 assertions passed.
- Last successful validation: fresh `dist-sync/` build passed; corrected sync-lane SW reproduction failed J5 prompt detection before the fix; J5 against the active real SW = 7/7; J4 against the active real SW = 12/12; targeted journey lint = 0 errors and one ignored-file warning for standalone `public/sw.js`.
- Last successful validation: fresh `dist-sync/` build passed; corrected sync-lane SW reproduction failed J5 prompt detection before the fix; J5 against the active real SW = 7/7; J4 against the active real SW = 12/12; targeted journey lint = 0 errors and one ignored-file warning for standalone `public/sw.js`; calorie data/domain tests = 29/29; calorie screen targeted typecheck/ESLint = 0 errors.
- Current failures: CG-4 strict performance remains unresolved: after recurrence-path optimization, same-day expansion suppression, and mounted-screen memoization, runs measured 760–813ms in isolated repeats, including a 813ms miss against unchanged ≤800ms, so its quarantine remains. CG-5 remains unresolved: after local search-state/memoization and static quick-add isolation, the latest fresh strict run measured 513ms against unchanged ≤500ms; prior repeats measured 501–603ms, while the saved-meal picker remained within 500ms. Temporary app-boundary marks measured about 0.2ms from input event to result render, while the browser `fill()` action consumed roughly 421–450ms, so no threshold or assertion was weakened. A combined J2b+J2a command produced a clock-isolation TEST_BUG (J2a saw the real date after J2b's module-level clock flag); each journey passes in its intended isolated process. An earlier pre-rebuild J8 failure was a stale-dist validation setup issue, not product evidence. A new-journey selector failure was classified TEST_BUG and fixed by scoping the control to the active dialog; its strict journey now passes. Historical PRODUCT_BUG evidence remains preserved in `.cursor/playwright-output/e2e-failures/`. Environment: `node`/`npm` are not on PowerShell PATH; commands work by prepending `C:\Program Files\nodejs` to PATH.
- Additional final-gate failure: aggregate `npm run e2e:full` exceeded the 600-second command limit without emitting a test failure; classify as ENVIRONMENT/command-timeout until the constituent projects are isolated. Do not report the aggregate gate as passing.
- Relevant quarantines: CG-4 J8 overview→todos switch and CG-5 J8 diary search. Remote-boundary `test.fixme(!remoteBoundaryDetected)` gates are capability/lane attributes and must remain. CG-1, CG-2, and CG-3 are released; linked-action, Pomodoro, and SW coverage has no quarantine.
- Blockers: None currently.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — hand off the completed hardening campaign with CG-4/CG-5 explicitly retained and native device lanes marked ENVIRONMENT.
- Remaining definition of done: Completed — every confirmed resolvable correctness gap has a root-cause fix and regression evidence; strict quarantines were removed only when unchanged assertions passed; remaining performance thresholds and capability gaps are documented honestly; deterministic personas and final QA matrix are recorded; companion OpenSpecs and this plan are validated.

## Verified Initial Gap Queue

| Priority | Identifier / companion                                               | HEAD evidence                                                                                                 | Contract/regression                                                                                                                           | Severity / risk                                                          | Reproducibility / dependencies                                     |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| P0       | CG-3 / `fix-todo-add-double-submit`                                  | `TodosScreen.onSave()` has no in-flight guard; two presses call the same async write path                     | J7 step 11 is `test.fixme()` with strict `expect(n).toBe(1)`; `tests/todos.domain.test.ts` has no guard coverage                              | High / duplicate synced rows and outbox writes                           | Deterministic rapid pointer presses; first fix, no dependency      |
| P0       | CG-2 / `fix-restore-emptiness-counts-deleted-rows`                   | `getLocalSyncBackedCounts()` filters `deleted_at IS NULL`                                                     | `tests/integration/restore.test.ts` has two `it.fails()` cases; J5 CG-2 branch is quarantined                                                 | Critical / stale restore can resurrect a local tombstone                 | Deterministic real SQLite; before/with SW boundary work            |
| P0       | linked-action re-entry / `fix-linked-action-habit-increment-reentry` | Engine dedupe currently keys executions on regenerated event/chain IDs; only calorie path has semantic lookup | Existing tests cover same-event/chain dedupe, not fresh-ID same-day `habit.increment`; companion requires new unit/integration/E2E regression | High / unintended habit completion increments                            | Deterministic source/day; must preserve legitimate next-day chains |
| P0       | recurring expansion / `fix-recurring-todo-expansion-idempotency`     | `createRecurringInstance()` inserts without a `(recurrence_id, due_date)` existence check                     | J8 records stable invariant workaround and CG-4 latency quarantine                                                                            | High / duplicate synced todos and outbox records                         | Deterministic same-day repeat; precedes latency release            |
| P1       | CG-1 / `fix-day-rollover-refresh`                                    | No day-key watcher/context signal exists; refresh only follows active transition/foreground                   | J2b `test.describe.fixme()` with strict new-day assertions                                                                                    | High / stale “Today” presentation and wrong user actions                 | Deterministic Asia/Manila clock; independent of DB fixes           |
| P1       | Pomodoro defaults / `fix-pomodoro-defaults-propagation`              | Mount loader reads settings once; active refresh currently reloads history only                               | J10 live assertion was omitted rather than quarantined; no current gap-register entry                                                         | Medium / stale future-session defaults, active timer must be preserved   | Deterministic pure helper + J10; independent                       |
| P1       | restore service-worker / `fix-restore-service-worker`                | `public/sw.js` intercepts all GETs and can resolve `respondWith(undefined)` after failed cross-origin fetch   | J5/J4 test-side SW stubs name this defect; no contract quarantine entry                                                                       | High / restore prompt and backend failure paths become unreachable/flaky | Real SW in `journeys-sync`; must preserve standard lane gates      |
| P2       | CG-4 / `fix-recurring-todo-expansion-idempotency`                    | J8 measured first Todos activation/switch around 1.1s under HEAVY                                             | J8 switch step `test.fixme()` keeps ≤800ms threshold                                                                                          | Medium / user-visible responsiveness                                     | Re-measure only after P0 recurrence fix                            |
| P2       | CG-5 / focused calorie diary performance                             | Diary and saved-meal picker filter arrays in render; current register records 677–771ms diary baseline        | J8 search step `test.fixme()` keeps ≤500ms threshold                                                                                          | Medium / HEAVY input latency                                             | Profile after correctness queue; threshold unchanged               |

Resolved/not in scope after audit: remote-boundary capability entries 8/9 are closed by the `journeys-sync` lane; Pomodoro defaults, Linked Actions, SW, and the newly discovered heatmap boundary are closed with regression evidence. The historical backlog has no separate production-readiness file beyond the empty manifest commit and this register.

## Progress

- [x] Read startup, architecture, testing, known-gap, and workflow documentation.
- [x] Inspect current Git/worktree/branch/log and preserve unrelated dirty agent-lifecycle work.
- [x] Inventory OpenSpec changes, tasks, specs, quarantines, and test counts at HEAD.
- [x] Create umbrella OpenSpec proposal/design/tasks and this versioned ExecPlan.
- [x] Validate the new ACTIVE plan and resume orientation.
- [x] Reproduce and fix CG-3 todo double-submit.
- [x] Fix and release CG-2 restore tombstone handling.
- [x] Fix linked-action habit increment re-entry.
- [x] Fix recurrence idempotency, then measure CG-4; retain its quarantine after strict threshold misses.
- [x] Fix/release CG-1 rollover freshness.
- [x] Verify/fix Pomodoro default propagation.
- [x] Fix service-worker restore boundary.
- [x] Profile/optimize CG-5 diary search; retain its quarantine after strict threshold misses.
- [x] Fix the heatmap week-column boundary discovered during final journeys.
- [x] Run deterministic simulations and final QA escalation.
- [x] Reconcile OpenSpec, known gaps, plan validation, and final report.

## Surprises & Discoveries

- The current branch is `main` at `714819a`, with unrelated uncommitted agent/QA lifecycle work from the Nitro handoff. It must not be reset or folded into the product fixes.
- PowerShell does not resolve Node/npm/OpenSpec by default, but `C:\Program Files\nodejs` plus local `node_modules/.bin` works.
- At initial audit, OpenSpec validated 12 active changes and 3 main specs; the seven product companion changes were structurally valid but had zero completed tasks. The final repository now validates 16 changes/spec items, with the campaign and companion verification tasks complete.
- The standard known-gap register has five contract/performance entries, while the historical production-readiness manifest also names Pomodoro, Linked Actions, and service-worker defects without register entries. They remain in the verified queue because current code still exhibits their pre-fix shape.

## Decision Log

- 2026-08-09 — Use `production-correctness-hardening` as a skip-spec umbrella and keep individual companion changes normative — avoids duplicating product requirements while satisfying the requested durable campaign record.
- 2026-08-09 — Serialize all fixes and start with J7 double-submit — it is a deterministic duplicate-write risk with a preserved E2E assertion and no dependency on shared data contracts.
- 2026-08-09 — Preserve standard `dist/` remote fixmes and release only product quarantines — the sync lane is an honest capability boundary, not a product failure.

## Validation Ledger

- 2026-08-09 — `git status --short`, `git branch -vv`, `git log --oneline --decorate -15` — PASS/observed — HEAD `714819a` on `main`; unrelated lifecycle work dirty.
- 2026-08-09 — `npm run agent:plans` (with Node PATH repair) — PASS — two legacy completed plans plus completed versioned lifecycle plans discovered.
- 2026-08-09 — `npm run qa:affected` (with Node PATH repair) — PASS/PLAN — pre-campaign dirty files map to agent-workflow-and-documentation; not product QA evidence.
- 2026-08-09 — `npx vitest list` — PASS/inventory — current unit + integration inventory listed; historical count in docs is stale.
- 2026-08-09 — `npx playwright test --list` — PASS — 181 tests across 19 files/projects, including quarantines and sync lane.
- 2026-08-09 — `openspec validate --changes` — PASS — 12/12 active changes valid.
- 2026-08-09 — `openspec validate --specs` — PASS — 3/3 main specs valid.
- 2026-08-09 — `npm run build:web` — PASS — fresh static `dist/` export completed with existing Expo web warning only.
- 2026-08-09 — targeted Playwright J7 duplicate-submit step with the strict quarantine temporarily lifted and immediately restored — FAIL / PRODUCT_BUG — row oracle received 2 instead of 1; strict assertion and quarantine are preserved for the fix.
- 2026-08-09 — `npm run agent:plan:validate -- --plan openspec/changes/production-correctness-hardening/execplan.md` — PASS — ACTIVE plan structurally valid.
- 2026-08-09 — `npm run agent:resume -- --plan openspec/changes/production-correctness-hardening/execplan.md` — PASS with ownership-neutral warnings — checkpoint and QA impact reconciled; pre-existing dirty lifecycle files remain unrelated.
- 2026-08-09 — targeted CG-2 real-SQLite integration with `it.fails()` temporarily lifted — FAIL / PRODUCT_BUG — both strict tombstone assertions failed: deleted-only rows were counted as zero and restore resurrected the local tombstone.
- 2026-08-09 — `npx vitest run tests/restore.coordinator.test.ts tests/restore.helpers.test.ts tests/integration/restore.test.ts` — PASS — 26/26 after the query fix and mock-contract update.
- 2026-08-09 — targeted restore ESLint — PASS — coordinator, unit/integration tests, and J5 spec clean.
- 2026-08-09 — CG-2 quarantine release — PASS — integration assertions unchanged and J5 branch released for the remote-boundary lane; known-gap entry closed.
- 2026-08-09 — second `npm run qa:affected` — PASS/PLAN — cumulative product edits map to todos, sync-and-restore, E2E/simulation, native persistence, and pre-existing agent workflow; required broad lanes recorded for final escalation.
- 2026-08-09 — fresh-event Linked Actions integration reproduction — FAIL / PRODUCT_BUG — two fresh source events on one day both applied `habit.increment`, producing the second completion.
- 2026-08-09 — linked-action unit/data/habit/integration Vitest — PASS — 34/34 with same-day duplicate and next-day apply coverage.
- 2026-08-09 — new habit-increment journey plus unchanged J6 — PASS — 7/7 journey steps; two source events persisted but one applied execution and one habit completion remained.
- 2026-08-09 — new-journey selector failure — TEST_BUG — duplicate matching controls were scoped to the active dialog; no product assertion changed and the rerun passed.
- 2026-08-09 — concurrent recurrence integration reproduction — FAIL / PRODUCT_BUG — the sequential re-check still permitted duplicate rows when activations interleaved before inserts committed; strict fix retained.
- 2026-08-09 — fresh-build J8 row invariant — PASS — atomic recurrence insert left exactly one active today-instance per active daily series and outbox growth matched row growth; first run max switch 760ms.
- 2026-08-09 — two fresh-build strict J8 performance reruns — FAIL / PRODUCT_BUG — overview→todos switch measured 892ms and 907ms against unchanged D14 ceiling 800ms; performance quarantine restored.
- 2026-08-09 — recurrence-path optimization attempt — MIXED / PRODUCT_BUG REMAINS — concurrent writes, one max-order read, unchanged-list suppression, and row memoization reduced observed overview→todos values to 785–822ms, but the unchanged ≤800ms threshold is not reliable; quarantine retained.
- 2026-08-09 — mounted-screen and diary quick-add optimization attempt — MIXED / PRODUCT_BUG REMAINS — memoized permanently mounted section screens, added same-day recurrence expansion suppression, and isolated the diary search subtree from static quick-add content; strict thresholds and assertions remained unchanged.
- 2026-08-09 — latest strict J8 after calorie optimization — FAIL / PRODUCT_BUG REMAINS — diary search measured 513ms against the unchanged 500ms ceiling; CG-5 quarantine restored, and the saved-meal picker assertion was not reached because the strict diary assertion failed first.
- 2026-08-09 — `npm run qa:fast` — PASS — typecheck passed; lint passed with 19 existing warnings and 0 errors; unit project passed 610 tests across 52 files.
- 2026-08-09 — `npm run qa:integration` — PASS — integration project passed 46 tests across 8 files, including real-SQLite restore, recurrence, linked actions, constraints, and migrations.
- 2026-08-09 — `npm run qa:affected` — PASS/PLAN — cumulative dirty tree maps to full web, sync, timezone, simulation, and native-capability escalation; no new scope expansion.

## Final QA additions

- 2026-08-10 — full `npm run e2e:journeys` — FAIL / PRODUCT_BUG — J8 HEAVY habits heatmap rendered 53 week columns against the unchanged explicit 52-column contract; all other executed journey steps passed and the two documented performance quarantines remained skipped.
- 2026-08-10 — `buildHeatmapWeekColumns` unit regression — PASS — two tests prove padded and naturally aligned 364-day windows honor the requested 52-column width.
- 2026-08-10 — focused fresh-build J8 after heatmap fix — PASS — five executed steps passed, including the unchanged 52-week boundary; CG-4 and CG-5 remained quarantined/skipped.
- 2026-08-10 — `npm run e2e:sync` after latest sync build — PASS — 19/19 real-worker sync journeys passed.
- 2026-08-10 — `npm run qa:simulation -- --all --mode deterministic` — PASS — 16/16 deterministic scenarios passed with fresh `dist/` build.
- 2026-08-10 — `node scripts/qa-simulation.mjs --scenario j7 --mode seeded --seed 20260810` — PASS — seeded error-prone fat-fingers scenario passed, including the single-completion invariant.
- 2026-08-10 — `node scripts/qa-simulation.mjs --scenario j6 --mode seeded --seed 20260810` — PASS — seeded linked-action chain scenario passed, with source and target todos persisted exactly once.
- 2026-08-10 — first seeded `@p0` wrapper invocation — TEST_BUG / corrected — PowerShell dropped the unquoted `@p0` token and the runner received `--mode` as the scenario; no product result was recorded, and concrete `j7`/`j6` IDs were rerun with the explicit seed.
- 2026-08-10 — `npm run e2e:journeys` after heatmap fix — PASS — 60/60 executed journey steps passed; 12 capability/performance steps remained intentional skips.
- 2026-08-10 — `npx playwright test --project=journeys e2e/journeys/a-tuesday.spec.ts` — PASS — 8/8 J1 regression steps passed.
- 2026-08-10 — final `npm run qa:fast` — PASS — typecheck passed; lint 0 errors/20 warnings under cap; unit project 612/612.
- 2026-08-10 — final `npm test` — PASS — 658 tests across 61 files, unit and integration projects.
- 2026-08-10 — `npm run qa:impact:validate` — PASS — all 12 impact-map rules valid.
- 2026-08-10 — `npm run openspec:validate` — PASS — 16/16 changes/spec items valid.
- 2026-08-10 — native smoke, persistence, lifecycle, Android, and iOS commands — ENVIRONMENT / NOT RUN — each preflight reported Maestro CLI unavailable and wrote a native QA report; no native pass is claimed.

## Changed Files / Areas

- `openspec/changes/production-correctness-hardening/` — umbrella proposal, design, task queue, and durable ExecPlan.
- Existing companion changes under `openspec/changes/fix-*` — normative individual fix requirements and task checklists; update only as each fix is implemented.
- Product areas queued: `features/todos`, `core/sync`, `core/linked-actions`, `features/habits`, `features/pomodoro`, `core/providers`, `public/sw.js`, `features/calories`, and their existing tests/journeys.
- `docs/testing/known-gaps.md` — update only when a named contract is proven closed.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan, and the relevant companion OpenSpec proposal/spec/tasks.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and inspect only task-relevant diffs; preserve the pre-existing agent/QA lifecycle changes.
3. Prepend `C:\Program Files\nodejs` to PATH for `npm`, `npx`, and local OpenSpec commands.
4. Run `npm run agent:resume -- --plan openspec/changes/production-correctness-hardening/execplan.md`; reconcile any Git/impact warnings with the checkpoint.
5. Continue only from `Exact next action`. Before editing a feature, read its full data/domain/screen files and the matching invariant skill; before broad QA, update this checkpoint.

## Outcomes & Retrospective

- Status: Completed. The campaign fixed all resolvable P0/P1 correctness gaps, fixed the newly discovered heatmap boundary defect, and preserved strict performance contracts where the current implementation still misses them.
- Root causes addressed: synchronous task submission re-entry, restore emptiness counting of tombstones, linked-action semantic re-entry, concurrent recurring-instance duplication, day-rollover refresh propagation, live Pomodoro default propagation, cross-origin service-worker interception, and calendar-padding overflow in heatmap columns.
- Performance outcome: recurring section switching improved from the historical ~1.1s path to 760–813ms but retained CG-4 because one strict repeat exceeded 800ms; diary search improved from historical 677–771ms to 501–603ms/latest 513ms but retained CG-5 because the unchanged 500ms ceiling is still missed. No threshold, assertion, retry, or quarantine rule was weakened.
- New bug discovered: the HEAVY J8 habits heatmap rendered 53 columns for an explicit 52-week contract on a Sunday-aligned window. Classified PRODUCT_BUG, fixed in `GitHubHeatmap`, covered by two unit tests and the unchanged J8 boundary, and recorded as closed CG-6.
- Test classifications preserved: earlier combined-clock invocation was TEST_BUG; stale export and selector issues were setup/TEST_BUG findings; native lanes are ENVIRONMENT due missing Maestro; no newly discovered flaky product behavior was promoted.
- Remaining product risks: CG-4 and CG-5 are real, user-visible performance risks and remain quarantined. Native notifications/lifecycle and real Supabase round trips remain outside this Windows run’s capability evidence. The aggregate `qa:full` wrapper previously exceeded its command budget; its constituent deterministic gates were run separately and reported individually.
- Recovery dogfood: the existing umbrella ExecPlan was resumed during the work after multiple milestones and failures; the task was completed from Git/plan state with no context-loss recovery needed beyond the durable resume flow. Final `agent:resume`, `agent:plan:validate`, `openspec:validate`, and `qa:impact:validate` all passed after the seeded runs.
- Next product phase: address the actual HEAVY interaction bottlenecks with browser/native profiling to close CG-4 and CG-5, then run Maestro-backed Android/iOS persistence and lifecycle validation. This is product performance/device validation, not another agent-infrastructure project.
