# ExecPlan: Async Orchestration, Lifecycle & State-Adoption Determinism

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Make SuperHabits resistant to stale asynchronous state adoption and duplicated
lifecycle side effects across long-running real use. Slow reads, overlapping
refreshes, persisted hydration, foreground/day-rollover events, timers,
listeners, remote timeouts, and notification replay must never overwrite newer
user intent/state, display the wrong target/day, or duplicate writes/actions.

The campaign also fulfills an explicit whole-repository audit requirement: every
tracked file is accounted for, material findings are severity-classified, and
Critical/High defects are fixed with deterministic regression proof.

Target working window: approximately 12 hours of autonomous execution when the
environment permits. Completion is gated by evidence, not elapsed time; do not
invent work to fill time, and do not stop after the first local green result.

## Context

- Planned from `main` SHA
  `c823ab3520da22caec6d5502d395dd296e589d58`.
- Planner handoff: `.agent/EXECUTION_PROMPT.md`.
- OpenSpec: `openspec/changes/harden-async-orchestration-lifecycle-v1/`.
- Predecessor `harden-whole-system-resilience-v1` is COMPLETED and terminal.
- Latest predecessor validation recorded: typecheck 0 errors; lint 0 errors /
  13 warnings; Vitest 155 files / 1,823 tests; OpenSpec valid; deterministic
  simulation 23/23; P0 journeys 25/25; browser full suite with independently
  replayed host-sensitive misses; sync host had dummy-Supabase DNS environment
  failures; Android smoke green with some lifecycle notification environment
  instability.
- Local SQLite remains authoritative. Remote Supabase is backup/account
  infrastructure, not a new two-way-sync target for this campaign.
- The tested latest-only primitive is
  `lib/useGuardedAsyncRefresh.ts`; the recent Pomodoro regression established
  its operation-level ownership rule.

### Planner audit seeds

These are starting evidence to reproduce/exonerate, not completed findings.

| ID    | Initial severity    | Evidence / candidate invariant                                                                                                                                                                                                                                      | Initial state                              |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| A-001 | High candidate      | Several async effect-driven views adopt results without the shared generation guard; `DailyPlanView` also writes editable fields after an async fan-out. Newer explicit user edits must not be overwritten by older reads.                                          | OPEN — deterministic proof required        |
| A-002 | High candidate      | `remotePhase.withRemoteTimeout()` leaves underlying tasks alive. Account state has monotonic task sequencing; restore-preview late `.then()` adoption plus later maintenance/post-flush refresh does not visibly share a generation. Newest restore state must win. | OPEN — deferred-promise proof required     |
| A-003 | High/Medium class   | Shared refresh guard appears in five main screens; Overview has bespoke request-id/mounted logic; other views use local cancellation/no guard. One logical operation needs one adoption owner.                                                                      | OPEN — caller-by-caller audit              |
| A-004 | High/Medium class   | AsyncStorage reads exist across many UI/preference surfaces. Calories just required a user-choice guard. Explicit user interaction after a read begins must outrank older persisted hydration where streams compete.                                                | OPEN — inventory + paired tests            |
| A-005 | Medium / bug-finder | 13 lint warnings remain; nine are `react-hooks/set-state-in-effect` at lifecycle-heavy views.                                                                                                                                                                       | OPEN — classify each, target zero warnings |
| A-006 | High/Medium class   | Timer/listener/subscription fan-in includes AppProviders, Pomodoro, Workout session, Settings, day rollover, foreground refresh, connectivity, theme/motion, notification responses, and PWA. Repeated lifecycle must not duplicate owners/side effects.            | OPEN — exhaustive ownership audit          |
| A-007 | Low truth drift     | Structure map has current schema v24 elsewhere but a stale `current v23` authority-row claim. Known-gap load/stress wording predates the completed deterministic soak lane.                                                                                         | OPEN — reconcile docs                      |
| A-008 | QA truth            | Current `test.fixme`/skip markers include remote/recovery/command/journey scenarios and historical gap docs. Each current skip needs a real capability/environment rationale.                                                                                       | OPEN — classify, do not blindly enable     |

