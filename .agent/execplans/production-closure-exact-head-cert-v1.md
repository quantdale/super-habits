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

- Current milestone: Phase 0 COMPLETE; Phase 1 local work COMPLETE (repair + all cheap gates green); committing/pushing, then CI-watch remains.
- Completed: all Phase-0 reads; baseline verified; badge-plan reconciliation landed locally (checkbox ticked, checkpoint/ledger cite `ac60e78`); `agent:plan:validate:all` PASS; cheap-gate chain PASS (typecheck, lint `--max-warnings 0`, validate:themes, openspec:validate 59/59) under portable Node 22; `npm test` 2248/2248 PASS on clean re-run (first attempt had 2 timeouts in `qaNativeProvision` + `supabase.adapter` classified FLAKY_TEST — both pass in isolation 25/25 and on full re-run, assertions unchanged); dependency/security audit evidence gathered (29 advisories: 0 critical, 10 high — 9 fix-now-safe in-band, uuid/query-string clusters hold-for-Expo; expo-doctor 19/20; CI audit comment stale) for Phase 8.
- In progress: commit the two coherent Phase-1 commits, push normally, watch the new push run.
- Important modified files: `.agent/EXECUTION_PROMPT.md` (replaced completed predecessor), `.agent/execplans/production-closure-exact-head-cert-v1.md` (new), `.agent/execplans/workout-history-quick-log-badge.md` (checkbox reconciliation).
- Last successful validation: 2026-09-22 — `agent:plan:validate:all` PASS (post-repair); cheap-gate chain PASS; full `npm test` 2248/2248 PASS (EXIT 0); Phase-0 `gh run view` evidence captured.
- Current failures: none locally. The 2 first-run test timeouts are classified FLAKY_TEST (host-load; clean full re-run green).
- Relevant quarantines: None new; standing known-gaps 15 (J8 headroom floor) and capability gaps 1–20 unchanged.
- Blockers: None locally. External watch items: GitHub Actions billing (recovered as of 2026-09-21 schedule — must be re-confirmed on next push), iOS/macOS, SUPABASE_ACCESS_TOKEN, store credentials.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: `npx prettier --write` the three changed files, re-run `npm run agent:plan:validate:all` (must PASS), commit A `docs(agent): reconcile workout-history-quick-log-badge plan with landed ac60e78` (badge plan only) then commit B `docs(agent): open production-closure exact-head certification campaign` (EXECUTION_PROMPT + this plan), push normally, then `gh run list` the new push run and confirm quality progresses past `Validate versioned ExecPlans` with Test running; then start Phase 2 with `gh run rerun 34511232099` (billing-blocked run of `cf50f8a`; verified `ac60e78` is NOT its ancestor so the badge defect cannot recur there) and reconcile `repository-completion-and-truth-v1` from its rerun evidence.
- Remaining definition of done: entire campaign Phases 1–11 closed per EXECUTION_PROMPT terminal conditions; final report at exact final SHA.

## Progress

- [x] Phase 0 — reconstruct real current state (reads, plans, OpenSpec, GitHub, native inventory, fresh ExecPlan)
- [ ] Phase 1 — restore CI truth (badge-plan fix → validate:all PASS → cheap gates → commit → push → CI run past plan-validate)
- [ ] Phase 2 — reconcile stale plans/repository truth (esp. repository-completion-and-truth-v1 BLOCKED/billing, release-readiness-refresh-v1, thinning-stop-v1)
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

## Decision Log

- 2026-09-22 — Treat the pasted campaign as the ACTIVE execution prompt and persist it to `.agent/EXECUTION_PROMPT.md` (predecessor COMPLETED prompt survives in Git history) — matches PLANNER_HANDOFF protocol and gives future sessions a resumable handoff.
- 2026-09-22 — Badge-plan fix is checkbox reconciliation, not test/status falsification: feature commit `ac60e78` verified present with full implementation and recorded validation evidence.
- 2026-09-22 — Normal push is in-scope for this campaign (CI verification requires it); force-push and tag remain forbidden.
- 2026-09-22 — Classify the 2 gate test timeouts as FLAKY_TEST (host-load from parallel subagents), not PRODUCT_BUG: both pass in isolation and on an unloaded full re-run with no assertion changes (autonomous-qa.md rule: reproduce, classify, never weaken).
- 2026-09-22 — Phase 2 will rerun billing-blocked CI run `34511232099` (`cf50f8a` tree) rather than only watching the new push, because that plan's DoD is CI verification of ITS pushed tree; verified the badge defect cannot affect that rerun.

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
- 2026-09-22 — `gh pr list` / `gh issue list` — PASS — none open.
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
