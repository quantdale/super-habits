# ExecPlan: Release Candidate Native Performance Closure

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Certify SuperHabits at a release-candidate-quality baseline on the exact current HEAD: every repository-caused failure fixed, performance uncertainty answered with distribution evidence, native status made precise, production remote state converged where access permits, docs matched to source, recovery invariants re-proven, and green GitHub quality+e2e bound to the exact pushed SHA — then select and begin the next highest-value product campaign from a fresh gap audit.

## Context

- Repository `quantdale/super-habits`; the certified pushed HEAD is `e6c540ddcd838e7e261ab83b5ed9d3e082ebe1ce` on `main`, equal to `origin/main`.
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

- Current milestone: Release-candidate closure and the Weekly Review Cadence Loop are complete and certified on the exact pushed HEAD.
- Completed: Historical RC milestones M1–M10 are preserved in this plan; the controlled React Native Web numeric-input race is fixed with one atomic `fill` plus a value assertion; local broad validation is green; and GitHub Actions run `32641380303` is green for this exact SHA across quality, main E2E, full deterministic scenarios, dist-sync, and the 46-test sync-boundary lane.
- In progress: None. The completed campaign is ready for archival when requested.
- Important modified files: `simulation/runner/actions.ts`, Weekly Review backup/settings/scheduler/UI/tests, simulation report/runner diagnostics, the settings-ripple journey, and the two ExecPlans.
- Last successful validation: Node `v22.23.2` matches `.nvmrc`; fresh `npm run build:web` PASS; all 22 deterministic simulation scenarios PASS; the isolated deterministic reproducibility test passes 3/3 on `E2E_PORT=8083`; the complete four-project E2E run passes 183/227 with 44 expected skips and 0 failures; and the exact remote run records quality success, main E2E success, 22/22 scenario success, dist-sync success, and 46/46 sync success. In the local full run, self-test 3.5 passed in 2.1 minutes and schema test 4.4 passed in 3.0 minutes after replacing clear-plus-type with one `fill` followed by `toHaveValue`; the remote run uploaded e2e, simulation, and dist-sync artifacts successfully.
- Failures: Historical run `32635670615` at `5f6f062` exposed the resolved race: requested `target=3` became `target_per_day=31` during `createHabit`. The corrected exact SHA has no CI failures. Native smoke/persistence/lifecycle remain ENVIRONMENT-blocked because no e2e-test APK is installed. Repository-wide `format:check` reports 68 pre-existing non-campaign markdown/YAML files; touched files pass targeted formatting.
- Relevant quarantines: None for the current investigation; prior CI classifications are historical evidence and will be replaced or confirmed with fresh runs.
- Blockers: None for campaign completion. Native smoke/persistence/lifecycle evidence remains environment-blocked and is recorded honestly.
- Condition required to unblock: N/A.
- Exact resume action after unblock: N/A.
- Exact next action: None; preserve the exact-SHA evidence and archive this completed change when requested.
- Remaining definition of done: completed Weekly Review OpenSpec tasks, default E2E + sync evidence, reconciled plans/docs, coherent push, and exact pushed-SHA quality/e2e verification as far as GitHub access permits; native environment blockers must remain recorded honestly.

## Progress

- [x] 1.1 Git reconciliation and plan discovery
- [x] 1.2 Reproduce CI plan-validation failure locally
- [x] 1.3 Repair checkpoint drift; all plans validate
- [x] 1.4 Campaign OpenSpec artifacts created
- [x] 2.x Fresh static/unit/integration/timezone/QA-config baselines (tasks 2.1–2.4)
- [x] 3.x Fresh web/sync builds + full E2E + deterministic simulation + e2e:sync
- [x] 4.x HEAVY performance distributions, attribution, and stable gate (tasks 4.1–4.5)
- [x] 5.x Android native current-build validation; iOS honest status (tasks 5.1–5.4; Android lanes explicitly ENVIRONMENT-blocked)
- [x] 6.x Supabase ledger/function/advisor audit (tasks 6.1–6.3; credential-gated items recorded honestly)
- [x] 7.x Documentation truth sweep (tasks 7.1–7.3)
- [x] 8.x Repository hygiene audit (tasks 8.1–8.2)
- [x] 9.x Recovery invariant re-proof (tasks 9.1–9.2)
- [x] 10.x Commit/push/exact-SHA CI verification; next-campaign selection + start (tasks 10.1–10.4; certified by run `32641380303` on `e6c540d`)

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
- 2026-08-23 — Local fresh-tree CI closure — PASS/ENVIRONMENT — typecheck, lint, unit 1,539/1,539, integration 206/206, P0 journeys 25/25, deterministic smoke 24/24; native smoke/persistence/lifecycle blocked because the Android package is not installed.
- 2026-08-23 — exact combined `npm run e2e` — PARTIAL/CLASSIFIED — 178 passed, 44 skipped, 4 did not run; one P2 HEAVY switch measurement observed 934 ms.
- 2026-08-23 — P2 HEAVY controlled repetition — PASS — N=10; RAF/performance.now measurement retained the 800 ms assertion and all repetitions passed (max switch 758 ms).
- 2026-08-23 — Deployment status — INFO — Vercel auto-deploy from main assumed per vercel.json; deployment-health verification requires dashboard/token access (access-gated, not fabricated).
- 2026-08-23 — `npm run qa:affected -- --files ...` — PASS — impact map selected the complete affected ladder and broad regression; all runnable gates were executed and native blockers were preserved as ENVIRONMENT.
- 2026-08-23 — Fresh `npm run build:sync` + `npm run e2e:sync` — PASS — 46/46 sync-boundary tests on a fresh dummy-credential export.
- 2026-08-23 — Fresh `npm run build:web` + exact `npm run e2e` — PASS — 183 passed, 44 expected skips, 0 failures across 227 tests; final P2 max switch 693 ms.
- 2026-08-23 — GitHub Actions run `32635670615` @ `5f6f062b15de332a3f06156f04c1802e68756a5f` — quality PASS; e2e FAIL with 182 passed, 44 skipped, and one test failure. Artifact inspection identified the deterministic lane's controlled numeric input race (`3` became `31` during clear-plus-type), not a product-state contamination failure.
- 2026-08-23 — Corrected deterministic reproducibility test, `--repeat-each=3` on `E2E_PORT=8083` — PASS — 3/3 after single-fill input synchronization and an explicit value assertion.
- 2026-08-23 — `npm run qa:simulation -- --all --mode deterministic` — PASS — fresh web export, 22/22 deterministic scenarios, including smoke and long-term history/recovery paths.
- 2026-08-23 — corrected full `npm run e2e` on `TZ=Asia/Manila`, `E2E_PORT=8083` — PASS — 183 passed, 44 expected skips, 0 failures across 227 tests; self-test 3.5 and 4.4 both passed in the full suite, and the HEAVY section-switch maximum was 766 ms against the unchanged 800 ms ceiling.
- 2026-08-23 — GitHub Actions run `32641380303` @ `e6c540ddcd838e7e261ab83b5ed9d3e082ebe1ce` — PASS — quality, main E2E, full deterministic scenario library (22/22), dist-sync build, and remote-boundary E2E (46/46) all succeeded; e2e-report, simulation-output, and dist-sync artifacts uploaded successfully.

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

- Status: Completed.
- Summary: CI closure diagnostics, Weekly Review completion, backup/settings V4 compatibility, performance measurement stabilization, broad local certification, and exact remote certification are complete on `e6c540ddcd838e7e261ab83b5ed9d3e082ebe1ce`.
- Follow-up: Archive this change when requested; native environment limitations remain documented rather than represented as passes.
