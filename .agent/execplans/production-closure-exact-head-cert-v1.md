# ExecPlan: Production Closure, Exact-HEAD Certification, Platform Closure, and Release Readiness

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Take SuperHabits from `691d2a2` through production closure: restore trustworthy GitHub CI, reconcile stale governance state, certify the exact release-candidate SHA across static/unit/web/simulation/native lanes, close every repository-executable Supabase/iOS/store/dependency gap, publish an evidence-backed release verdict, and only then recommend (not implement) the strongest v2 direction.

## Context

- Planner handoff: `.agent/EXECUTION_PROMPT.md` (Status ACTIVE; replaced 2026-09-22 with the overnight superset directive — predecessor Phases 0–11 prompt survives in Git history); this plan is the task-state store for that campaign per `.agent/PLANS.md`.
- Baseline (verified 2026-09-22): `HEAD == origin/main == 691d2a2ef488c45d936f736d29ba81d7cea96150`, branch `main`, tree clean, single worktree, no open PRs/issues, `openspec list` → no active changes, OpenSpec validate 59/59 PASS.
- ExecPlan inventory: 1 BLOCKED (`repository-completion-and-truth-v1` — GitHub Actions billing), all others COMPLETED; `agent:plan:validate:all` exits 1 with exactly one FAIL: `workout-history-quick-log-badge.md` (COMPLETED with unchecked `- [ ] Single commit.`).
- CI truth (verified via `gh run view`): push run `35487607744` (691d2a2, 2026-09-20) never started jobs (billing annotation). Schedule run `35653305101` (2026-09-21) started jobs — billing recovered — and failed at exactly `Validate versioned ExecPlans`, skipping `Test`; e2e/nightly never ran. Both hypotheses from the handoff CONFIRMED; the plan-validate defect is the current live blocker.
- Badge-plan evidence: commit `ac60e78` exists on main and contains the full feature (QuickLogBadge, domain predicate, data counts query, list/detail wiring, tests — 8 files, +297). The checkbox was simply never ticked. Reconciliation is honest, not falsification.
- Host tooling: default `node` v24.3.0 violates engines (`>=22.22.1 <23`); portable Node 22.23.2 exists at `%LOCALAPPDATA%\tools\node-v22.23.2-win-x64` — prefix PATH for all gates (known-gaps E1: better-sqlite3 segfaults under Node 20; use 22, never 20/24 for integration). `adb` + many AVDs attached (Nitro_API_36 canonical), Maestro 2.9.0, `gh` available. Windows CRLF: `npx prettier --write` edited files before lint.
- Preserve: stash `stash@{0}: pre-recovery-local-changes` — never touch; no other branches/worktrees.
- Push policy for this campaign: normal push permitted (explicitly required to restore/verify CI); never force-push.

## Scope

Phases 0–11 of `.agent/EXECUTION_PROMPT.md` plus the overnight superset directive received 2026-09-22 (§32 adversarial final review, §34 terminal conditions, Master Successor Rule loop through Campaigns 11+, §36 evidence-heavy final report): CI restore (done); stale-plan reconciliation (done); exact-HEAD certification (static, unit/integration, qa:fast, timezones, build:web, web:verify/hygiene, full E2E, deterministic sim, dist-sync/e2e:sync, PWA); Android exact-build certification on Nitro_API_36; Supabase/cloud static closure (+ disposable lane only if credentials exist); iOS static readiness; store repository artifacts; dependency/security audit (no blind `audit fix --force`); release verdict at final SHA; v2 direction audit (sync vs AI Command Center) as recommendation only; then successor campaigns until material executable work is exhausted/blocked/speculative.

## Non-Goals

- No speculative v2 implementation; no feature churn; no two-way sync; no force-push/tag/store submission/production Supabase mutation; no test weakening; no fabrication of screenshots or iOS runtime claims; no touching the pre-existing stash.

## Current Checkpoint

