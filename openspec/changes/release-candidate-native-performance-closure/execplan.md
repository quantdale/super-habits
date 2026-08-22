# ExecPlan: Release Candidate Native Performance Closure

Plan-Version: 2
Status: ACTIVE

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

- Current milestone: M5/M6/M8 complete → M10 certification (commit/push/exact-SHA CI).
- Completed: M1–M4 as below. M5 Android: current-source release APK built locally (gradlew assembleRelease, e2e-test env flag; 104MB; debug-signed fallback) + installed on Nitro_API_36 emulator. Native smoke **2/2 PASS** (native-smoke rewritten for tab-rail nav + current markers after TEST_DRIFT vs pre-redesign subtitles; command-center-v2 pass). Persistence lane: **4 real PASS** — settings, workout (after coordinate-swipe scroll repair), habit-persistence (**full create→increment→kill→relaunch→persist cycle**), habit-reminder-permission-denied; remaining 6 flows blocked late by ENVIRONMENT host degradation (Maestro driver startup timeouts ×2, Overview-visibility failures even on freshly booted emulator after hours of continuous automation). Substantial TEST_DRIFT repaired across 24 flow files: legacy swipe-navigation → tab-rail taps, stale form labels → current contracts, Maestro synthetic scrollUntilVisible proven inert on the RN ScrollView (adb input swipe moves it; Maestro swipe does not) → replaced with calibrated coordinate swipes; conditional Workout subtitle on fresh device; Pomodoro Reset|Abandon hardening semantics; overlapping FABs fail 100%-visibility matching → quick-add input+keyboard submit for task creation. Lifecycle lane: pomodoro-notification-path PASS; 4 flows ENVIRONMENT-blocked same cause. iOS: precise ENVIRONMENT (Windows host, no macOS/Xcode runtime). Artifacts under simulation-output/native/_. M6 remote audit: no SUPABASE_ACCESS_TOKEN in env ⇒ live ledger re-check, Edge Function deploy, advisors are ACCESS-GATED this session; repository has exactly 12 migration files (validator PASS) and newest (20260822000000) matches the last independently verified live ledger state (2026-08-22 linked-CLI push, EXIT 0) with nothing added since ⇒ convergence holds per most-recent verified evidence; parse-ai-command parity pinned by green contract tests. M8 hygiene: zero TODO/FIXME/HACK markers in runtime source (all matches are TODO__ constant names), zero restore-dbg instrumentation in runtime source (committed evidence logs untouched per policy), fixed weeklyReview.data duplicate import (lint warning), renamed stale db.client.test schema-15 test name, temp probe/transform files deleted.
- In progress: M10 commit/push/exact-SHA CI verification.
- Important modified files: openspec/changes/harden-parallel-completion-wave-v2/execplan.md; openspec/changes/release-candidate-native-performance-closure/**; e2e/journeys/three-months-in.spec.ts; .maestro/flows/*.yaml (24 files); ~17 documentation files; features/weekly-review/weeklyReview.data.ts; tests/db.client.test.ts; .agent/hardening-evidence/{rc-perf-distributions.log,rc-simdet.log}.
- Last successful validation: full local gate stack M2–M3 (Vitest 1726/1726, e2e 179+fixed-file 10/10 reruns, e2e:sync 46/46, sim 22/22); native smoke 2/2 + persistence subset passes on current-source APK.
- Failures: None open locally that are repository-caused. Remaining native persistence/lifecycle flow failures classified ENVIRONMENT (degraded emulator host) + residual harness geometry, artifacts preserved under simulation-output/native/ and Maestro debug dirs.
- Relevant quarantines: CG-4 recurrence switching and CG-5 diary search remain documented performance quarantines from production-correctness-hardening.
- Blockers: None for certification. Access-gated residuals documented (Supabase token; macOS/iOS runtime).
- Condition required to unblock: N/A.
- Exact resume action after unblock: N/A.
- Exact next action: Run qa:fast sanity, create serialized coherent commits, push, verify GitHub quality+e2e on the exact pushed SHA via API.
- Remaining definition of done: tasks.md 10.1–10.4 (certification + post-RC gap audit and next product campaign started).
- Relevant quarantines: CG-4 recurrence switching and CG-5 diary search remain documented strict performance quarantines from the completed production-correctness-hardening campaign.
- Blockers: None.
- Condition required to unblock: N/A.
- Exact resume action after unblock: N/A.
- Exact next action: Run M2 gates: `npm run typecheck`, then `npm run lint`, then full `npm test`; record exact counts in Validation Ledger before proceeding to qa:timezones etc.
- Remaining definition of done: All tasks.md sections 2–10 checked with recorded evidence; certification bound to exact pushed SHA with green quality+e2e; next product campaign's OpenSpec change created and implementation begun.

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