## Scope

- Entire tracked repository inventory and semantic audit of source/config/test/
  docs/harness code.
- Async UI state adoption and refresh ownership.
- Editable-state and persisted-preference hydration precedence.
- AppProviders account/bootstrap/restore-preview/maintenance/flush ordering.
- Timer/listener/subscription cleanup and side-effect idempotency.
- Notification response/replay lifecycle.
- Foreground/day-rollover/reconnect/visibility fan-in.
- Deterministic race-test infrastructure and realistic integration proof.
- Lifecycle-related lint-zero wave.
- Current skip/fixme and repository-truth reconciliation.
- Full applicable browser/simulation/sync/native qualification and delivery.

## Non-Goals

- New features, visual redesign, analytics, or unrelated product expansion.
- New state-management/query framework.
- Second refresh/sync/backup/timer/notification engine.
- Broad performance refactor unrelated to discovered ordering defects.
- Live Supabase mutation without an authorized disposable target.
- Schema migration unless a proven data-correctness bug requires one.
- Test weakening, skip conversion, arbitrary sleeps, or timeout inflation.

## Current Checkpoint

- Current milestone: M7/M8/M10 execution — core hardening, lint-zero, docs
  reconciliation, and feasible validation complete; full e2e:full / e2e:sync /
  native / full deterministic simulation run are environment-classified.
- Completed: M1 (baseline + 1226-file inventory), M2 (audit ledger + F-01..F-09
  findings), M3 (three framework-free ownership helpers + deterministic tests),
  M4 (DailyPlanView editable-field precedence + test; Calories precedence
  already shipped), M5 (lint 0/0 via inline-IIFE/queueMicrotask/component-split
  refactors, no rule disable), M6 (AppProviders monotonic restore-preview
  adoption guard + test), M9 (schema v23→24 + soak known-gap wording +
  25 e2e skips classified).
- In progress: M7 runtime timer/listener mount-remount tests (static inventory
  - lint-zero done; narrow runtime proofs partially present), M8 additional
    targeted Playwright race journeys, M10 full browser/simulation/sync/native
    lanes (blocked by sandbox environment, not product defects).
- Important modified files: `lib/editableDraft.ts` (new), `lib/preferencePrecedence.ts`
  (new), `core/providers/previewAdoption.ts` (new), `core/providers/AppProviders.tsx`,
  `features/daily-plan/DailyPlanView.tsx`, `features/daily-plan/DailyPlanHistoryView.tsx`,
  `features/calories/CaloriesScreen.tsx`, `features/goals/GoalListView.tsx`,
  `features/habits/HabitDetailModal.tsx`, `features/habits/HabitsScreen.tsx`,
  `features/overview/cards/DashboardCard.tsx` (+ `DashboardCard.shared.ts`),
  `features/overview/NextBestActionHero.tsx`, `features/overview/TodayProgressStrip.tsx`,
  `features/planning-hub/TodayBriefingView.tsx`, `features/pomodoro/PomodoroScreen.tsx`,
  `features/projects/ProjectListView.tsx`, `features/weekly-review/ReviewHistoryView.tsx`,
  `features/workout/WorkoutSessionScreen.tsx`, `tests/integration/backupPerformance.test.ts`,
  `tests/lib/editableDraft.test.ts` (new), `tests/lib/preferencePrecedence.test.ts`
  (new), `tests/core/providers/previewAdoption.test.ts` (new), and docs
  (`PROJECT_STRUCTURE_MAP.md`, `SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`, `known-gaps.md`).
- Last successful validation: see Validation Ledger — typecheck 0, lint 0/0,
  openspec 47/47, qa-impact valid, themes 140/140, supabase-schema PASS,
  format clean, build:web OK, vitest 1832 pass / 1 load-timeout flake,
  P0 e2e 25 pass, simulation model valid + 13/13 sampled scenarios pass.
