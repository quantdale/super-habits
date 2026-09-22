# ExecPlan: Production Closure, Exact-HEAD Certification, Platform Closure, and Release Readiness

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Take SuperHabits from `691d2a2` through production closure: restore trustworthy GitHub CI, reconcile stale governance state, certify the exact release-candidate SHA across static/unit/web/simulation/native lanes, close every repository-executable Supabase/iOS/store/dependency gap, publish an evidence-backed release verdict, and only then recommend (not implement) the strongest v2 direction.

## Context

- Planner handoff: `.agent/EXECUTION_PROMPT.md` (Status ACTIVE, Planned-From `691d2a2`); this plan is the task-state store for that campaign per `.agent/PLANS.md`.
- Baseline (verified 2026-09-22): `HEAD == origin/main == 691d2a2ef488c45d936f736d29ba81d7cea96150`, branch `main`, tree clean, single worktree, no open PRs/issues, `openspec list` → no active changes, OpenSpec validate 59/59 PASS.
- ExecPlan inventory: 1 BLOCKED (`repository-completion-and-truth-v1` — GitHub Actions billing), all others COMPLETED; `agent:plan:validate:all` exits 1 with exactly one FAIL: `workout-history-quick-log-badge.md` (COMPLETED with unchecked `- [ ] Single commit.`).
- CI truth (verified via `gh run view`): push run `35487607744` (691d2a2, 2026-09-20) never started jobs (billing annotation). Schedule run `35653305101` (2026-09-21) started jobs — billing recovered — and failed at exactly `Validate versioned ExecPlans`, skipping `Test`; e2e/nightly never ran. Both hypotheses from the handoff CONFIRMED; the plan-validate defect is the current live blocker.
- Badge-plan evidence: commit `ac60e78` exists on main and contains the full feature (QuickLogBadge, domain predicate, data counts query, list/detail wiring, tests — 8 files, +297). The checkbox was simply never ticked. Reconciliation is honest, not falsification.
- Host tooling: default `node` v24.3.0 violates engines (`>=22.22.1 <23`); portable Node 22.23.2 exists at `%LOCALAPPDATA%\tools\node-v22.23.2-win-x64` — prefix PATH for all gates (known-gaps E1: better-sqlite3 segfaults under Node 20; use 22, never 20/24 for integration). `adb` + many AVDs attached (Nitro_API_36 canonical), Maestro 2.9.0, `gh` available. Windows CRLF: `npx prettier --write` edited files before lint.
- Preserve: stash `stash@{0}: pre-recovery-local-changes` — never touch; no other branches/worktrees.
- Push policy for this campaign: normal push permitted (explicitly required to restore/verify CI); never force-push.

## Scope

Phases 0–11 of `.agent/EXECUTION_PROMPT.md`: CI restore; stale-plan reconciliation; exact-HEAD certification (static, unit/integration, qa:fast, timezones, build:web, web:verify/hygiene, full E2E, deterministic sim, dist-sync/e2e:sync, PWA); Android exact-build certification on Nitro_API_36; Supabase/cloud static closure (+ disposable lane only if credentials exist); iOS static readiness; store repository artifacts; dependency/security audit (no blind `audit fix --force`); release verdict at final SHA; v2 direction audit (sync vs AI Command Center) as recommendation only.

## Non-Goals

- No speculative v2 implementation; no feature churn; no two-way sync; no force-push/tag/store submission/production Supabase mutation; no test weakening; no fabrication of screenshots or iOS runtime claims; no touching the pre-existing stash.

## Current Checkpoint

