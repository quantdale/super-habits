# ExecPlan: W11.5 — Planning Reliability & Regression Closure

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close the remaining verification gaps of the merged W11 Planning / Goals /
Projects / Daily Plan overhaul: verify and resolve the outstanding PR #73
Codex P2 review thread with executable evidence, replace the W11 "browser
failed-write injection NOT STAGEABLE" (D10) claim with real-SQLite
trigger-injection regressions for the highest-risk Planning write paths,
fix any genuine reliability defects those tests reveal, and publish an
evidence-backed closure that hands W12 off cleanly.

## Context

- Baseline `origin/main` = `2cfe168631e206faf355a55ad0e271a39a284b89`
  (W11 closure record). W11 merged as `ffb02f2` (PR #73, final head
  `e669385`); W11 ExecPlan COMPLETED; parent Frontend V3 campaign ACTIVE
  with W12 next.
- W11 added visible failure surfaces (commit `74d4aaf`): Daily Plan
  save/complete, Goal/Project delete, and persist-before-refresh Project
  lifecycle transitions. Those surfaces were calibrated by pattern and
  lane re-runs, NOT by injected browser write failures — the W11 audit
  register records that limitation as D10.
- The repository already contains the mechanism that makes D10 testable:
  `e2e/calories.spec.ts` installs real SQLite `RAISE(ABORT)` triggers
  through the same-origin DB harness (`e2e/helpers/dbHarness.ts` +
  `seedSql`), with the documented sequencing rule: seed/assert in DB
  context only at reload boundaries (navigating to the harness destroys
  React state), never mid-interaction.
- Planning write paths (verified against source):
  - Daily Plan create = `INSERT INTO daily_plans`; completion =
    `UPDATE daily_plans SET status='completed', completed_at=…` — both
    inside `runBackupMutation` (`core/sync/syncedMutation.ts`) over
    `withSQLiteTransaction` (`core/db/transactions.ts`, web
    `withTransactionAsync` auto-rollback on ABORT), so a rejected
    statement rolls back the entity row, its outbox intent and the
    backup-dirty marker together.
  - Goal create = `INSERT INTO goals`; goal rename = the `updateGoal`
    UPDATE; goal soft delete = child `UPDATE todos/habits` reconciliation
    then `UPDATE goals SET deleted_at=…`.
  - Project lifecycle = `UPDATE projects SET status=…` (completed_at
    transitions in-transaction); project soft delete = child
    `UPDATE goals/todos/habits` reconciliation then the tombstone UPDATE.
- Outstanding Codex thread `PRRT_kwDORgzj086rkJjX` on
  `features/planning-hub/PlanningSummaryRow.tsx:47` (P2): the reviewer
  believed the `Pressable` covered only the title/status column while the
  percentage and progress bar were siblings outside it.

## Scope

- New isolated branch `frontend-v3-w115-planning-reliability` + worktree.
- W11.5 ExecPlan at `.agent/execplans/frontend-v3-w115-planning-reliability.md`.
- New browser regression spec `e2e/planning-w115-reliability.spec.ts`
  with SQLite trigger injection across the Daily Plan save/complete, Goal
  create/rename/delete, Project lifecycle/delete and backup-intent-only
  failure paths, including durable row/outbox oracles and retry-success
  flows.
- Extend `e2e/planning-w11.spec.ts` to pin the full-card press-target
  behavior (title, percentage, progress bar, non-action surface,
  independent reorder controls) as the P2-thread evidence.
- Small production fixes only where a test reproduces a genuine defect.
- W11.5 audit evidence `docs/ui-ux/v3-audit/w11.5/README.md`, a short
  addendum in `docs/ui-ux/v3-audit/w11/README.md`, review-thread
  resolution, parent campaign checkpoint update.

## Non-Goals

- No W12 work (Weekly Review / Progress / Activity untouched).
- No visual redesign; no new navigation destinations; no schema/migration,
  dependency, or security-policy changes; no shared-component refactors;
  no changes to established product semantics; W11's 82 historical
  screenshots and evidence stay untouched (W11.5 evidence is additive);
  no weakening/deleting of existing assertions; no production failure
  hooks.

## Current Checkpoint

- Current milestone: M6 publication — code, tests, fixes, review and
  records are complete; the full Playwright battery is the last local gate
  running before commit/PR.