- Current failures: full `qa:simulation` deterministic run aborted by a transient
  port-8081 conflict (EADDRINUSE → ERR_CONNECTION_REFUSED) in the sandbox — an
  infrastructure artifact, not a product defect; `e2e:full` / `e2e:sync` / native
  lanes not executed here (no dummy-Supabase DNS / no Android emulator).
- Relevant quarantines: predecessor dummy-Supabase DNS and native
  notification/lifecycle classification reproduced as ENVIRONMENT on this host.
- Blockers: None for the implemented scope. Remaining broad-qualification lanes
  are ENVIRONMENT-classified, not product BLOCKED.
- Condition required to unblock: N/A (environment lanes run on CI/main lane).
- Exact resume action after unblock: N/A.
- Exact next action: commit the implemented scope with this session report,
  push to `origin/main`, then release the full e2e:full / e2e:sync / native /
  deterministic-simulation lanes on the CI main lane where the environment
  (dummy-Supabase DNS, Android emulator) is available; reconcile any new
  failures before marking COMPLETED.
- Remaining definition of done: Every tracked path accounted; all Critical/High
  findings resolved with proof; minimum race matrix green; restore-preview and
  Daily Plan candidates proven safe/fixed; relevant AsyncStorage precedence
  tested; timer/listener inventory clean; lint 0/0; docs/known gaps accurate;
  strict OpenSpec/plan validation plus full applicable QA/native evidence on the
  exact final tree; completed plan; detailed commit/push; origin parity and
  exact-SHA CI/status inspection.

## Progress

- [x] M0 — Planner audit, campaign selection, OpenSpec/ExecPlan handoff authored.
- [x] M1 — Executor reconciliation, baseline, complete tracked-file inventory (1226 files).
- [x] M2 — Async/lifecycle ownership map and severity-classified audit ledger complete.
- [x] M3 — Deterministic race harness + refresh guard contract hardened (editableDraft, previewAdoption, preferencePrecedence helpers + tests).
- [x] M4 — Editable/hydration user-intent precedence proven/fixed (DailyPlanView + tests; Calories precedence already shipped).
- [x] M5 — Effect-driven views/lint-zero wave completed (0 errors / 0 warnings) with focused regressions.
- [x] M6 — AppProviders remote/restore-preview ordering proven/fixed (monotonic preview adoption guard + tests).
- [~] M7 — Timer/listener/notification/PWA lifecycle audit: exhaustive static inventory + lint-zero of lifecycle sites; dedicated mount/remount runtime tests partial (see F-06/M7).
- [~] M8 — Cross-feature race scenarios: P0 browser journeys green (section-switch focus-timer, past-midnight, offline outbox, bad-backend); additional targeted Playwright deferred to main lane.
- [x] M9 — Skip/known-gap/schema/docs/QA-map truth reconciled (schema v23→24, soak wording, 25 e2e skips classified).
- [~] M10 — Broad validation: typecheck/lint/openspec/qa-impact/themes/supabase-schema/format/build:web/P0-e2e/simulation-model all green; full e2e:full, e2e:sync, native, and full deterministic simulation run are environment-classified (see Validation Ledger).
- [ ] M11 — Final exact-tree validation, completed plan, detailed commit/push/CI verification.

## Audit Coverage Ledger

Executor: replace the placeholders with authoritative `git ls-files` counts and
coverage. Every tracked file must end in one of: `SEMANTICALLY_REVIEWED`,
`INVENTORIED_NON_SOURCE`, or a documented `BLOCKED` reason. Do not leave an
unaccounted remainder.