- Current milestone: **Phase 3 COMPLETE at application candidate `cc6889af2eba707cfbbf17792888f63a74b489af`; Phase 4 Android exact-build certification COMPLETE at `b227b34cb5f27c4d9405becdf437c8b37afe8540`.** The canonical APK was rebuilt/installed on `Nitro_API_36` (API 36, x86_64); SHA-256 `C7D0CC91FC70DC465F263E822DC9A4D52485BADA03B157DF82C05AE5CE21EF13`, metadata `simulation-output/native/native-android-build.json`. Smoke passed 2/2, persistence 11/11, lifecycle 6/6. CI run `35769774260` is terminal: `quality` SUCCESS, `e2e` FAILURE on the existing J8 section-switch headroom guard (743/790/721 ms against the unchanged 800 ms ceiling and 15% headroom floor), nightly skipped by design. Earlier candidate run `35749583938` had quality and e2e SUCCESS.
- Completed: Phase 0 recon; Phase 1 badge-plan repair (`3d02e4e`) + campaign open (`1c3487d`), `agent:plan:validate:all` PASS, cheap gates PASS, full `npm test` 2248/2248 PASS, push `691d2a2..1c3487d`, CI run `35743212617` quality **success** (typecheck ✓ lint ✓ themes ✓ openspec ✓ **Validate versioned ExecPlans ✓** Test ✓ advisory audit ✓); Phase 2 reconciliations committed (`9104c5b`): `repository-completion-and-truth-v1` → COMPLETED with rerun evidence (billing-cleared `gh run rerun 34511232099`: quality ladder green through plan-validate; Test 2000/2002, lone failure = POSIX exitCode-oracle TEST_BUG fixed later by `2447787`, absent from `cf50f8a` by ancestry), `release-readiness-refresh-v1` checkpoint closed, `autonomous-campaign-thinning-stop-v1` blocker-1 push annotation, `app-store-readiness.md` provenance reconciled (table = latest per-gate re-runs through a11y closure; narrative = original release-readiness battery 136/104) + guard tests 31/31 PASS.
- In progress: Phase 4 is complete. The first lifecycle report (`simulation-output/native/native-android-lifecycle-Nitro_API_36-2026-09-22T193907546Z.json`) failed 2/6 because four Maestro flows lacked proven scroll positioning; the cause is classified `TEST_BUG`, corrected in commit `9ca8200`, and exact-tree replay passed 6/6 on `b227b34`. The original report/screenshots remain preserved. Phases 5–11 remain. CI run `35769774260` still requires a Phase 9 J8 audit; its guard thresholds remain unchanged.
- Important modified files: Only this ExecPlan is being updated for the completed Android milestone. No application source changes were needed; changed lifecycle flows are in committed `9ca8200` and included in the certified source tree `b227b34`.
- Last successful validation: 2026-09-23 — exact-tree Android build PASS at `b227b34`; smoke 2/2 (`native-android-smoke-Nitro_API_36-2026-09-22T201203605Z.json`), targeted persistence 11/11 (`native-android-persistence-Nitro_API_36-2026-09-22T202616859Z.json`), lifecycle 6/6 (`native-android-lifecycle-Nitro_API_36-2026-09-22T203440510Z.json`), all with APK SHA `C7D0CC91…EF13`; `qa:fast`, focused tests, formatting, and plan validation PASS.
- Current failures: No current local native failure. Preserved initial native report `native-android-lifecycle-Nitro_API_36-2026-09-22T193907546Z.json` documents the four now-fixed `TEST_BUG`s. CI run `35769774260` failed only the J8 headroom assertion (743/790/721 ms against 800 ms and 15% floor); its dependent artifact-upload failure is consequential. This performance result remains for Phase 9 adversarial review; do not loosen its thresholds.
- Relevant quarantines: None new; standing known-gaps 15 (J8 headroom floor) and capability gaps 1–20 unchanged.
- Blockers: None for local Android execution. Run `35769774260` is terminal, so CI concurrency no longer blocks a later normal push. Later external watch items: iOS/macOS, Supabase live credentials, store owner/legal/console actions.
- Condition required to unblock: None for Android; the selected API-36 x86_64 target is boot-ready.
- Exact resume action after unblock: None.
- Exact next action: stage and commit this validated Android-completion checkpoint, then run the required `npm run qa:full` broad gate on the current source/test tree and preserve all results.
- Remaining definition of done: complete Android exact-source certification, then Phases 5–11, mandatory adversarial review and successor loop, final exact-SHA validation, terminal-condition proof, and evidence-heavy report.

## Progress

