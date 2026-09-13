# ExecPlan: Close CG-4 and CG-5 performance gaps

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the remaining HEAVY recurring-todo switch (CG-4) and calorie-diary saved-meal search (CG-5) performance quarantines while preserving the existing fixtures, timing boundaries, assertions, thresholds, recurrence/search semantics, and correctness guarantees. Success is repeated strict J8 evidence at the unchanged `<= 800ms` and `<= 500ms` ceilings, followed by quarantine and known-gap cleanup.

## Context

- The repository is SuperHabits, an Expo/React Native Web PWA with a permanently mounted six-section shell and SQLite as the local source of truth.
- CG-4 and CG-5 are step 3 and step 6 of `e2e/journeys/three-months-in.spec.ts`, quarantined through the shared journey helper with strict assertions still executed in the step body.
- HEAVY fixture counts and all measured start/end boundaries are authoritative in `e2e/helpers/seed.ts` and J8. The configured acceptance project is Chromium under the `journeys` Playwright project, one worker, against a fresh `dist/` export.
- The completed `production-correctness-hardening` plan records prior recurrence/search optimizations and leaves both gaps open. Its historical evidence is preserved; this plan owns new evidence and changes.
- Existing worktree changes are extensive and predate this task. They are preserved; only this change’s files and evidence-backed overlapping product edits belong to this task.

## Scope

- Reproduce current baselines with repeated runs and document run state, fixture, project, timing boundaries, and variance.
- Profile the user-visible CG-4 and CG-5 paths, implement minimal evidence-backed changes, add focused regressions where needed, and run affected/broad QA.
- Remove each quarantine and close each known-gap entry only when repeated unchanged-threshold evidence proves it.
- Reconcile this OpenSpec, the known-gap register, QA impact, and final recovery record.

## Non-Goals

- No threshold, assertion, retry, timeout, fixture volume/content, or timing-boundary changes.
- No skipping legitimate work, broad architecture rewrite, unrelated cleanup, native redesign, or new benchmark framework.
- No schema migration/index without actual query-plan evidence.

## Current Checkpoint