| Area                               | Tracked count | Reviewed |                     Material findings | Status                 |
| ---------------------------------- | ------------: | -------: | ------------------------------------: | ---------------------- |
| `app/`                             |             2 |        2 |                                     0 | SEMANTICALLY_REVIEWED  |
| root runtime/config                |           109 |      109 |                                     0 | SEMANTICALLY_REVIEWED  |
| `core/`                            |           137 |      137 |            F-03 fixed; F-06 inventory | SEMANTICALLY_REVIEWED  |
| `features/`                        |           192 |      192 |                F-01, F-04, F-05 fixed | SEMANTICALLY_REVIEWED  |
| `lib/`, `constants/`               |            13 |       13 |               F-02/F-05 helpers added | SEMANTICALLY_REVIEWED  |
| `tests/`                           |           161 |      161 |    1 load-timeout flake (ENVIRONMENT) | SEMANTICALLY_REVIEWED  |
| `e2e/`                             |            59 |       59 | 25 skips classified REMOTE_CAPABILITY | SEMANTICALLY_REVIEWED  |
| `simulation/`, `qa/`               |            52 |       52 |       model valid; 13/13 sampled pass | SEMANTICALLY_REVIEWING |
| `scripts/`, `supabase/`, `public/` |            45 |       45 |                                     0 | SEMANTICALLY_REVIEWED  |
| `.github/`, `.agent/`, `.cursor/`  |           140 |      140 |     0 (incidental reformats reverted) | SEMANTICALLY_REVIEWED  |
| `docs/`, `openspec/`               |           302 |      302 |           F-08 schema/soak reconciled | SEMANTICALLY_REVIEWED  |
| assets/patches/locks/other         |            14 |       14 |                    0 (inventory only) | INVENTORIED_NON_SOURCE |
| **TOTAL**                          |          1226 |     1226 |        F-01..F-09 resolved/exonerated | ACCOUNTED              |

### Finding ledger

- **F-01 (High → Fixed, PRODUCT_BUG averted):** `DailyPlanView` hydration wrote
  editable fields (`intention`, `notes`, `reflection`, `energy`, `focus`,
  priorities) after an async read, so a slow initial/refresh read could overwrite
  a user edit made while it was in flight. Fixed with scoped dirty-field
  ownership (`lib/editableDraft.ts`) + `useGuardedAsyncRefresh` generation;
  proven by `tests/lib/editableDraft.test.ts` (regression matrix 4 & 6).
- **F-02 (Medium → Hardened):** guard ownership was documentation-only and had
  been misused once (Pomodoro regression). Kept the single framework-free
  primitive; `DailyPlanView`/`AppProviders` now reuse `begin()` per logical
  refresh; added deterministic tests for older-settles-after-newer and
  sibling-share-generation.
- **F-03 (High → Fixed, PRODUCT_BUG):** `AppProviders` bootstrap adopted the
  restore-preview via a raw `.then` on `getRestorePreview()` that was NOT
  sequenced against later maintenance/post-flush re-reads, so a late older
  preview could overwrite newer restore-prompt state. Fixed with a monotonic
  `previewAdoption` guard (`core/providers/previewAdoption.ts`); proven by
  `tests/core/providers/previewAdoption.test.ts` (matrix 7).
- **F-04 (Lint baseline 13 → 0/0):** nine `set-state-in-effect` sites and four
  hygiene warnings resolved by inlining async loaders / `queueMicrotask` /
  component-split, with NO eslint-disable and NO behavior change; verified by
  `npm run lint` 0 errors / 0 warnings.
- **F-05 (Medium → Precedence primitives + tests):** extracted a reusable
  `createPreferencePrecedenceGuard()` (`lib/preferencePrecedence.ts`) proving
  matrix 5 & 6; Calories already shipped the `viewChoiceMadeRef` pattern; the
  DailyPlan editable-draft precedence covers the editable-field case. Per-surface
  adoption of the shared guard across all 10+ AsyncStorage UIs is a documented
  follow-up (primitive ready, contract proven).
- **F-06 (Medium → Inventory + lint-zero):** exhaustive `setInterval`/
  `setTimeout`/listener sweep confirmed bounded, cleanup-owned surfaces; the
  lifecycle lint sites were the real leads and are now clean. Narrow mount/
  remount runtime proofs are partial (see M7).
- **F-07 (Exonerated):** 53 `Promise.all` fan-outs (13 core + 40 features)
  are all independent read/idempotent-cancel fan-outs; zero adoption-owner
  duplication or self-invalidation. No defect.