- [x] Phase 0 — reconstruct real current state (reads, plans, OpenSpec, GitHub, native inventory, fresh ExecPlan)
- [x] Phase 1 — restore CI truth (badge-plan fix → validate:all PASS → cheap gates → commit → push → CI run past plan-validate: quality SUCCESS at `1c3487d`)
- [x] Phase 2 — reconcile stale plans/repository truth (repository-completion→COMPLETED w/ rerun evidence, release-readiness-refresh closed, thinning-stop annotated, app-store-readiness provenance fixed — all in `9104c5b`)
- [x] Phase 3 — exact-head release certification at `cc6889a` (exact-SHA quality + full E2E + 23/23 deterministic scenarios + dist-sync/e2e:sync; local sim validation and web/PWA evidence)
- [x] Phase 4 — Android exact-build certification at `b227b34` (provision → smoke 2/2 → persistence 11/11 → lifecycle 6/6 on Nitro_API_36; APK SHA recorded above)
- [ ] Phase 5 — Supabase/cloud/account static closure (+ live lane only if authorized env exists)
- [ ] Phase 6 — iOS repository readiness (static; EAS/macOS marked BLOCKED_EXTERNAL if unavailable)
- [ ] Phase 7 — store release closure (repository-executable artifacts done; owner actions listed)
- [ ] Phase 8 — dependency/security audit (classified; no blind force-fix)
- [ ] Phase 9 — performance/resilience follow-ups (evidence-backed only; J8 ceilings retained)
- [ ] Phase 10 — release verdict report at final SHA
- [ ] Phase 11 — v2 direction audit (recommendation only)

## Surprises & Discoveries

- Billing DID recover between the 2026-09-20 push run (jobs never started) and the 2026-09-21 schedule run (jobs ran) — so `repository-completion-and-truth-v1`'s blocker condition may already be satisfied; Phase 2 must verify and reconcile that plan honestly rather than leaving a stale BLOCKED status.
- The live CI failure is exactly the handoff's hypothesis (plan-validate before Test), not a product/test failure — CI quality lane is otherwise green through lint/themes/openspec on the schedule run.
- Host default Node is 24.3.0 (engines-violating); all local gates must use the portable 22.23.2 toolchain.
- Host CPU load hit ~97% from an UNRELATED user process (`pi-coding-agent` CLI, PID 111928, not ours to kill) — this drives the recurring unit-test hook/test timeouts (`restore.coordinator` beforeAll 10s ×3, `qaNativeProvision`, `accountRemoteFingerprint`, `supabase.adapter`) that pass in isolation and in clean full runs. Classified FLAKY_TEST-under-host-load per known-gaps class; a load-aware gate runner (waits for CPU ≤ 60%) is used for the remaining local gates. Never kill the neighbor process; never raise test ceilings to mask load.
- 2026-09-23 — The Android lifecycle failure was test positioning drift: the passing habit persistence flow scrolls UP and centers the new card before asserting it, while the failing reminder flows omitted that reveal step or scrolled DOWN from the wrong position. The failing Workout flow tapped `Add routine` at the bottom edge without `centerElement`; its final screenshot had navigated to To Do. Same-APK habit persistence control passed, so no product change is justified by these artifacts.
- 2026-09-23 — Exact-SHA CI run `35769774260` passed quality but its E2E journey failed the existing J8 section-switch headroom floor (743/790/721 ms with unchanged 800 ms ceiling / 15% floor); the previous source-candidate E2E run passed. Keep the guard intact and include runner/environment variance in Phase 9's independent audit.

## Decision Log

- 2026-09-22 — Treat the pasted campaign as the ACTIVE execution prompt and persist it to `.agent/EXECUTION_PROMPT.md` (predecessor COMPLETED prompt survives in Git history) — matches PLANNER_HANDOFF protocol and gives future sessions a resumable handoff.
- 2026-09-22 — Badge-plan fix is checkbox reconciliation, not test/status falsification: feature commit `ac60e78` verified present with full implementation and recorded validation evidence.
- 2026-09-22 — Normal push is in-scope for this campaign (CI verification requires it); force-push and tag remain forbidden.
- 2026-09-22 — Classify the 2 gate test timeouts as FLAKY_TEST (host-load from parallel subagents), not PRODUCT_BUG: both pass in isolation and on an unloaded full re-run with no assertion changes (autonomous-qa.md rule: reproduce, classify, never weaken).
- 2026-09-22 — Phase 2 will rerun billing-blocked CI run `34511232099` (`cf50f8a` tree) rather than only watching the new push, because that plan's DoD is CI verification of ITS pushed tree; verified the badge defect cannot affect that rerun.
- 2026-09-22 — Never overlap CI triggers on the same ref: `gh run rerun 34511232099` concurrency-cancelled the in-progress push run `35743212617` mid-Lint (`cancel-in-progress: true`); resolved by re-running `--failed` after the first rerun settled, and by deferring the Phase-2 push until the current run's e2e finishes.
- 2026-09-22 — Close `repository-completion-and-truth-v1` COMPLETED with the rerun's evidence (its own latitude: "or close with the rerun evidence") instead of demanding green Test on `cf50f8a`, where the lone failure is a deterministic POSIX/Windows oracle difference fixed later by `2447787`.
- 2026-09-23 — Classify the four initial Android lifecycle failures as `TEST_BUG`, then align only the Maestro flows to already-passing scroll and centering patterns; preserve all assertions and make no product change absent contrary evidence.
- 2026-09-23 — Treat CI J8 headroom failure as unresolved Phase 9 evidence until the guard, measurements, and rerun variability are adversarially reviewed; do not change its 15% floor or 800 ms ceiling to force green.