- Current milestone: CG-4 and CG-5 are closed with unchanged contracts, reliable repeated margin, correctness-green journeys, and reconciled OpenSpec/known-gap/ExecPlan artifacts.
- Completed: startup guidance and task artifacts read; current Git status/branch/log/plans inspected; known gaps and J8 harness identified; production hardening OpenSpec/ExecPlan read; focused OpenSpec proposal/spec/design/tasks created; focused OpenSpec delta corrected to preserve the full modified requirement; ExecPlan validated and resumed; current fresh full-path CG-5 baseline captured; browser/CDP/DOM/app-boundary attribution and no-walk/delayed-search controls completed; prior accepted CG-4 edits preserved; final CG-4 distribution and prior recurrence/calorie/integration/typecheck/lint/timezone/simulation/P0/sync/impact/OpenSpec gates recorded; candidate refresh-order correction implemented; two independent 10-run strict batches passed; CG-5 quarantine and known-gap entry closed; normal 7-step J8 passed; focused, affected, deterministic, seeded, sync, full web, and validator gates completed; native environment blockers recorded.
- In progress: none. The product objective and required repository handoff are complete.
- Important modified files: `features/calories/CaloriesScreen.tsx` (concurrent refresh reads and early saved-meal catalog publication); `e2e/journeys/three-months-in.spec.ts` (CG-5 quarantine removed; strict assertion/fixture/timing preserved); `docs/testing/known-gaps.md` (CG-5 historical evidence and closure); focused OpenSpec `tasks.md` and this ExecPlan. Earlier accepted shared-shell/task-list/CG-4 files remain preserved. Baseline-only helper/log instrumentation has been removed; no `core/db/` files changed.
- Last successful validation: candidate Batch A against the fresh export passed all 10 unchanged strict full J8 runs, with diary samples `373, 370, 386, 351, 367, 396, 355, 371, 360, 368ms` (min 351; median 369; p90 386; max 396; 10/10 ≤500). Independent candidate Batch B after a second fresh export passed all 10 unchanged strict full J8 runs, with `369, 364, 368, 366, 412, 363, 355, 354, 369, 359ms` (min 354; median 365; p90 369; max 412; 10/10 ≤500). The normal unquarantined J8 run passed all 7 steps at `diarySearch=351ms`, `pickerSearch=74ms`, and `maxSwitch=742ms`. Every accepted run executed the Task 200 deep-row walk and row-level oracle. `qa:fast` passed 53 unit files/612 tests (lint 0 errors, 20 warnings); `qa:integration` passed 8 files/46 tests; focused task-list/Calories Chromium passed 13/13; rapid/navigation journeys passed 28/29 with one expected remote-boundary skip; `qa:journeys` passed fresh-build P0 16/16; `qa:timezones` passed 5 zones ×13 checks; `qa:simulation` validated all 16 scenarios and passed deterministic P0 smoke; full deterministic simulation passed all 16 scenarios; full seeded simulation passed all 16 scenarios, with HEAVY J8 seed `0x38f2ee71` (`run_msmma3m3_gb18hnq0`); rebuilt `dist-sync` and `e2e:sync` passed 19/19; `e2e:full` passed 148 tests with 17 expected skips, including unquarantined J8 at `diarySearch=371ms`, `pickerSearch=80ms`, `maxSwitch=761ms`. Candidate source passed typecheck, Prettier, and focused calorie data/domain tests (29/29). The authoritative baseline remains ten full-continuity misses at 511, 508, 530, 515, 513, 512, 509, 516, 507, 506ms (min 506; median 511.5; p90 516; max 530; 0/10 pass). Attribution showed post-reload Calories activation, not retained task-list DOM, owns the work: representative navigation had 157ms + 79ms long tasks, ~406ms script/~625ms task time, and app refresh completion after the interactive marker; delayed search was 66ms. Existing CG-4 evidence remains closed at 10/10 with 733–761ms (median 755; p90 757; max 761).
- Current failures: No known CG-4/CG-5 product or performance failure. The first attempted candidate batch is excluded as invalid (10/10 runs skipped CG-5); rejected candidates remain documented. An initial `qa:fast` attempt stopped on CRLF formatting errors in touched journey/Calories files; formatting was corrected and the rerun passed.
- Relevant quarantines: none for CG-4 or CG-5. Remote-boundary skips in the standard web lane remain expected and the dedicated sync lane passed.
- Blockers: Native smoke and targeted persistence were `ENVIRONMENT` blocked because Maestro is not installed/on PATH; reports were written under `simulation-output/native/`. The previous `display:none` candidate reduced CG-4 samples to roughly 652–674ms but caused the unchanged recurrence correctness step to hide `Task 4`; it was reverted and is classified as a rejected `PRODUCT_BUG` candidate.
- Condition required to unblock: None.
- Exact resume action after unblock: none; the plan is complete. If resumed for handoff review, inspect the final focused diff and validation ledger without changing the closed contracts.
- Exact next action: no further implementation action; preserve the closed CG-4/CG-5 evidence and hand off the native environment reports as the remaining risk.
- Remaining definition of done: all remaining work complete — unchanged thresholds, fixtures, timing boundaries, assertions, search semantics, deep-row behavior, reactivation behavior, broad web/sync/simulation QA, known-gap closure, OpenSpec task closure, and valid completed ExecPlan.

## Progress

- [x] Read repository startup, architecture, workflow, testing, known-gap, simulation, and performance artifacts.
- [x] Inspect Git state and preserve unrelated dirty work.
- [x] Create focused OpenSpec proposal, delta spec, design, and task list.
- [x] Validate the active OpenSpec and ExecPlan; establish resume checkpoint.
- [x] Reproduce 10-run CG-4 and CG-5 current baselines with the existing J8 harness.
- [x] Profile phase bottlenecks and classify variance.
- [x] Implement and validate CG-4 fix; release quarantine only if proven.
- [x] Implement and validate CG-5 fix; release quarantine only if proven.
- [x] Run regression, exploratory, affected, and broad QA; reconcile docs and artifacts.
- [x] Complete and validate this ExecPlan.

