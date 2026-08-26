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

| ID | Initial severity | Evidence / candidate invariant | Initial state |
| --- | --- | --- | --- |
| A-001 | High candidate | Several async effect-driven views adopt results without the shared generation guard; `DailyPlanView` also writes editable fields after an async fan-out. Newer explicit user edits must not be overwritten by older reads. | OPEN — deterministic proof required |
| A-002 | High candidate | `remotePhase.withRemoteTimeout()` leaves underlying tasks alive. Account state has monotonic task sequencing; restore-preview late `.then()` adoption plus later maintenance/post-flush refresh does not visibly share a generation. Newest restore state must win. | OPEN — deferred-promise proof required |
| A-003 | High/Medium class | Shared refresh guard appears in five main screens; Overview has bespoke request-id/mounted logic; other views use local cancellation/no guard. One logical operation needs one adoption owner. | OPEN — caller-by-caller audit |
| A-004 | High/Medium class | AsyncStorage reads exist across many UI/preference surfaces. Calories just required a user-choice guard. Explicit user interaction after a read begins must outrank older persisted hydration where streams compete. | OPEN — inventory + paired tests |
| A-005 | Medium / bug-finder | 13 lint warnings remain; nine are `react-hooks/set-state-in-effect` at lifecycle-heavy views. | OPEN — classify each, target zero warnings |
| A-006 | High/Medium class | Timer/listener/subscription fan-in includes AppProviders, Pomodoro, Workout session, Settings, day rollover, foreground refresh, connectivity, theme/motion, notification responses, and PWA. Repeated lifecycle must not duplicate owners/side effects. | OPEN — exhaustive ownership audit |
| A-007 | Low truth drift | Structure map has current schema v24 elsewhere but a stale `current v23` authority-row claim. Known-gap load/stress wording predates the completed deterministic soak lane. | OPEN — reconcile docs |
| A-008 | QA truth | Current `test.fixme`/skip markers include remote/recovery/command/journey scenarios and historical gap docs. Each current skip needs a real capability/environment rationale. | OPEN — classify, do not blindly enable |

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

- Current milestone: M0 — planner handoff created; executor has not started implementation.
- Completed: Planner inspected current architecture/rules, predecessor campaign,
  recent commits, DB/auth/sync/backup/portable/provider/notification inventories,
  async guard and major lifecycle-heavy views, parallel-read/static search,
  AsyncStorage/listener/interval search surfaces, baseline lint evidence,
  known-gap/structure-map drift, and current OpenSpec conventions. Campaign
  scope/design/tasks/spec are prepared.
- In progress: None — planning commit handoff only.
- Important modified files: planning artifacts only:
  `.agent/EXECUTION_PROMPT.md` and
  `openspec/changes/harden-async-orchestration-lifecycle-v1/**`.
- Last successful validation: Planned-from predecessor reported strict/all
  OpenSpec + broad QA green/classified as recorded above; this newly created
  change has NOT yet been validated by local repository tooling.
- Current failures: None known for the planning artifacts; executor must run
  baseline validation before implementation.
- Relevant quarantines: Existing environment-sensitive dummy-Supabase DNS and
  native notification/lifecycle evidence from predecessor; do not inherit the
  classification without reproducing it on the executor host.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Read `AGENTS.md`, `.agent/PLANS.md`,
  `.agent/EXECUTION_PROMPT.md`, and this complete OpenSpec change; fetch/fast-
  forward `main`; run `git status --short`, `npm run agent:plans`,
  `npm run agent:resume -- --plan openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md`,
  then establish the `git ls-files` audit inventory and baseline typecheck/lint/
  strict-OpenSpec evidence before touching production code.
- Remaining definition of done: Every tracked path accounted; all Critical/High
  findings resolved with proof; minimum race matrix green; restore-preview and
  Daily Plan candidates proven safe/fixed; relevant AsyncStorage precedence
  tested; timer/listener inventory clean; lint 0/0; docs/known gaps accurate;
  strict OpenSpec/plan validation plus full applicable QA/native evidence on the
  exact final tree; completed plan; detailed commit/push; origin parity and
  exact-SHA CI/status inspection.