## Validation Ledger

- 2026-09-22 — `git status/branch/rev-parse/log/worktree/stash` — PASS — main @ 691d2a2 == origin/main, clean, 1 stash preserved.
- 2026-09-22 — `npm run agent:plans` — PASS — inventory captured (1 BLOCKED, rest COMPLETED).
- 2026-09-22 — `npm run agent:plan:validate:all` — FAIL (expected) — sole failure: `workout-history-quick-log-badge.md` unchecked Single-commit task; EXIT 1 matches CI.
- 2026-09-22 — `npm run openspec:validate` — PASS — 59/59.
- 2026-09-22 — `openspec list` — PASS — no active changes.
- 2026-09-22 — `gh run view 35653305101` — FAIL (product-of-record) — quality dies at Validate versioned ExecPlans; Test skipped; billing annotation absent (jobs started).
- 2026-09-22 — `gh run view 35487607744` — FAIL (ENVIRONMENT, historical) — billing blocked job start on 2026-09-20 push of 691d2a2.
- 2026-09-22 — `git show --stat ac60e78` — PASS — badge feature commit present (8 files, +297).
- 2026-09-22 — `npm run agent:plan:validate:all` (post-repair) — PASS — all versioned ExecPlans valid.
- 2026-09-23 — `npm run qa:native:lifecycle -- --serial emulator-5554` on canonical APK source `19191bd` — FAIL / `TEST_BUG` — 2/6 pass, 4 failures; preserved JSON and Maestro screenshots show create-card assertions without scrolling plus Workout submit at y=2246 under the section bar/taskbar.
- 2026-09-23 — `node scripts/qa-native.mjs --platform android --flow .maestro/flows/habit-persistence.yaml --serial emulator-5554` on the same APK/source — PASS — create, scroll UP/center, complete, cold relaunch, and persisted completion all passed.
- 2026-09-23 — `gh run view 35769774260` — quality SUCCESS; e2e FAILURE — `three-months-in` J8 headroom guard recorded 743/790/721 ms; upload failure was consequential because E2E did not produce `dist-sync/`.
- 2026-09-23 — `npm run qa:affected` — PASS — flow and ExecPlan edits map to `qa:fast`, native smoke, native lifecycle, then `qa:full`; focused tests are `nativeAvd`, `qaNativeProvision`, and `agent-execplan`.
- 2026-09-23 — `npm run agent:plan:validate -- --plan .agent/execplans/production-closure-exact-head-cert-v1.md` — PASS — updated failure classification and exact next action satisfy Plan-Version 2 structure.
- 2026-09-23 — `npm run qa:fast` — PASS — typecheck, lint, unit suite (146 files / 1,877 tests), journey-label parity, and quarantine parity.
- 2026-09-23 — `npx vitest run --project unit tests/nativeAvd.test.ts tests/qaNativeProvision.test.ts tests/agent-execplan.test.ts` — PASS — 3 files / 23 tests.
- 2026-09-23 — `npx prettier --check` on the four Maestro flows and campaign ExecPlan; `git diff --check` — PASS — formatting and whitespace clean.
- 2026-09-23 — `git commit -m "test(native): stabilize lifecycle flows"` — PASS — local commit `9ca8200`, four flow fixes plus campaign checkpoint; no application files changed.
- 2026-09-23 — `npm run qa:native:provision -- --force --serial emulator-5554` — PASS — clean source `b227b34`; release APK `C7D0CC91…EF13`, installed on API 36/x86_64 `Nitro_API_36`; previous `19191bd` APK and metadata archived under `simulation-output/native/archive/` with hash verified.
- 2026-09-23 — `npm run qa:native:android -- --serial emulator-5554` — PASS — smoke 2/2 flows on exact `b227b34` APK.
- 2026-09-23 — `npm run qa:native:targeted -- --serial emulator-5554` — PASS — persistence 11/11 flows on exact `b227b34` APK.
- 2026-09-23 — `npm run qa:native:lifecycle -- --serial emulator-5554` — PASS — lifecycle 6/6 flows on exact `b227b34` APK; corrected Habit/Workout flows passed.
- 2026-09-23 — `npm run agent:plan:validate -- --plan .agent/execplans/production-closure-exact-head-cert-v1.md`; `npx vitest run --project unit tests/agent-execplan.test.ts` — PASS — active plan valid; focused agent workflow suite 9/9.
- 2026-09-23 — `npx prettier --check .agent/execplans/production-closure-exact-head-cert-v1.md`; `git diff --check`; `npm run qa:affected` — PASS — docs-only impact maps to `qa:fast` + focused ExecPlan test; planned broad `qa:full` supersedes that gate.
- 2026-09-22 — cheap-gate chain (typecheck → lint → validate:themes → openspec:validate) — PASS — only `GATE_FAIL:test` on first attempt.
- 2026-09-22 — isolated re-run of the 2 timed-out tests — PASS — 25/25; classified FLAKY_TEST (host-load), assertions unchanged.
- 2026-09-22 — full `npm test` clean re-run — PASS — 2248/2248, EXIT 0.
- 2026-09-22 — dependency/security audit evidence (read-only) — 29 advisories (0C/10H/18M/1L all; 9H in prod tree), 9 of 10 highs fix-now-safe on SDK 55; expo-doctor 19/20; CI audit comment stale — recorded for Phase 8.
- 2026-09-22 — `git merge-base --is-ancestor ac60e78 cf50f8a` — FALSE — badge defect post-dates the billing-blocked run's tree; rerun safe.
- 2026-09-22 — commits `3d02e4e` + `1c3487d` pushed (`691d2a2..1c3487d`); push run `35743212617` created.
- 2026-09-22 — `gh run rerun 34511232099` — quality ladder green through Validate versioned ExecPlans; Test 2000/1 failed/1 skipped (lone failure = `2447787`-fixed POSIX oracle, absent from `cf50f8a`); e2e/nightly skipped. Evidence closes repository-completion→COMPLETED.
- 2026-09-22 — push run `35743212617` re-run `--failed` after concurrency cancellation — quality job **SUCCESS** (typecheck, deno, lint, themes, openspec, Validate versioned ExecPlans, Test, advisory audit all green) at `1c3487d`.
- 2026-09-22 — six readiness guard tests reading `app-store-readiness.md` — PASS 31/31 after provenance edits.
- 2026-09-22 — `agent:plan:validate:all` after Phase-2 edits — PASS (repository-completion valid as COMPLETED).
- 2026-09-22 — Phase-2 commit `9104c5b` created locally (4 files: three plan reconciliations + readiness doc).
- 2026-09-22 — Phase 3 (candidate `9104c5b`) static/contracts — PASS — typecheck 0, lint 0/0, validate:themes (140 checks), openspec:validate 59/59, agent:plan:validate:all PASS, qa:impact:validate PASS.
- 2026-09-22 — Phase 3 unit+integration `npm test` — first attempt 1 failed / 2229 passed / 18 skipped with `restore.coordinator` beforeAll hook timeout (10s) — FLAKY_TEST host-load (same class as Phase-1 timeouts, parallel with CI watcher); clean re-run PASS 2248/2248 (223 files, EXIT 0).
- 2026-09-22 — Phase 3 `qa:fast` attempts 1–2 — FAIL (FLAKY_TEST under 97% host load from unrelated pi-coding-agent): attempt 1 `restore.coordinator` hook timeout; attempt 2 same + `accountRemoteFingerprint` 5s timeout; typecheck+lint green inside both attempts; web:verify port/NaN lines are intentional CLI-negative-test stderr noise. Isolation check of the 2 failed files + load-aware retry launched.
- 2026-09-22 — CI e2e job `35743212617` — **233 passed / 1 failed** (25.9m): `workout-gym-v2` "runs bodyweight, timed, and cardio modalities with typed results" — `locator.fill` 60s ×3 attempts waiting for builder textbox `Rest (seconds)`; error-context page snapshot (artifact `e2e-report`) shows live accessible name `Rest (seconds, 0 = no rest)` (product label `RoutineExerciseCard.tsx:382`). Classified TEST_BUG (selector drift from intentional rest-0 copy change), not a product defect; sole stale occurrence repo-wide; fixed by exact-name update in `e2e/workout-gym-v2.spec.ts:319`, assertions unchanged. `Upload dist-sync build artifact` failed consequentially after the e2e step.
- 2026-09-22 — prettier --check + full typecheck + lint re-run after the spec fix — launched (task `bash-061a18c2bc23ce9f`).
- 2026-09-22 — `gh pr list` / `gh issue list` — PASS — none open.
- 2026-09-22 — load-aware qa:fast runner #1 — TIMED OUT after 75 min of CPU wait (never ≤ 60%; samples 88–100% from unrelated neighbor process); qa:fast never executed; relaunched with 180-min deadline (task `bash-f1ff4190783c02cd`).
- 2026-09-22 — spec-fix re-validation — PASS — tsc EXIT 0 (multiline draft), then prettier --check 0 + eslint 0 after single-line reflow (tasks `bash-061a18c2bc23ce9f`, `bash-0c60c992c50b1127`); file-scoped reflow is AST-equivalent so full-tsc result stands; CI quality job re-runs typecheck on `cc6889a` anyway.
- 2026-09-22 — commit `cc6889a` + push `1c3487d..cc6889a` — PASS — 2 files (spec fix + this plan), tree clean, lint-staged prettier/eslint hooks green; push run `35749583938` created (in progress).
- 2026-09-22 — load-aware qa:fast runner #2 (180-min deadline) — TIMED OUT at ~30 min (apparent background-task lifetime cap) with CPU still 90–100% every sample for 2+ h total; calm-CPU strategy abandoned; process audit shows hogs = neighbor `node` PID 111928 (pi-coding-agent) + user `javaw` — none ours, none killed; no orphaned runners of ours found.
- 2026-09-22 — CI run `35749583938` quality job — **SUCCESS** at `cc6889a` (typecheck/lint/themes/openspec/plan-validate/Test/audit on clean runner); e2e job in progress; nightly skipped (push run).
- 2026-09-22 — Phase 3 qa:fast attempt 3 (under load) — FAIL (exit 1) — identical 2-file signature: `tests/accountRemoteFingerprint.test.ts` 1 failed (5530ms) + `tests/restore.coordinator.test.ts` hook-timeout (file failed, test ↓ skipped); Test Files 2 failed / 144 passed; Tests 1 failed / 1858 passed / 18 skipped; typecheck+lint green inside qa:fast (they precede unit). Classification: FLAKY_TEST-under-host-load (same two sites as attempts 1–2; both passed isolation 22/22 earlier). Isolation re-run launched for reconfirmation.
- 2026-09-22 — Phase 3 qa:timezones — **PASS** (4 files, exit 0).
- 2026-09-22 — isolation re-run of the 2 qa:fast-attempt-3 failures — **PASS 22/22** (3.98s, exit 0: accountRemoteFingerprint 4/4 + restore.coordinator 18/18) — FLAKY_TEST-under-load classification reconfirmed (third confirmation). qa:fast evidence = 3 failed attempts with identical 2-file load signature + typecheck/lint green in every attempt + isolation green + CI quality Test green on clean runner; no assertion weakened, no ceiling raised.
- 2026-09-22 — Phase 3 build:web + web:verify + web:hygiene — **PASS** (all exit 0; `PHASE3_BUILD_WEB: PASS`; ports 8081/8082 free after cleanup; expo-notifications web warnings are benign/built-in).
- 2026-09-22 — Phase 3 focused modalities repro (`npx playwright test --project=chromium e2e/workout-gym-v2.spec.ts -g "modalities"`, fresh `dist/`) — **PASS 1/1** (33.6s, exit 0) under 99% host load — local RED→GREEN for the pushed selector fix (`cc6889a`).
- 2026-09-22 — CI push run `35749583938` at `cc6889a` — **SUCCESS (full run)** — quality job green (re-verifying static/unit/plan-validate on clean hardware) + **e2e job green** (the lane that failed 233P/1F pre-fix) + nightly skipped by design. Selector fix confirmed in CI; CI fully green on the certification candidate for the first time this campaign.
- 2026-09-22 — Overnight superset directive (§0–40) received and persisted to `.agent/EXECUTION_PROMPT.md` (predecessor in Git history); goal created; plan Scope widened (§32 adversarial review, §34 terminal conditions, successor loop, §36 report).
- 2026-09-22 — Phase 3 local E2E chunk 1/3 `--project=chromium` — **PASS 152 passed / 7 skipped / 0 failed** (29.4m, exit 0) at `cc6889a` under 99% host load.
- 2026-09-22 — Phase 5/6/7/8 static preflight (read-only subagent) — captured: `supabase:schema:validate` + ~19 sync/backup/restore/portable/account integration files repo-executable offline; live lanes gated by `SUPABASE_ACCESS_TOKEN` (CI gate ci.yml:346–357, disposable `simulation/backend/`); iOS runtime = EXTERNAL BLOCKER on Windows per `docs/testing/native-e2e.md:163–324`, static = version-build-consistency test + app.json/eas.json fields verified (bundle `com.dale16.superhabits`, buildNumber 1, versionCode 1, version 1.0.0); store = 7 guard tests identified, 54 OWNER ACTION matches in `docs/release/`, **no `v1.0.0` tag exists**, `public/privacy.html` present; audit live-confirmed 29 all / 26 prod (0 critical, 10H/9H) matching ledger line 90; stale CI audit comment confirmed at `ci.yml:98–106`. Full detail in conversation; gaps → Phases 5/7/8 execution.
- 2026-09-22 — native preflight subagent attempt 1 — FAILED (task-tool internal error, not an investigation failure); retry attempt 2 **completed**: Nitro_API_36 = API-36/default/x86_64, pixel_7, 4 cores, 1536M (config.ini confirmed); toolchain Maestro 2.9.0 + Java 17 + adb/emulator + EAS CLI 18.5.0 + portable Node 22; `android/` prebuild present with gradlew; existing `native-android-build.json` = PASS for **stale source `7fa57902`** (APK `3A79016D…C8F88`, 50,535,264 B, 2026-09-14) — on-disk APK stale for `cc6889a`, provisioner must rebuild (`--force`); 27 Maestro flows; **zero native evidence for `cc6889a`**; Phase-4 blockers = dirty `.agent/` tree (clean-tree gate) + no booted target (`adb devices` empty); boot test intentionally skipped by read-only mandate.
- 2026-09-22 — Phase 3 local E2E chunk 2/3 `--project=journeys` — **2 failed / 98 passed / 6 skipped / 4 did-not-run** (10.8m, exit 1) at `cc6889a`: (1) `C — Temporary account T…imported-owner recovery` step 2 — `toBeVisible` 10s timeout at journey helper ~line 482; (2) `P2 — Tom…D14` step 3 — `section switch overview→todos 855ms > D14 ceiling 800ms` = exact known-gap-15 signature. Both journeys **passed on CI clean runner in run 35749583938 at the same SHA**. Isolation `--last-failed` rerun launched for classification.
- 2026-09-22 — journey-failure classifications (isolation evidence, assertions unchanged): **(1) FLAKY_TEST-under-load** — C journey standalone `-g "Temporary account T"` **PASSED 2/2 (27.7s)** including the failing step; full-suite 10s visibility timeout under 99% CPU; also green on CI clean runner. **(2) FLAKY_TEST-under-load (known-gap 15 / J8 class)** — D14 step 3: full-suite mode = `855ms > 800ms` ceiling (documented gap-15 signature, J8 plan records 811–1137ms under load on this host and 662ms full-pass when calmer); isolation mode = different load symptom `Test timeout 120000ms exceeded / browser closed` at `three-months-in.spec.ts:757` after 2.0m (CPU starvation of HEAVY seeding); **passed on CI clean runner at same SHA**; J8 attribution = harness ~31% + browser layout ~53% + app JS ~16% with no app hotspot; ceilings/floors preserved, no thresholds touched, no assertions weakened. Host CPU 90–100% throughout (neighbor `node` PID 111928 + user `javaw`).
- 2026-09-22 — Phase 9/11 static preflight (read-only subagent) — J8 plan `j8-section-switch-headroom-v1.md` COMPLETED evidence-only (all [x]; runs 767/691/662/697; CDP split harness ~31% / browser ~53% / app ~16%, top app fn 2.3%; thresholds + gap-15 floor/ceiling preserved by design; jitter band 662–767 = gap-15 class); gap-15 wording in `docs/testing/known-gaps.md` = expected-env with re-verify rule intact; Phase-11 facts: `SupabaseSyncAdapter.pull()` returns `[]` stub (asserted `core/sync/__tests__/supabase.adapter.test.ts:391–395`), push-only boundary authoritative in knowledge-base/core-context/working-rules/`supabase/README.md`; command edge functions `parse-ai-command` + `user-ai-ask` exist with `_shared/aiSecurity.js`; three openspec changes archived in `e7a456d`; unknowns = env-file command values (unread by policy) + W8-1 detail in `certification-infrastructure-v2.md`.
- 2026-09-22 — Phase 3 local E2E chunk 3/3 `--project=simulation --project=pwa` — **PASS 8/8** (4.7m, exit 0). Local full-E2E tally at `cc6889a`: chromium 152P/7S/0F; journeys 98P/2F (both classified FLAKY_TEST-under-load with isolation + CI-green evidence) /6S/4DNR; simulation+pwa 8P/0F; focused modalities 1P. CI e2e lane fully green at same SHA.
- 2026-09-22 — native inventory — PASS — adb attached (Nitro_API_36 et al.), Maestro 2.9.0, gh present; portable Node 22.23.2 present.
- 2026-09-23 — Git preflight after required fetch — PASS — branch `main`; `HEAD == origin/main == cc6889af2eba707cfbbf17792888f63a74b489af`; only `.agent/EXECUTION_PROMPT.md` and this ExecPlan are modified; `stash@{0}: pre-recovery-local-changes` preserved; one worktree.
- 2026-09-23 — `gh run view 35749583938` — PASS — exact head `cc6889af2eba707cfbbf17792888f63a74b489af`; `quality` and `e2e` jobs SUCCESS; nightly skipped by design; no active CI runs on `main` at checkpoint.
- 2026-09-23 — CI run `35749583938` quality log — PASS — 223 test files; 2247 passed / 1 skipped (2248 total); typecheck, Deno function checks, lint, themes, OpenSpec, versioned ExecPlans, and advisory runtime audit steps all succeeded.
- 2026-09-23 — CI run `35749583938` e2e log — PASS — full main E2E; deterministic library all 23 scenarios passed; `dist-sync` build and `e2e:sync` succeeded; sync journey result 40 passed / 6 skipped.
- 2026-09-23 — `npm run sim:validate` — PASS — 13 personas, 7 workflows, 23 scenarios; model and `apiLeg` guards clean.
- 2026-09-23 — Android preflight (`adb devices -l`, `emulator -list-avds`) — PREFLIGHT — canonical `Nitro_API_36` AVD is installed (API 36, x86_64 from existing config); no Android device is booted; old artifact source `7fa57902` remains stale and will not be used.
- 2026-09-23 — `npm run qa:affected` — PASS — campaign prompt/ExecPlan map to `agent-workflow-and-documentation`, `qa:fast`, and `tests/agent-execplan.test.ts`; broad regression is not required by the impact map.
- 2026-09-23 — `npm test -- tests/agent-execplan.test.ts` — PASS — 1 file, 9 tests.
- 2026-09-23 — `npm run qa:fast` — PASS — typecheck, lint, unit suite (146 files, 1877 tests), journey-label parity, and quarantine-register parity all green; expected negative-case `web:verify` stderr remained inside passing tests.
- 2026-09-23 — `git push origin main` — PASS — pushed documentation checkpoint `b3bc73c`; exact push run `35769774260` is active and must be allowed to finish before any subsequent push.
- 2026-09-23 — owned Nitro headless boot preflight — ENVIRONMENT (recovered) — ADB transport appeared (`emulator-5554`, API image x86_64); `getprop sys.boot_completed` and emulator-console command remained unresponsive for more than seven minutes, QEMU idle state did not advance, and WHPX check passed. Probe sessions were stopped; exact campaign-owned PIDs 57140/115868 were verified and stopped, then the repository runner booted the target successfully (see next entry).
- 2026-09-23 — `npm run qa:native:android -- --avd Nitro_API_36 --no-provision --no-stop --boot-timeout 180` — PREFLIGHT — repository runner booted and owns `emulator-5554`; live ADB confirms boot complete, AVD Nitro_API_36, API 36, ABI x86_64. It produced a `BLOCKED/ENVIRONMENT` report before Maestro because no app was installed (expected with `--no-provision`); `sourceTreeClean=true`, source SHA `50eceb2d14ffba41fa3d7071bb92b6855cea10b1`; emulator left running for the explicit force build.

## Changed Files / Areas

- `.agent/EXECUTION_PROMPT.md` — ACTIVE campaign handoff; replaced again 2026-09-22 with the overnight superset directive (predecessors survive in Git history).
- `.agent/execplans/production-closure-exact-head-cert-v1.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, `.agent/EXECUTION_PROMPT.md`, this plan.
2. `git status --short`, `git log --oneline -8`, `git stash list` (stash is foreign — preserve), `git fetch origin`.
3. Run `npm run agent:resume -- --plan .agent/execplans/production-closure-exact-head-cert-v1.md`; reconcile checkpoint (Git wins).
4. Prefix PATH with `%LOCALAPPDATA%\tools\node-v22.23.2-win-x64` for every gate; prettier edited files before lint.
5. Continue only from `Exact next action`; checkpoint this plan at every phase boundary, failure, decision, and before finishing.
6. Per-phase QA escalation: `npm run qa:affected` + `docs/testing/autonomous-qa.md`.

## Outcomes & Retrospective

- Status: Active.
- Summary: Phase 0 reconciled; campaign opened at 691d2a2 with CI defect confirmed and Phase 1 in flight.
- Follow-up: fill in at campaign close with the required terminal report.