## Surprises & Discoveries

- The working tree contains a large pre-existing production-hardening/agent-lifecycle change set on `main`; it includes overlapping files and must not be reset, stashed, or overwritten.
- Historical campaign evidence says app-boundary diary search work was sub-millisecond while the Playwright input-to-result path remained roughly 421–450ms before the total crossed 500ms; this is a hypothesis to verify, not a conclusion for current HEAD.
- The first CG-4 candidate (`display:none` for inactive sections) lowered measured switching to roughly 652–674ms but hid an expected recurring todo after reactivation; it was reverted and is not a valid optimization.
- Current phase marks show the app’s calorie search state transition is fast, while the strict journey can overlap background screen initialization and browser action/render work; this requires correlation before changing search semantics or adding debounce.

## Decision Log

- 2026-08-10 — Use a separate focused change rather than reopening the completed hardening campaign — preserves historical auditability and gives the remaining performance work its own resumable state.
- 2026-08-10 — Keep `user-simulation-testing` as a delta capability — the existing generic performance contract is being made explicit for the already-decided 800ms/500ms user-visible ceilings; no new product behavior is invented.
- 2026-08-10 — Start with the existing J8 journey and fresh static export — it is the authoritative HEAVY continuity path and prevents a competing microbenchmark from hiding real user work.

## Validation Ledger

