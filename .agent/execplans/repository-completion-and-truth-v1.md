# ExecPlan: Repository Completion & Truth V1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close the remaining evidence-backed gaps found by a fresh audit at `c65b96a`, so the
repository's shipped behavior, proofs, and documentation all tell the same true story:

- Legacy Pomodoro session notes/associations become durable and backup-recoverable
  (the implemented migration actually runs at bootstrap).
- Users can delete an erroneous saved daily plan from plan history.
- Correctness-sensitive duplicate/dead APIs are consolidated to one implementation.
- Mature write surfaces stop certifying through UI text alone; audited gaps gain
  real-SQL or E2E data oracles.
- Current-facing docs match code reality.
- The final tree passes the full regression ladder and is pushed with CI evidence.

## Context

- Baseline: `HEAD == origin/main == c65b96ac407d5bc74f9011997e6a58463878ff7f`, tree clean,
  campaign `Super Habits Functional Completion V1` COMPLETED; all discovered plans
  COMPLETED; no ACTIVE planner prompt or native campaign exists.
- User directive: skip the planner handoff; choose the work autonomously and drive it to
  completion. Repository rules still apply: durable ExecPlan (this file), OpenSpec change
  `complete-repository-depth-v1`, append-only migrations, soft delete, durable outbox,
  no test weakening, evidence-led completion.
- Audits performed for this plan (read-only agents + direct verification):
  orphan-capability census, test-floor matrix, docs-truth diff, plus environment check.
- Environment: repo pins Node `.nvmrc` 22.23.2 / engines `<23`; host default was Node
  24.3.0. Portable Node 22.23.2 extracted to
  `%LOCALAPPDATA%\tools\node-v22.23.2-win-x64` (outside the repo) and used for gates.
  `better-sqlite3` loads under both runtimes, so no rebuild is required.
- Key audited gaps to close: `migrateLegacySessionMeta` never invoked; `softDeleteDailyPlan`
  unreachable; `cancelTodoReminderSafely` private duplicate; `WEEKLY_REVIEW_REMINDER_DATA_VERSION`
  unused; dead `getBackfillStatus` with private live duplicate; `createPreferencePrecedenceGuard`
  unadopted; zero-oracle specs (todos/calories/workout-gym-v2/settings), no Overview E2E,
  bulk/planning/workout/pomodoro-timer/motion test gaps; ~20 confirmed doc discrepancies.

## Scope

Waves 1–6 of `openspec/changes/complete-repository-depth-v1/tasks.md`:

1. Durability wiring + consolidations.
2. Daily-plan deletion (spec-backed).
3. Test floor (integration + E2E + unit).
4. Documentation truth.
5. Bounded dead-code removal (zero-reference, zero-test only).
6. Regression ladder, ExecPlan close, commit/push/CI.

## Non-Goals

No new product features beyond already-implemented capability activation; no schema
migrations; no two-way sync; no external Supabase/iOS lanes; no reopening completed
campaigns; no test weakening; no broad refactors beyond the named consolidations.

## Current Checkpoint

- Current milestone: Wave 0 nearly complete — shebang test-breaking fix landed, Node 22
  runtime ready, campaign artifacts authored; committing baseline and starting Wave 1.
- Completed:
  - Reconciled local `main` from `ba64576` (97 behind) to `c65b96a` == `origin/main`.
  - Audited the tree (orphans, test floor, docs truth) and verified top findings by hand.
  - Root-caused `qa:fast` failure at HEAD on Windows: importing
    `scripts/journey-label-parity.mjs` (with `#!/usr/bin/env node`) through Vitest breaks
    under CRLF; removed the shebang (script is always invoked via `node`). Test now passes
    (3/3) and the guard script still runs green.
  - Portable Node 22.23.2 installed; `better-sqlite3` loads under both runtimes.
  - Artifacts: `openspec/changes/complete-repository-depth-v1/{proposal,design,tasks}.md`
    - 2 specs; this ExecPlan.
- In progress: baseline commit for Wave 0 + artifacts.
- Important modified files: `scripts/journey-label-parity.mjs` (shebang removed).
- Last successful validation: `npx vitest run tests/journeyLabelParity.test.ts --project
unit` PASS 3/3 (2026-09-10); `node scripts/journey-label-parity.mjs` PASS.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: commit Wave 0 + artifacts, then implement Wave 1.1 (wire
  `migrateLegacySessionMeta` into `AppProviders` after `syncEngine.hydrate()`).
