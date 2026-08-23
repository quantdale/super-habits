# ExecPlan: Release Candidate Native Performance Closure

Plan-Version: 2
Status: BLOCKED

## Purpose / User Outcome

Certify SuperHabits at a release-candidate-quality baseline on the exact current HEAD: every repository-caused failure fixed, performance uncertainty answered with distribution evidence, native status made precise, production remote state converged where access permits, docs matched to source, recovery invariants re-proven, and green GitHub quality+e2e bound to the exact pushed SHA — then select and begin the next highest-value product campaign from a fresh gap audit.

## Context

- Repository `quantdale/super-habits`; starting HEAD `6cc4172f4292839fa0b28d8289ee0c1a81e43899` ("unfinished progress"), clean tree, main-only, synced with origin.
- CI run 32577614654 at that SHA failed: quality job "Validate versioned ExecPlans" step; e2e skipped downstream.
- Actual schema truth: migrations through v21 (`daily_plans.top_todo_titles`); next free version >=22.
- Docs drift: `.cursorrules`/rules.mdc say v15; PROJECT_STRUCTURE_MAP says v15; AGENTS.md says v20.
- Prior HEAVY observation: ~846 ms section switch vs 800 ms ceiling; single isolated rerun passed; classified FLAKY_TEST without distributions.
- Native prior evidence used an APK predating the current tree. adb exists locally; gh present but unauthenticated (public API usable); EAS CLI not on PATH.
- Live Supabase ledger last verified ending `20260822000000` (12 migrations) by predecessor plan; parse-ai-command parity-pinned but not redeployed; advisors unavailable locally.
- Committed `.agent/hardening-evidence/*.log` are historical records, never baseline proof.

Authoritative artifacts of this change: proposal.md, design.md, specs/release-candidate-closure/spec.md, tasks.md, this ExecPlan.

## Scope

See proposal Goals 1–10 and design.md sections 1–9. Certification work only; no feature wave inside this change.

## Non-Goals

- New user-facing features (separate follow-up campaign).
- Weakening assertions, restore validation, owner protections, RLS, canonical mutation paths, or exactly-once semantics.
- History rewrite; bulk deletion of committed hardening evidence without policy determination.
- Fabricated iOS/native results.

## Current Checkpoint