- 2026-08-10 — `git status --short`, `git branch -vv`, `git log --oneline --decorate -15`, `npm run agent:plans` — PASS/observed — `main` at `714819a`; unrelated dirty work preserved; completed hardening plan records CG-4/CG-5 open.
- 2026-08-10 — repository startup reads and skill reads — PASS — architecture, invariants, OpenSpec, QA, and simulation guidance loaded.
- 2026-08-10 — OpenSpec scaffold creation — PASS — focused change exists with spec-driven artifacts pending content validation.
- 2026-08-10 — `openspec validate --change close-cg4-cg5-performance-gaps` — TEST/CLI USAGE FAILURE — this installed CLI accepts the change name as the positional item, not `--change`; no product result.
- 2026-08-10 — corrected `openspec validate close-cg4-cg5-performance-gaps --type change --strict` — FIRST FAIL then PASS — initial delta omitted the original long-use section-switch scenario; copied it into the full MODIFIED requirement and reran successfully.
- 2026-08-10 — `npm run agent:plan:validate -- --plan openspec/changes/close-cg4-cg5-performance-gaps/execplan.md` — PASS — ACTIVE plan structurally valid.
- 2026-08-10 — `npm run agent:resume -- --plan openspec/changes/close-cg4-cg5-performance-gaps/execplan.md` — PASS with ownership-neutral warnings — checkpoint and QA impact reconciled; unrelated dirty files preserved.
- 2026-08-10 — `npm run build:web` — PASS — fresh static export completed; existing Expo web notification warning only.
- 2026-08-10 — temporary `PERF_STRICT_TARGET` branch in `e2e/helpers/journey.ts` — INSTRUMENTATION — permits one quarantined J8 step per run to execute strictly; scheduled for removal after baseline/profiling.
- 2026-08-10 — first strict CG-4 batch, 10 sequential J8 runs — PRODUCT_BUG reproduced — all 10 stopped at unchanged overview→todos `<=800ms`; visible samples 826, 816, 815, 938, 1,019, 846, 842, 855ms plus two truncated samples; each reached the unchanged assertion and produced failure artifacts.
- 2026-08-10 — clean strict CG-4 batch, 10 sequential J8 runs — PRODUCT_BUG reproduced — all 10 stopped at unchanged overview→todos `<=800ms`: 821, 824, 825, 831, 845, 847, 847, 855, 855, 867ms (median 847ms; p90 855ms; max 867ms).
- 2026-08-10 — strict CG-5 batch, 10 sequential J8 runs — PRODUCT_BUG reproduced — all 10 stopped at unchanged diary-search `<=500ms`: 505, 506, 507, 508, 520, 522, 523, 533, 540, 545ms (median 521ms; p90 540ms; max 545ms).
- 2026-08-10 — temporary strict-target instrumentation removal — PASS — `e2e/helpers/journey.ts` restored to its pre-task content; no temporary strict selector remains.
- 2026-08-10 — full current todo/calorie data/domain/screen/diary and navigation/provider inspection — PASS — recurrence expansion, list refresh, diary local filtering, permanently-mounted memo boundaries, and schema/query paths understood before profiling.
- 2026-08-10 — temporary app-boundary marks in todo refresh/render and diary input/result paths — INSTRUMENTATION — records phase timestamps only for the next targeted runs; scheduled for removal after root-cause decision.
- 2026-08-10 — `display:none` inactive-section experiment — PRODUCT_BUG candidate rejected — reduced CG-4 samples to roughly 652–674ms but caused the unchanged J8 recurrence visibility assertion to fail for `Task 4`; reverted before acceptance.
- 2026-08-10 — first app-boundary profiles — FINDING — CG-4 Todo refresh/list load was roughly 150–175ms and CG-5 input-to-result was roughly 9–11ms; action/mounted-render/background initialization remains to be correlated.
- 2026-08-10 — fresh strict CG-5 profile with refresh marks — FINDING — 321ms total; no Calories refresh mark occurred after the measurement boundary; input receipt-to-result was about 10ms, with one 127ms long task near the start of the fill/action interval.
- 2026-08-10 — fresh strict CG-4 profile — FINDING — 750ms maximum switch; overview→task section click/action was about 640ms, section activation committed around 602ms after measurement start, and list load followed about 178ms later; other switches were 169–279ms.
- 2026-08-10 — stable task-list callback candidate — IMPLEMENTED — `keyExtractor`, drag handlers, edit handler, and `renderItem` are stable across section activation so the existing virtualized list can preserve its row renderer; no fixture, threshold, or user-visible contract changed. Typecheck passed; strict measurement pending.
- 2026-08-10 — stable task-list callback candidate first measurement — PASSING SAMPLE — strict J8 remained behaviorally green and measured 590ms maximum switch (overview→task 590ms); repeated distribution and row-render attribution pending.
- 2026-08-10 — temporary row-render attribution — FINDING — activation showed `todoRenders=0` after the timing boundary, so the remaining cost is not rerendering individual task rows; browser list/layout/accessibility work remains under test.
- 2026-08-10 — inactive-section accessibility candidate — PASSING SAMPLES — visual J8 correctness remained green; pre-switch DOM/button count fell from 7150/193 to 6609/136; CG-4 measured 590ms and CG-5 measured 433ms. Repeated proof is required; single samples are not acceptance evidence.
- 2026-08-10 — repeated strict CG-4 candidate distribution — PASS — 10/10 J8 executions passed; overview→task maximum-switch values 610, 633, 601, 644, 573, 588, 595, 610, 642, 607ms (min 573; median 608.5; p90 642; max 644), with unchanged HEAVY fixture/assertions and recurrence/list correctness green.
- 2026-08-10 — repeated strict CG-5 candidate distribution — PASS — 10/10 J8 executions passed; diary-search values 467, 458, 450, 437, 445, 324, 446, 467, 448, 453ms (min 324; median 445.5; p90 467; max 467), with unchanged HEAVY fixture/assertions and calorie/search correctness green.
- 2026-08-10 — cleaned fresh-build unquarantined J8 — PASS — all 7 steps passed with no quarantine/fixme; maxSwitch 760ms and diarySearch 495ms; recurrence, list, diary persistence, search, and row-level oracles were green.
- 2026-08-10 — clean full-path repeated distribution — PRODUCT_BUG / CG-5 remains open — step 3 and step 6 both executed; CG-4 samples observed at 744, 747, 751ms in passing runs, while CG-5 exceeded 500ms in multiple runs (508, 516, 508, 511, 509, 528ms among captured failures). The earlier CG-5 targeted batch was invalid for closure because step 3 was skipped by the remaining quarantine.
- 2026-08-10 — web-only `content-visibility: hidden` experiment — PRODUCT_BUG candidate rejected — the full J8 continuity path failed at the unchanged `Task 4` visibility oracle after section reactivation; candidate removed before acceptance.
- 2026-08-10 — web-only explicit content visibility experiment — PRODUCT_BUG candidate rejected — setting active sections to `visible` and inactive sections to `hidden` still left `Task 4` hidden after reactivation; candidate removed before acceptance.
- 2026-08-10 — inactive-section CSS containment experiment — NO MATERIAL IMPROVEMENT — full J8 correctness passed, but the unchanged diary-search assertion still measured 523ms; candidate removed before acceptance.
- 2026-08-10 — web `removeClippedSubviews` experiment — NO MATERIAL IMPROVEMENT — full J8 correctness passed through the task walk, but the unchanged diary-search assertion measured 503ms; candidate removed before acceptance.
- 2026-08-10 — inactive empty-data experiment — PRODUCT_BUG / CG-4 remains open — the unchanged list/data correctness path passed, but overview→Todos measured 805ms; candidate removed before acceptance.
- 2026-08-10 — inactive static-row experiment — PASSING SAMPLE — full J8 continuity passed; maxSwitch was 785ms and diarySearch was 496ms, with all unchanged list/recurrence/calorie oracles green. Candidate changes inactive web list implementation and requires repeated evidence plus scroll-state review before acceptance.
- 2026-08-10 — inactive static-row repeated distribution — PRODUCT_BUG / NO ACCEPTANCE — nine runs failed CG-5 at 505–522ms and the tenth failed CG-4 at 817ms; candidate removed before acceptance.
- 2026-08-10 — web virtualized-window experiment — PASSING SAMPLE — full J8 continuity passed with the unchanged fixture/oracles; maxSwitch was 719ms and diarySearch was 493ms. A repeated distribution is required before acceptance.
- 2026-08-10 — web `windowSize=5` repeated distribution — FLAKY / NO ACCEPTANCE — only 2/10 full J8 executions passed; successful runs were CG-4 728–730ms and CG-5 493–494ms, while eight runs missed CG-5 at 506–520ms. The direction remains under a narrower-window experiment.
- 2026-08-10 — web `windowSize=1` experiment — PRODUCT_BUG candidate rejected — the unchanged deep-row oracle could not reveal `Task 200` after the required wheel walk; candidate removed before acceptance.
- 2026-08-10 — web `windowSize=3` experiment — PRODUCT_BUG candidate rejected — the unchanged deep-row oracle again could not reveal `Task 200`; candidate removed before acceptance.
- 2026-08-10 — dependency `removeClippedSubviews` experiment — NO MATERIAL IMPROVEMENT — honoring the existing prop through a temporary local library patch still measured diary search at 513ms; dependency edits removed before acceptance.
- 2026-08-10 — section DOM-order experiment — NO MATERIAL IMPROVEMENT — placing Calories before Todos did not close the unchanged diary-search assertion (522ms); ordering edit removed before acceptance.
- 2026-08-10 — inactive list scroll-disable experiment — NO MATERIAL IMPROVEMENT — the unchanged full path still measured diary search at 533ms; candidate removed before acceptance.
- 2026-08-10 — final candidate cleanup — PASS — restored default list behavior, original section DOM order, original journey quarantine helper, and removed all temporary profiling/strict-target/dependency edits; typecheck, fresh web export, and one quarantined J8 run passed with maxSwitch 737ms and six non-quarantined steps green.
- 2026-08-10 — final quarantined CG-4 distribution — PASS — 10/10 unchanged J8 runs completed with CG-4 max-switch values 753, 757, 737, 757, 761, 733, 757, 737, 734, 757ms (min 733; median 755; p90 757; max 761); CG-5 remained quarantined and no strict contract was altered.
- 2026-08-10 — final focused and affected regression gates — PASS — typecheck, lint (0 errors; 20 existing warnings), unit (53 files/612 tests), integration (8 files/46 tests), timezone matrix (5 zones), deterministic P0 simulation (24/24), P0 journeys (16/16), sync lane (19/19), QA impact validation, and strict OpenSpec validation passed; native lanes were not run on this web-focused change.
- 2026-08-10 — `npm run qa:fast` — PASS — typecheck, lint (0 errors; 20 allowed warnings), and 53 unit files/612 tests passed.
- 2026-08-10 — `npm run openspec:validate`, `npm run agent:plan:validate -- --plan openspec/changes/close-cg4-cg5-performance-gaps/execplan.md`, `npm run qa:impact:validate` — PASS — 17 OpenSpec items, the ACTIVE ExecPlan, and all 12 QA impact rules validated.
- 2026-08-10 — `npm run qa:full` — ENVIRONMENT/AGGREGATE TIMEOUT — the 15-minute command limit (exit 124) was reached during the full deterministic simulation stage after the aggregate had advanced beyond its web journey stage; no assertion failure was emitted and no child Node processes remained. Constituent fast, integration, timezone, P0/journey, sync, and deterministic-P0 gates remain separately recorded.
- 2026-08-10 — `npm run e2e:full` — PASS — fresh web export and the configured Chromium, journeys, and simulation projects completed 165 tests: 147 passed, 18 expected skips, 0 failures. The HEAVY journey passed its released CG-4 step at maxSwitch 748ms; the CG-5 fixme remained intentionally skipped.
- 2026-08-10 — fresh `npm run build:web` — PASS — clean static export completed with current source; Expo web notification warning only. Baseline-only strict-target helper was subsequently removed.
- 2026-08-10 — fresh strict CG-5 baseline — PRODUCT_BUG reproduced — ten full-continuity J8 runs reached the unchanged diary-search assertion and measured 511, 508, 530, 515, 513, 512, 509, 516, 507, 506ms (min 506; median 511.5; p90 516; max 530; 0/10 pass); one separate run also exposed an incidental CG-4 810ms host miss, with no contract changes.
- 2026-08-10 — baseline instrumentation cleanup — PASS — restored the journey helper quarantine behavior and removed the temporary CG-5 console mark; no product or acceptance-contract edits remain from baseline collection.
- 2026-08-10 — retained-DOM causal profile — FINDING — J8 step 6 calls `returnToApp`, which reloads `/` after the Task 200 walk; the measured Calories page had zero rendered Todo rows. Normal/deep-walk and no-walk profiles converged (~254–266ms in profiling samples), so retained Todo DOM is not the direct J8 search cause. Post-reload Calories activation showed representative 157ms and 79ms long tasks, 4,454 mutations, ~406ms script/~625ms task CDP deltas, and severe frame gaps; delayed search after a 1s settle measured 66ms. Temporary app-boundary marks are being added to identify refresh/commit ownership.
- 2026-08-10 — app-boundary attribution — FINDING — Calories `refresh-start` occurs after activation; `refresh-data-ready` and later state commits can trail the interactive marker by hundreds of milliseconds. `searchSavedMeals('')` is currently sequenced after `listCalorieEntries()` and before the aggregate/goal Promise.all completes. The safe candidate is to start saved-meal reads concurrently with entries and publish `allSavedMeals`/`recentMeals` as soon as that small catalog is ready; diary filtering, ordering, and macro values remain unchanged.
- 2026-08-10 — candidate refresh-order implementation — PASS — `CaloriesScreen.refresh` now starts entries, saved-meal catalog, summary, and goal reads concurrently; saved meals publish as soon as their catalog Promise resolves. `npm run typecheck`, Prettier on the touched screen, and calorie data/domain tests (29/29) pass; no threshold, fixture, or journey assertion changed.
- 2026-08-10 — final read-only audit — PASS — no Node test processes remained; focused diff whitespace check passed; no temporary profiling/strict-target markers remained; exactly one J8 quarantine declaration remains (CG-5); no `core/db/` files changed.
- 2026-08-10 — format check — BASELINE FAILURE — `npm run format:check` reports 91 pre-existing repository formatting discrepancies outside the focused task files; touched task files were formatted with repository CRLF conventions. No broad formatter rewrite was performed.
- 2026-08-10 — unquarantined normal J8 — PASS — all 7 steps passed with unchanged assertions; `diarySearch=351ms`, `pickerSearch=74ms`, `maxSwitch=742ms`, including Task 200 and row-level reactivation oracles.
- 2026-08-10 — candidate Batch A — PASS — 10/10 strict full-path runs: `373, 370, 386, 351, 367, 396, 355, 371, 360, 368ms` (min 351, median 369, p90 386, max 396).
- 2026-08-10 — independent candidate Batch B after a fresh export — PASS — 10/10 strict full-path runs: `369, 364, 368, 366, 412, 363, 355, 354, 369, 359ms` (min 354, median 365, p90 369, max 412).
- 2026-08-10 — focused correctness and broad web QA — PASS — `qa:fast` 53 unit files/612 tests, `qa:integration` 8 files/46 tests, focused task-list/Calories 13/13, rapid/navigation 28/29 with one expected remote-boundary skip, P0 journeys 16/16, timezone matrix 5 zones ×13, full deterministic simulation 16/16, full seeded simulation 16/16 (HEAVY J8 seed `0x38f2ee71`), and `e2e:full` 148 passed/17 expected skipped.
- 2026-08-10 — sync and artifact validators — PASS — rebuilt dummy-credential `dist-sync`; `e2e:sync` 19/19; `qa:impact:validate` 12/12 rules; `openspec:validate` 17/17 items; completed ExecPlan validation PASS.
- 2026-08-10 — native impact lanes — ENVIRONMENT — `qa:native:smoke` and `qa:native:targeted` could not start because Maestro is not installed/on PATH; reports are preserved under `simulation-output/native/` and no native success is claimed.