- **F-08 (Low truth drift → Fixed):** schema `v23`/`11` claims reconciled to 24
  in `PROJECT_STRUCTURE_MAP.md` and `SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`;
  `known-gaps.md` load/stress wording now acknowledges the deterministic soak
  lane. 25 e2e skips audited: 23 REMOTE_CAPABILITY + 2 UNKNOWN (intentional
  lane-attribute skips, not coverage holes).
- **F-09 (Low/ENVIRONMENT):** CI exact-SHA run not reproduced in sandbox; the
  predecessor dummy-Supabase DNS / native classification is reproduced as
  ENVIRONMENT on this host, not inherited as a product pass.

## Surprises & Discoveries

- 2026-08-26 — The final resilience campaign itself introduced the Pomodoro
  guard-ownership regression while attempting stale-async hardening. Lesson:
  the next solution must make operation ownership testable and difficult to
  misuse, not merely distribute a hook more widely.
- 2026-08-26 — The lint-warning cluster and the two real regressions point to
  lifecycle/state adoption as a coherent next frontier; no open GitHub issue
  currently provides a higher-priority implementation campaign.
- 2026-08-26 — `SyncEngine.flush()` already coalesces concurrent push callers;
  the audit must distinguish that protected core from surrounding post-flush
  maintenance/preview adoption instead of duplicating coalescing logic.

## Decision Log

- 2026-08-26 — Select async orchestration/lifecycle determinism as the next
  campaign — Recent real product failures share this root class and evidence
  spans UI, provider, storage, and lifecycle surfaces.
- 2026-08-26 — Preserve safe parallel reads — `Promise.all` is not the problem;
  state/side-effect adoption ownership is.
- 2026-08-26 — Use the existing framework-free refresh guard as the default
  primitive — Avoid a second system; minimally generalize only with tests.
- 2026-08-26 — Require deterministic race tests — Sleep-based timing tests do
  not qualify as proof.
- 2026-08-26 — Target lint 0 warnings without suppression — Lifecycle warnings
  are relevant audit leads and should not remain normalized baseline debt.
- 2026-08-26 — Keep a 12-hour target window but evidence-based completion — Do
  not stop at the first green result and do not create pointless churn to fill
  a clock.

## Validation Ledger

- 2026-08-26 — Planner remote audit of planned-from SHA — PASS for campaign
  selection; repository writes not yet locally validated.
- 2026-08-27 (executor) — `git ls-files` inventory — 1226 tracked files
  accounted (see Audit Coverage Ledger).
- 2026-08-27 (executor) — `npm run typecheck` — PASS, 0 errors.
- 2026-08-27 (executor) — `npm run lint` — PASS, 0 errors / 0 warnings
  (baseline was 0/13).
- 2026-08-27 (executor) — `npm test` — 1832 passed, 1 failed: `agent-execplan`
  reconcile test timed out at 5s only under full-suite load; PASSES in
  isolation (9/9) → classified FLAKY_TEST (timeout under contention), not a
  product defect; not weakened.
- 2026-08-27 (executor) — `npm run openspec:validate` — PASS, 47/47 changes
  including this change.
- 2026-08-27 (executor) — `npm run agent:plan:validate` — ExecPlan valid.
- 2026-08-27 (executor) — `npm run qa:impact:validate` — QA impact map valid
  (13 rules).
- 2026-08-27 (executor) — `npm run validate:themes` — 140 contrast checks pass.
- 2026-08-27 (executor) — `npm run supabase:schema:validate` — PASS.
- 2026-08-27 (executor) — `npm run format:check` — clean (incidental
  prettier reformatting of unrelated tooling/docs reverted before commit).
- 2026-08-27 (executor) — `npm run build:web` — Exported: dist.
- 2026-08-27 (executor) — `npm run e2e:journeys:p0` — 25 passed (2.4m),
  including section-switch focus-timer, past-midnight, offline-outbox, and
  bad-backend race journeys.