- Current milestone: Phases 0–2 COMPLETE (`3d02e4e` + `1c3487d` pushed; `9104c5b` local); CI quality GREEN at `1c3487d`; CI e2e on `35743212617` concluded **233 passed / 1 failed** — root-caused to e2e selector drift (TEST_BUG) and fixed in the working tree; Phase-3 partial evidence at `9104c5b` (static/contracts + full `npm test` green); load-aware `qa:fast` retry and spec-fix re-validation running. Final candidate SHA = the upcoming spec-fix commit (test-only change).
- Completed: Phase 0 recon; Phase 1 badge-plan repair (`3d02e4e`) + campaign open (`1c3487d`), `agent:plan:validate:all` PASS, cheap gates PASS, full `npm test` 2248/2248 PASS, push `691d2a2..1c3487d`, CI run `35743212617` quality **success** (typecheck ✓ lint ✓ themes ✓ openspec ✓ **Validate versioned ExecPlans ✓** Test ✓ advisory audit ✓); Phase 2 reconciliations committed (`9104c5b`): `repository-completion-and-truth-v1` → COMPLETED with rerun evidence (billing-cleared `gh run rerun 34511232099`: quality ladder green through plan-validate; Test 2000/2002, lone failure = POSIX exitCode-oracle TEST_BUG fixed later by `2447787`, absent from `cf50f8a` by ancestry), `release-readiness-refresh-v1` checkpoint closed, `autonomous-campaign-thinning-stop-v1` blocker-1 push annotation, `app-store-readiness.md` provenance reconciled (table = latest per-gate re-runs through a11y closure; narrative = original release-readiness battery 136/104) + guard tests 31/31 PASS.
- In progress: (1) load-aware `qa:fast` + `qa:timezones` retry (task `bash-61388948a247de85`, waits CPU ≤ 60%); (2) prettier + typecheck + lint re-validation of the e2e spec fix (task `bash-061a18c2bc23ce9f`).
- Important modified files: `.agent/EXECUTION_PROMPT.md` (replaced completed predecessor), `.agent/execplans/production-closure-exact-head-cert-v1.md` (new), `.agent/execplans/workout-history-quick-log-badge.md` (checkbox reconciliation).
- Last successful validation: 2026-09-22 — CI `35743212617` quality job **success** at `1c3487d` (plan-validate + Test + audit all green); `agent:plan:validate:all` PASS (all 93 plans incl. repository-completion→COMPLETED); six readiness guard tests 31/31 PASS; earlier: cheap-gate chain PASS, `npm test` 2248/2248 PASS, Phase-0 `gh run view` evidence.
- Current failures: CI e2e job on `35743212617` had 1 failure — `workout-gym-v2` modality-tour fill hung on stale exact name `Rest (seconds)`; page-snapshot error-context proves live label `Rest (seconds, 0 = no rest)` (`RoutineExerciseCard.tsx:382`, intentional rest-0 copy change). Classified TEST_BUG (selector drift), sole stale occurrence repo-wide; `e2e/workout-gym-v2.spec.ts:319` updated to the exact new name, assertions unchanged; `Upload dist-sync build artifact` failed consequentially after the e2e step. Local qa:fast flakes remain FLAKY_TEST-under-host-load (isolation re-run 22/22 PASS).
- Relevant quarantines: None new; standing known-gaps 15 (J8 headroom floor) and capability gaps 1–20 unchanged.
- Blockers: None locally. External watch items: GitHub Actions billing (recovered as of 2026-09-21 schedule — must be re-confirmed on next push), iOS/macOS, SUPABASE_ACCESS_TOKEN, store credentials.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: when background validations land (prettier/tsc/lint on the spec fix; load-aware qa:fast/timezones), commit the spec fix + this plan update; then verify no CI run is in progress and `git push origin main` (lands `9104c5b` + fix). Then finish Phase 3 at the final SHA: build:web → web:verify → web:hygiene → focused `npx playwright test --project=chromium e2e/workout-gym-v2.spec.ts -g modalities` repro (must PASS) → full `npm run e2e` → sim:validate + sim:run deterministic → build:sync + e2e:sync (or documented skip) → PWA lane — recording every measured result before Phases 4–11.
- Remaining definition of done: entire campaign Phases 1–11 closed per EXECUTION_PROMPT terminal conditions; final report at exact final SHA.

## Progress

- [x] Phase 0 — reconstruct real current state (reads, plans, OpenSpec, GitHub, native inventory, fresh ExecPlan)
- [x] Phase 1 — restore CI truth (badge-plan fix → validate:all PASS → cheap gates → commit → push → CI run past plan-validate: quality SUCCESS at `1c3487d`)
- [x] Phase 2 — reconcile stale plans/repository truth (repository-completion→COMPLETED w/ rerun evidence, release-readiness-refresh closed, thinning-stop annotated, app-store-readiness provenance fixed — all in `9104c5b`)
- [ ] Phase 3 — exact-head release certification (candidate SHA pinned; full static/unit/web/sim/sync/PWA battery)
- [ ] Phase 4 — Android exact-build certification (provision → smoke → persistence → lifecycle on Nitro_API_36)
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

## Decision Log

- 2026-09-22 — Treat the pasted campaign as the ACTIVE execution prompt and persist it to `.agent/EXECUTION_PROMPT.md` (predecessor COMPLETED prompt survives in Git history) — matches PLANNER_HANDOFF protocol and gives future sessions a resumable handoff.
- 2026-09-22 — Badge-plan fix is checkbox reconciliation, not test/status falsification: feature commit `ac60e78` verified present with full implementation and recorded validation evidence.
- 2026-09-22 — Normal push is in-scope for this campaign (CI verification requires it); force-push and tag remain forbidden.
- 2026-09-22 — Classify the 2 gate test timeouts as FLAKY_TEST (host-load from parallel subagents), not PRODUCT_BUG: both pass in isolation and on an unloaded full re-run with no assertion changes (autonomous-qa.md rule: reproduce, classify, never weaken).
- 2026-09-22 — Phase 2 will rerun billing-blocked CI run `34511232099` (`cf50f8a` tree) rather than only watching the new push, because that plan's DoD is CI verification of ITS pushed tree; verified the badge defect cannot affect that rerun.
- 2026-09-22 — Never overlap CI triggers on the same ref: `gh run rerun 34511232099` concurrency-cancelled the in-progress push run `35743212617` mid-Lint (`cancel-in-progress: true`); resolved by re-running `--failed` after the first rerun settled, and by deferring the Phase-2 push until the current run's e2e finishes.
- 2026-09-22 — Close `repository-completion-and-truth-v1` COMPLETED with the rerun's evidence (its own latitude: "or close with the rerun evidence") instead of demanding green Test on `cf50f8a`, where the lone failure is a deterministic POSIX/Windows oracle difference fixed later by `2447787`.

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
- 2026-09-22 — native inventory — PASS — adb attached (Nitro_API_36 et al.), Maestro 2.9.0, gh present; portable Node 22.23.2 present.

## Changed Files / Areas

- `.agent/EXECUTION_PROMPT.md` — new ACTIVE campaign handoff (replaces completed predecessor).
- `.agent/execplans/production-closure-exact-head-cert-v1.md` — this plan.
- `.agent/execplans/workout-history-quick-log-badge.md` — Phase-1 honest checkbox/checkpoint reconciliation.

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