- Completed:
  - M1 preflight; repository verified at `2cfe168`, PR #73 thread
    confirmed unresolved.
  - M2 feasibility probe — a real `RAISE(ABORT)` trigger on
    `daily_plans` INSERT rejects a UI Save Plan with atomic rollback
    (0 rows, 0 outbox intents, no backup marker) and a post-drop retry
    persists exactly once. D10 objectively reassessed: browser
    failed-write injection IS stageable for Planning mutations.
  - M3 — `e2e/planning-w115-reliability.spec.ts` 8/8 PASS:
    (A) rejected Daily Plan save — curated error, draft retained, 0 rows /
    0 intents, retry persists exactly once, fresh-mount persistence;
    (B) rejected Complete of a seeded committed plan — status /
    `completed_at` / reflection unchanged, edits retained, retry
    completes with timestamp + 1 intent;
    (C) rejected goal create — editor + values retained, no phantom goal,
    retry writes exactly one;
    (F) rejected goal rename (`updateGoal` path) — prior title/progress
    untouched, retry updates once;
    (C2) rejected goal soft-delete — no tombstone, no partial child
    unlink, retry reconciles once (2 coherent intents);
    (D) rejected project lifecycle — no false status (row still reads
    Active), durable status/`completed_at`/links unchanged, retry
    completes;
    (G) rejected backup intent only — goal row and intent roll back
    atomically (0 rows AND 0 intents), retry produces 1 + 1;
    (E) rejected project soft-delete — no tombstone, children intact,
    retry reconciles once (tombstone + goals/todos/habits child intents).
  - M4 — `features/planning-hub/planningWriteError.ts` (new, unit 3/3):
    rejected writes leaked the raw engine message; the mapper keeps
    user-facing validation copy and replaces engine/storage noise with
    curated sentences, wired into Daily Plan save + carry-forward,
    Guided Planning save + carry-forward, Goal save/delete, Project
    save/delete/status.
  - M5 — independent adversarial review (sub-agent) with findings
    addressed: sibling-surface leaks (GuidedPlanningFlow, carry-forward)
    fixed; SQLITE_FULL/CANTOPEN patterns added; test E child-intent
    assertions completed; coordinate-based pins replaced with semantic
    selectors; tests F + G added; fresh-mount persistence added; dialog
    scoping for `Committed`. No blocker found; trigger correctness,
    transaction atomicity, isolation and oracle sequencing verified.
  - P2-thread executable evidence added to `e2e/planning-w11.spec.ts`
    (title, context line, percentage, rendered 10% bar open detail;
    reorder arrow does not navigate) — 3/3 PASS with
    `e2e/planning-hub.spec.ts` 4/4.
- In progress: full Playwright battery (`npm run e2e`, all projects) +
  remaining impact-map gates; then commit, PR, thread reply + verified
  resolution, exact-head CI, merge, closure records.
- Important modified files: `features/planning-hub/planningWriteError.ts`
  (new), `features/planning-hub/GuidedPlanningFlow.tsx`,
  `features/daily-plan/DailyPlanView.tsx`,
  `features/goals/GoalDetailView.tsx`,
  `features/projects/ProjectDetailView.tsx`,
  `tests/planningWriteError.test.ts` (new),
  `e2e/planning-w115-reliability.spec.ts` (new),
  `e2e/planning-w11.spec.ts` (press-target pin),
  `docs/ui-ux/v3-audit/w11.5/README.md` (new),
  `docs/ui-ux/v3-audit/w11/README.md` (addendum only),
  `docs/testing/known-gaps.md` (status note),
  `openspec/changes/frontend-v3-calm-momentum/execplan.md` (checkpoint),
  this plan.
- Last successful validation: after the M5 fixes — W11.5 reliability
  spec 8/8; `planning-w11.spec.ts` 3/3 + `planning-hub.spec.ts` 4/4
  (11/11 combined); `planningWriteError` unit 3/3; typecheck 0; lint
  0/0; themes 140/140; OpenSpec 80/80; plans PASS; parity guards OK;
  release-profile-guard OK; full Vitest 2,679 passed / 2 skipped /
  1 failed (the documented Windows-CRLF `agentDocConsistency` residual —
  identical failure on pristine `main` — ENVIRONMENT, not a W11.5
  defect); `e2e:journeys:p0` 25/25; deterministic simulation PASS; full
  Playwright battery in progress.
- Current failures: None for the W11.5 scope (the single local Vitest
  failure is the inherited Windows-CRLF residual).
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: finish the running full Playwright battery, record
  the counts, commit the branch, open the PR, post the PR #73 thread
  reply with the executable evidence and resolve it (verify the resolved
  state via GraphQL), merge with exact-head CI evidence, then close this
  plan and update the parent checkpoint.
- Remaining definition of done: the publication sequence and the final
  records listed above.

## Progress

- [x] M1 — preflight, docs, review-thread inspection, write-path map
- [x] M2 — failure-injection feasibility probe on a Planning write
- [x] M4 — raw engine message fix: planningWriteError helper wired into the failure surfaces
- [x] M3 — regression matrix implementation (A–E + F goal rename + G outbox-only) — 8/8 PASS
- [x] M5 — adversarial validation of triggers, transactions, isolation; findings addressed and re-verified
- [ ] M6 — publication: PR, hosted evidence, thread resolution, closure

## Surprises & Discoveries