## Progress

- [x] M0 — Planner audit, campaign selection, OpenSpec/ExecPlan handoff authored.
- [ ] M1 — Executor reconciliation, baseline, complete tracked-file inventory.
- [ ] M2 — Async/lifecycle ownership map and severity-classified audit ledger complete.
- [ ] M3 — Deterministic race harness + refresh guard contract hardened.
- [ ] M4 — Editable/hydration user-intent precedence proven/fixed.
- [ ] M5 — Effect-driven views/lint-zero wave completed with focused regressions.
- [ ] M6 — AppProviders remote/restore-preview ordering proven/fixed.
- [ ] M7 — Timer/listener/notification/PWA lifecycle audit and repairs complete.
- [ ] M8 — Cross-feature race scenarios and fresh repeated replays green.
- [ ] M9 — Skip/known-gap/schema/docs/QA-map truth reconciled.
- [ ] M10 — Broad browser/simulation/sync/native validation complete/classified.
- [ ] M11 — Final exact-tree validation, completed plan, detailed commit/push/CI verification.

## Audit Coverage Ledger

Executor: replace the placeholders with authoritative `git ls-files` counts and
coverage. Every tracked file must end in one of: `SEMANTICALLY_REVIEWED`,
`INVENTORIED_NON_SOURCE`, or a documented `BLOCKED` reason. Do not leave an
unaccounted remainder.

| Area | Tracked count | Reviewed | Material findings | Status |
| --- | ---: | ---: | ---: | --- |
| `app/`, root runtime/config | to measure | 0 | 0 | NOT STARTED |
| `core/` | to measure | 0 | seeded | NOT STARTED |
| `features/` | to measure | 0 | seeded | NOT STARTED |
| `lib/`, `constants/` | to measure | 0 | seeded | NOT STARTED |
| `tests/` | to measure | 0 | 0 | NOT STARTED |
| `e2e/` | to measure | 0 | seeded skips | NOT STARTED |
| `simulation/`, `qa/` | to measure | 0 | 0 | NOT STARTED |
| `scripts/`, `supabase/`, `public/` | to measure | 0 | 0 | NOT STARTED |
| `.github/`, `.agent/`, `.cursor/` | to measure | planner partial | 0 | NOT STARTED |
| `docs/`, `openspec/` | to measure | planner partial | seeded drift | NOT STARTED |
| assets/patches/locks/other non-source | to measure | 0 | 0 | NOT STARTED |
| **TOTAL** | to measure | 0 | seeded | NOT STARTED |

### Finding ledger

Promote A-001..A-008 above into final findings or exonerations and add every new
material issue. For each record: ID, severity, classification
(`PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`,
`EXPECTED_KNOWN_GAP`, `SPEC_AMBIGUITY`, or maintenance/doc where applicable),
root cause, reproduction, changed files, regression proof, final disposition.

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
- 2026-08-26 — `npm run openspec validate harden-async-orchestration-lifecycle-v1 --strict` — NOT RUN; executor first baseline action.
- 2026-08-26 — `npm run typecheck` — NOT RUN on planner artifacts.
- 2026-08-26 — `npm run lint` — NOT RUN on planner artifacts; predecessor exact
  tree recorded 0 errors / 13 warnings.
- 2026-08-26 — broad/final QA — NOT RUN; no production implementation yet.

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

- Status: Active — planning handoff only.
- Summary: Next campaign selected from post-resilience evidence. No production
  implementation has been performed by the planner.
- Follow-up: Execute M1 through M11, then replace this section with final audit
  coverage, fixes, proof, remaining known gaps, and lessons. Do not mark
  COMPLETED until all completion gates in `.agent/EXECUTION_PROMPT.md` are met.