## Changed Files / Areas

- `openspec/changes/close-cg4-cg5-performance-gaps/` — focused proposal, performance contract delta, design, tasks, and durable implementation state.
- `features/todos/`, `features/calories/`, shared providers/UI, and/or `core/db/` — only if profiling proves a product bottleneck there.
- `e2e/journeys/three-months-in.spec.ts`, focused tests, `docs/testing/known-gaps.md` — only for evidence, regression coverage, and quarantine reconciliation; thresholds/assertions/fixture remain unchanged.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan, the focused OpenSpec artifacts, and the completed hardening ExecPlan.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`; preserve all pre-existing edits and inspect overlapping diffs before modification.
3. Run `npm run agent:resume -- --plan openspec/changes/close-cg4-cg5-performance-gaps/execplan.md` and reconcile its warnings with this checkpoint.
4. Continue only from `Exact next action`; checkpoint before every large build, repeated profiling run, or broad QA command.
5. Use the existing Chromium `journeys` project and HEAVY J8 path; never alter its thresholds, assertions, waits, or fixture to make a result pass.

## Outcomes & Retrospective

- Status: Completed.
- Summary: CG-4 remains closed with final full-path evidence at 733–761ms. Browser attribution disproved retained task-row DOM as the direct measured CG-5 cause: J8 reloads before measurement, and the cost was post-reload Calories activation/refresh scheduling. The accepted `CaloriesScreen.refresh` correction starts all reads concurrently and publishes the saved-meal catalog as soon as its small query pair resolves. CG-5 now passes two independent 10/10 batches with 351–412ms samples, the unchanged J8 strict assertion is released, and the known-gap entry is closed.
- Remaining risk: native smoke/persistence evidence is unavailable until Maestro is installed and a target is provisioned. Standard web remote-boundary branches remain intentionally gated, while the dedicated dummy-boundary sync lane passed.
- Next product phase: continue ordinary feature work with the closed performance contracts as regression gates; do not relax the 500ms threshold or HEAVY continuity path.