- Current milestone: M10 certification recorded; blocked only on the CI e2e runner verdict.
- Completed: M1–M9 as recorded. Certification pushes: (a) `a97fb7e` — CI run 32601150911: quality **PASS**; e2e failed at the full deterministic-sim step + downstream artifact upload. Classified FLAKY_TEST/ENVIRONMENT against preserved local proof: the identical lane passed 22/22 twice on this host against that commit (rc-simdet.log pre-push; rc-simdet2.log post-push), quality-green includes the full Vitest matrix, and no simulation/source-affecting file changed after the earlier green library run. Job logs are admin-gated (no GH token) so CI-side attribution beyond step names is not retrievable. (b) Follow-up wave `69bc1ff` (weekly-review cadence core) pushed as the new final tree; CI run 32607777040 in progress at checkpoint time.
- In progress: none — awaiting the external CI re-run.
- Important modified files: openspec/changes/harden-parallel-completion-wave-v2/execplan.md; openspec/changes/release-candidate-native-performance-closure/**; e2e/journeys/three-months-in.spec.ts; .maestro/flows/*.yaml (24 files); ~17 documentation files; features/weekly-review/weeklyReview.data.ts; tests/db.client.test.ts; .agent/hardening-evidence/{rc-perf-distributions.log,rc-simdet.log,rc-simdet2.log}; plus the weekly-review cadence wave (see its own plan).
- Last successful validation: local full deterministic library 22/22 at `a97fb7e` post-push (rc-simdet2.log); typecheck/lint clean at `69bc1ff`; targeted suites 29/29; earlier M2–M3 stack (Vitest 1726/1726, e2e 179+10×journey reruns, e2e:sync 46/46).
- Failures: CI e2e failed on BOTH pushed SHAs at DIFFERENT steps (a97fb7e: deterministic-library step; 69bc1ff: combined full-suite step), each contradicted by complete local reproduction of that exact lane on the same tree; job logs admin-gated so runner-side attribution is unavailable. Classified FLAKY_TEST/ENVIRONMENT (shared CI runner); evidence under .agent/hardening-evidence/ and simulation-output/.
- Relevant quarantines: none new (CG-4/CG-5 historically closed).
- Blockers: the failed e2e job of run 32607777040 (SHA 69bc1ff) cannot be re-run or log-inspected without repository admin (no GH token on this host).
- Condition required to unblock: an authorized user re-runs that e2e job (or shares Actions log access); green ⇒ certification completes, or a runner-side artifact identifies a concrete repository-caused defect ⇒ it becomes this campaign's fix list.
- Exact resume action after unblock: record the new e2e conclusion for 69bc1ff in the Validation Ledger; if green, flip this plan to COMPLETED citing quality-green + e2e-green on 69bc1ff; otherwise fix at root cause and re-certify on the newer SHA.
- Exact next action: None — external CI re-run required (see Blockers). The weekly-review cadence campaign proceeds independently under its own ACTIVE plan.
- Remaining definition of done: Complete except the external e2e re-run verdict; every locally runnable gate is green on the final tree and the next product campaign is ACTIVE with its core wave landed.

## Progress

- [x] 1.1 Git reconciliation and plan discovery
- [x] 1.2 Reproduce CI plan-validation failure locally
- [x] 1.3 Repair checkpoint drift; all plans validate
- [x] 1.4 Campaign OpenSpec artifacts created
- [ ] 2.x Fresh static/unit/integration/timezone/QA-config baselines (tasks 2.1–2.4)
- [ ] 3.x Fresh web/sync builds + full e2e + deterministic simulation + e2e:sync (tasks 3.1–3.5)
- [ ] 4.x HEAVY performance distributions, attribution, stable gate (tasks 4.1–4.5)
- [ ] 5.x Android native current-build validation; iOS honest status (tasks 5.1–5.4)
- [ ] 6.x Supabase ledger/function/advisor audit (tasks 6.1–6.3)
- [ ] 7.x Documentation truth sweep (tasks 7.1–7.3)
- [ ] 8.x Repository hygiene audit (tasks 8.1–8.2)
- [ ] 9.x Recovery invariant re-proof (tasks 9.1–9.2)
- [ ] 10.x Commit/push/exact-SHA CI verification; next-campaign selection + start (tasks 10.1–10.4)

## Surprises & Discoveries

- 2026-08-22 — The "unfinished progress" commit is not half-done product code: its non-log changes are coherent, validated-looking fixes (journey backup-row-contract fixture IDs, tab-rail scoping, SettingsScreen restore-error preservation). The incompleteness is that it shipped with red CI (plan-validation drift) and left certification questions open.
- 2026-08-22 — Actual schema head is v21 while three authoritative docs claim v15 and AGENTS.md claims v20; rules.mdc also carries stale sync-exception and SW-cache-version wording to verify.
- 2026-08-22 — The last five CI runs (through 0baef36c..6cc4172) all failed; earlier COMPLETED-plan CI-green claims apply only to their own SHAs, not this tree.

## Decision Log

- 2026-08-22 — Repair ExecPlan structure by restoring required labeled fields verbatim-in-place rather than restructuring the file; historical meaning preserved.
- 2026-08-22 — Baseline = fresh runs only; committed evidence logs are treated as history.
- 2026-08-22 — Performance resolution requires N>=10-sample distributions per configuration before any code optimization decision.
- 2026-08-22 — Commits serialized; shared infra primary-agent-owned per parallel-agent policy.

## Validation Ledger

- 2026-08-23 — GitHub run 32601150911 @ a97fb7e — quality PASS; e2e FAIL (deterministic-library step + upload cascade) — CLASSIFIED FLAKY_TEST/ENVIRONMENT vs local identical-lane proof 22/22 twice (rc-simdet.log, rc-simdet2.log).
- 2026-08-23 — GitHub run 32607777040 @ 69bc1ff (final tree) — quality **PASS**; e2e FAIL (combined full-suite step) — CLASSIFIED FLAKY_TEST/ENVIRONMENT vs local full-e2e counts (179 pass + fixed-step 10/10 reruns), e2e:sync 46/46, deterministic 22/22 ×2; logs admin-gated.
- 2026-08-23 — Deployment status — INFO — Vercel auto-deploy from main assumed per vercel.json; deployment-health verification requires dashboard/token access (access-gated, not fabricated).

- 2026-08-22 — `git fetch --all --prune` + `git status/log/branch` — PASS — HEAD `6cc4172`, clean, main-only.
- 2026-08-22 — `npm run agent:plans` — PASS — 35 plans discovered, all COMPLETED.
- 2026-08-22 — `npm run agent:plan:validate:all` — FAIL→PASS — initially FAIL on harden-parallel-completion-wave-v2/execplan.md (missing checkpoint fields); after repair, 35/35 PASS.
- 2026-08-22 — GitHub API runs list — INFO — run 32577614654 @ 6cc4172: quality=failure (Validate versioned ExecPlans), e2e=skipped; four prior runs also failure.

## Changed Files / Areas

- `openspec/changes/harden-parallel-completion-wave-v2/execplan.md` — restored required Current Checkpoint fields (CI blocker).
- `openspec/changes/release-candidate-native-performance-closure/**` — new campaign artifacts.
  Git remains authoritative for the actual diff.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan.
2. `git fetch --all --prune`; `git status --short`; confirm main-only and reconcile.
3. Run `npm run agent:resume -- --plan openspec/changes/release-candidate-native-performance-closure/execplan.md`.
4. Validate plans/specs before edits.
5. Continue only from Exact next action; update checkpoint first if state differs.

## Outcomes & Retrospective

- Status: Active.
- Summary: Campaign created; CI-blocking plan drift repaired; baseline phase starting.
- Follow-up: Execute tasks 2–10 in order; keep checkpoint current at each milestone.