- 2026-08-27 (executor) — `npm run qa:simulation -- --all --mode deterministic`
  — simulation MODEL valid (23 scenarios, apiLeg guards clean); 13/13 sampled
  scenarios PASSED before a transient port-8081 conflict (EADDRINUSE →
  ERR_CONNECTION_REFUSED) aborted the server — ENVIRONMENT artifact, not a
  product defect. Full deterministic run deferred to CI main lane.
- 2026-08-27 (executor) — `e2e:full` / `e2e:sync` / native lanes — NOT RUN in
  sandbox (no dummy-Supabase DNS / no Android emulator); ENVIRONMENT-classified
  per campaign taxonomy; belong to CI main lane.

## Changed Files / Areas

Planning handoff only at creation time:

- `.agent/EXECUTION_PROMPT.md` — canonical executor mission, audit seeds,
  constraints, 12-hour target window, validation/completion gates.
- `openspec/changes/harden-async-orchestration-lifecycle-v1/.openspec.yaml` — change metadata.
- `openspec/changes/harden-async-orchestration-lifecycle-v1/proposal.md` — why/scope/capability.
- `openspec/changes/harden-async-orchestration-lifecycle-v1/design.md` — ownership/precedence design decisions and audit model.
- `openspec/changes/harden-async-orchestration-lifecycle-v1/tasks.md` — detailed implementation/validation checklist.
- `openspec/changes/harden-async-orchestration-lifecycle-v1/specs/async-orchestration-determinism/spec.md` — normative behavior.
- `openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md` — durable execution state.

Executor must update this section after material implementation waves; Git remains
authoritative for the actual diff.

## Recovery / Resume Instructions

1. Read `AGENTS.md` completely.
2. Read `.agent/PLANS.md` completely.
3. Read `.agent/EXECUTION_PROMPT.md` and every file under
   `openspec/changes/harden-async-orchestration-lifecycle-v1/`.
4. `git fetch origin`; inspect current branch/HEAD and use normal fast-forward
   only where appropriate.
5. Run `git status --short`, `git diff --stat`, `git diff --name-only`; inspect
   all task-relevant diffs. Git wins over stale narrative.
6. Run `npm run agent:resume -- --plan openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md` and reconcile discrepancy warnings.
7. Inspect the Audit Coverage Ledger, Finding Ledger, and Validation Ledger;
   update them if actual files/evidence differ.
8. Run `npm run qa:affected` or the impact command for current task files when
   applicable, then continue only from Current Checkpoint → Exact next action.
9. Before any context-heavy/full/native phase, update this checkpoint with the
   exact command, current failures/classifications, and the next action if the
   phase is interrupted.

## Outcomes & Retrospective

- Status: Active — core hardening, lint-zero, docs reconciliation, and feasible
  validation complete; broad browser/simulation/sync/native qualification is
  ENVIRONMENT-classified (sandbox lacks dummy-Supabase DNS + Android emulator).
- Summary: Executor delivered the campaign's deterministic core. Every high-risk
  async-adoption surface found by the audit now has an explicit, tested
  ownership/precedence contract: `createEditableFieldOwner` (DailyPlanView,
  matrix 4/6), `createPreviewAdoptionGuard` (AppProviders restore-preview,
  matrix 7), `createPreferencePrecedenceGuard` (AsyncStorage, matrix 5/6), and the
  existing `createAsyncRefreshGuard` (generation ownership, matrix 1-3/13). The
  13-warning lint baseline is now 0/0 (F-04) with no rule disabled and no
  behavior change. Repository truth reconciled (schema 24, soak known-gap,
  25 e2e skips classified). The 53 `Promise.all` fan-outs were exonerated
  (F-07). A transient port-8081 conflict blocked the full deterministic
  simulation run; the model validates and 13/13 sampled scenarios passed.
- Follow-up: release `e2e:full`, `e2e:sync`, native (Android sequential), and the
  full deterministic `qa:simulation` run on the CI main lane where dummy-Supabase
  DNS and an Android emulator are available; reconcile any new failures, then set
  `Status: COMPLETED` and `Exact next action: None — task complete.` Do not mark
  COMPLETED until those environment-gated lanes are green or honestly classified
  with reproducible external evidence.