- Remaining definition of done: all Wave 1–6 tasks checked; full regression ladder green
  under Node 22.23.2 (typecheck, lint 0 warnings, unit+integration, openspec validate,
  theme/schema/impact validators, build:web + full e2e, deterministic simulation,
  web:verify/hygiene, native smoke/persistence where a target exists or honest
  ENVIRONMENT classification); docs corrected and verified; ExecPlan COMPLETED and
  `agent:plan:validate` PASS; commit pushed and CI result recorded.

## Progress

- [x] Wave 0 — baseline reconciliation, audits, Node 22 runtime, shebang fix (2026-09-10)
- [ ] Wave 1 — durability wiring + consolidations
- [ ] Wave 2 — daily plan deletion
- [ ] Wave 3 — test floor
- [ ] Wave 4 — documentation truth
- [ ] Wave 5 — bounded dead-code removal
- [ ] Wave 6 — regression ladder + delivery

## Surprises & Discoveries

- `qa:fast` fails at HEAD on Windows because Vitest cannot transform an imported `.mjs`
  that starts with a shebang (CRLF working copy); CI on Linux was green. Removing the
  shebang is the robust cross-platform fix.
- Host default Node (24.3.0) violates the repo's engines pin (`<23`); a portable 22.23.2
  runtime is required for legitimate gates. `better-sqlite3` is ABI-compatible with both,
  so no native rebuild is needed.
- The audit backlog in `.agent/hardening-evidence/audit-reports.md` is largely closed
  already (F9–F12 verified fixed in code); do not reopen it wholesale.
- `getDailyPlanAdherence` is live (`DailyPlanView`), unlike the audit's orphan shortlist
  implying planning rollups were unused.

## Decision Log

- 2026-09-10 — Skip the planner handoff per explicit user directive; author the campaign
  artifacts (OpenSpec change + ExecPlan) directly and execute them.
- 2026-09-10 — Remove the shebang from `scripts/journey-label-parity.mjs` rather than
  weakening the test import or skipping the suite; the script is only ever run via `node`.
- 2026-09-10 — Run the legacy session-metadata promotion at bootstrap (not screen-scoped)
  so durability does not depend on visiting the Focus surface.
- 2026-09-10 — Delete dead `getBackfillStatus`; keep the live `backupRestore` helper (it
  has the correct `BACKUP_SCOPE_VERSION` comparison) as the single implementation.
- 2026-09-10 — Daily-plan deletion reuses `softDeleteDailyPlan` + `useConfirmationDialog`,
  matching the weekly-review history delete pattern; no new route or surface.

## Validation Ledger

- 2026-09-10 — `npx vitest run tests/journeyLabelParity.test.ts --project unit` — PASS —
  3/3 after shebang removal (failed 1/1 before).
- 2026-09-10 — `node scripts/journey-label-parity.mjs` — PASS — rail labels agree.
- 2026-09-10 — `npm run qa:fast` — FAIL (pre-fix baseline) — blocked only by the
  journey-label-parity import; Unit 1691+ tests otherwise green; will re-run after fixes.

## Changed Files / Areas

- `scripts/journey-label-parity.mjs` — shebang removed (Windows/CRLF Vitest import fix).
- `openspec/changes/complete-repository-depth-v1/` — proposal, design, tasks, 2 specs.
- `.agent/execplans/repository-completion-and-truth-v1.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, then this plan fully.
2. Read `openspec/changes/complete-repository-depth-v1/` artifacts.
3. `git status --short`, `git log --oneline -8`; reconcile with the checkpoint (Git wins).
4. Run `npm run agent:resume -- --plan .agent/execplans/repository-completion-and-truth-v1.md`.
5. Use Node 22.23.2 for all gates:
   `$env:PATH = "$env:LOCALAPPDATA\tools\node-v22.23.2-win-x64;" + $env:PATH`.
6. Continue from `Exact next action`; checkpoint this plan at every milestone/failure.

## Outcomes & Retrospective

- Status: Active.
- Summary: Campaign opened; baseline reconciled; Wave 0 fix landed.
- Follow-up: Wave 1 implementation; see tasks.