- The trigger-abort message reaches the app as the opaque
  "Error finalizing statement", so failure-path assertions must key on
  curated UI copy, never the engine string — this is why the W11
  surfaces needed the message mapping.
- wa-sqlite/expo-sqlite rollback on ABORT is atomic across the entity
  row, its outbox intent and the backup-dirty marker (0 rows in all
  three observed after a rejected Daily Plan INSERT; confirmed again by
  the outbox-only trigger case).
- `isUniqueConstraintError` requires the `UNIQUE` text, so an aborted
  INSERT correctly rethrows instead of falling through to the UPDATE
  path (verified by review).
- Reorder arrows are siblings outside the Pressable, so the P2 fix must
  keep them independent — now pinned by a non-navigation assertion.

## Decision Log

- 2026-10-13 — Use `RAISE(ABORT)` triggers value-keyed where possible
  (`WHEN NEW.status='completed'`, `NEW.deleted_at IS NOT NULL`,
  `NEW.title=…`) so a failed attempt targets exactly the risky
  transition.
- 2026-10-13 — Follow the harness rule strictly: DB-context steps
  (seed trigger, row/outbox oracles, DROP TRIGGER) happen only at
  interaction boundaries; every UI assertion runs in app context and the
  retry follows a fresh mount.
- 2026-10-13 — Curated failure copy via a shared pure mapper rather than
  per-call-site strings, mirroring the calibrated W10 failure-surface
  pattern; validation messages pass through untouched.
- 2026-10-13 — Document (do not "fix") the benign in-flight delete
  double-submit: the second soft-delete UPDATE changes 0 rows and
  enqueues nothing, so no duplicate tombstone or intent is possible.

## Validation Ledger

- 2026-10-13 — Repository/PR/thread preflight — PASS (state matches the
  brief; thread `PRRT_kwDORgzj086rkJjX` confirmed unresolved).
- 2026-10-13 — Write-path and transaction source review — PASS.
- 2026-10-13 — M2 feasibility probe — PASS (0 rows / 0 intents / no
  backup marker after rejection; exactly-one persisted row after retry).
- 2026-10-13 — Regression matrix + M5 fixes — `planning-w115-reliability.spec.ts`
  8/8 PASS; `planning-w11.spec.ts` 3/3; `planning-hub.spec.ts` 4/4;
  `planningWriteError` unit 3/3; typecheck 0; lint 0/0; themes 140/140;
  OpenSpec 80/80; plans PASS; parity guards OK; release-profile-guard OK.
- 2026-10-13 — Full Vitest (unit + integration) — 2,679 passed / 2
  skipped / 1 failed; the single failure is the documented Windows-CRLF
  `agentDocConsistency` residual that fails identically on pristine
  `main` — ENVIRONMENT, not a W11.5 defect.
- 2026-10-13 — `e2e:journeys:p0` — 25/25 PASS. Deterministic simulation
  — PASS. Full Playwright battery + deterministic library — counts
  recorded at closure.

## Changed Files / Areas

- `.agent/execplans/frontend-v3-w115-planning-reliability.md` — this plan.
- `e2e/planning-w115-reliability.spec.ts` (new) — 8 write-failure
  regressions with row/outbox oracles and retries.
- `e2e/planning-w11.spec.ts` — full-card press-target evidence for the
  PR #73 P2 thread (semantic selectors; reorder independence).
- `features/planning-hub/planningWriteError.ts` (new) and
  `tests/planningWriteError.test.ts` (new) — curated failure copy.
- `features/daily-plan/DailyPlanView.tsx`,
  `features/goals/GoalDetailView.tsx`,
  `features/projects/ProjectDetailView.tsx`,
  `features/planning-hub/GuidedPlanningFlow.tsx` — failure surfaces use
  the mapper; no other behavior change.
- `docs/ui-ux/v3-audit/w11.5/README.md` (new),
  `docs/ui-ux/v3-audit/w11/README.md` (addendum),
  `docs/testing/known-gaps.md` (status note on the existing W11 entry),
  `openspec/changes/frontend-v3-calm-momentum/execplan.md` — parent
  checkpoint (W11.5 COMPLETE, W12 next unstarted).

## Recovery / Resume Instructions

1. Read AGENTS.md and `.agent/PLANS.md`, then this plan.
2. Reconcile with `git status --short` and `git log --oneline -3` in the
   worktree `D:/Documents/tryPython/superhabits-w115` (branch
   `frontend-v3-w115-planning-reliability`).
3. Run `npm run agent:resume -- --plan
.agent/execplans/frontend-v3-w115-planning-reliability.md` for the
   structural orientation and QA impact.
4. Continue from `Exact next action`; re-run the affected Playwright
   specs with `npx playwright test --project=chromium …` against the
   worktree's `dist/` (rebuild with `npm run build:e2e` if stale).

## Outcomes & Retrospective

- Status: Active until the publication sequence and final records land.
