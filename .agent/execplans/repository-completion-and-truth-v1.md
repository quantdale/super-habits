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

- Current milestone: Wave 1 COMPLETE — durability migration wired + verified, consolidations
  landed; Wave 2 (daily-plan deletion) is next.
- Completed:
  - Wave 0 — baseline reconciliation, audits, Node 22 runtime, shebang fix, campaign
    artifacts (commit `8d05e03`).
  - Wave 1 — `migrateLegacySessionMeta` runs in `AppProviders` after `syncEngine.hydrate()`
    (best-effort, retried next launch); new real-SQL integration suite 3/3; todos data
    layer uses the shared `cancelTodoReminderSafely` (private duplicate deleted); the
    weekly-review scheduler uses `WEEKLY_REVIEW_REMINDER_DATA_VERSION`; dead
    `getBackfillStatus` removed; preference-precedence guard adopted in Calories view
    mode, Overview card layout, and the motion singleton, with a new motion contract test
    (4/4, includes the late-hydration race).
- In progress: committing Wave 1.
- Important modified files: `core/providers/AppProviders.tsx`,
  `tests/integration/pomodoroSessionMetaMigration.test.ts` (new), `features/todos/todos.data.ts`,
  `core/notifications/weeklyReviewReminderScheduler.ts`, `core/backup/backupBackfill.ts`,
  `features/calories/CaloriesScreen.tsx`, `features/overview/OverviewScreen.tsx`,
  `core/theme/motion.ts`, `tests/motionPreference.test.ts` (new).
- Last successful validation: focused eslint `--max-warnings 0` clean; unit suites 53/53
  (todos 30, motion 4, weekly-review scheduler, pomodoro data); integration promotion 3/3;
  `npx tsc --noEmit` clean (2026-09-10).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: implement Wave 2.1 (confirmed danger delete in
  `features/daily-plan/DailyPlanHistoryView.tsx` wired to `softDeleteDailyPlan`).
- Remaining definition of done: all Wave 2–6 tasks checked; full regression ladder green
  under Node 22.23.2; docs corrected and verified; ExecPlan COMPLETED and
  `agent:plan:validate` PASS; commit pushed and CI result recorded.

## Progress

- [x] Wave 0 — baseline reconciliation, audits, Node 22 runtime, shebang fix (2026-09-10)
- [x] Wave 1 — durability wiring + consolidations (2026-09-10)
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
- 2026-09-10 — Adopt the precedence guard only where an ad-hoc equivalent or demonstrable
  race exists (Calories view mode, Overview card layout, motion singleton); other
  AsyncStorage preferences (theme, command mode, reminders) keep their existing flows and
  are recorded as evaluated-but-unchanged.
- 2026-09-10 — Daily-plan deletion reuses `softDeleteDailyPlan` + `useConfirmationDialog`,
  matching the weekly-review history delete pattern; no new route or surface.

## Validation Ledger

- 2026-09-10 — `npx vitest run tests/journeyLabelParity.test.ts --project unit` — PASS —
  3/3 after shebang removal (failed 1/1 before).
- 2026-09-10 — `node scripts/journey-label-parity.mjs` — PASS — rail labels agree.
- 2026-09-10 — `npm run qa:fast` — FAIL (pre-fix baseline) — blocked only by the
  journey-label-parity import; Unit 1691+ tests otherwise green; will re-run after fixes.
- 2026-09-10 — `npx vitest run tests/integration/pomodoroSessionMetaMigration.test.ts
--project integration` — PASS — 3/3 (promote-once/no-clobber/orphans, real SQLite).
- 2026-09-10 — `npx vitest run tests/motionPreference.test.ts --project unit` — PASS —
  4/4 including the late-hydration precedence race.
- 2026-09-10 — `npx tsc --noEmit` — PASS — 0 errors after Wave 1 edits.
- 2026-09-10 — `npx vitest run tests/todos.data.test.ts --project unit` — PASS — 30/30.
- 2026-09-10 — `npx vitest run tests/calories.data.test.ts --project unit` — PASS —
  22/22 after the guard adoption.
- 2026-09-10 — Wave 1 focused suite — PASS — `eslint --max-warnings 0` clean; unit
  53/53 (todos/motion/weekly-review scheduler/pomodoro data); integration 3/3.

## Changed Files / Areas

- `scripts/journey-label-parity.mjs` — shebang removed (Windows/CRLF Vitest import fix).
- `openspec/changes/complete-repository-depth-v1/` — proposal, design, tasks, 2 specs.
- `.agent/execplans/repository-completion-and-truth-v1.md` — this plan.
- Wave 1: `core/providers/AppProviders.tsx`,
  `tests/integration/pomodoroSessionMetaMigration.test.ts`,
  `features/todos/todos.data.ts`, `core/notifications/weeklyReviewReminderScheduler.ts`,
  `core/backup/backupBackfill.ts`, `features/calories/CaloriesScreen.tsx`,
  `features/overview/OverviewScreen.tsx`, `core/theme/motion.ts`,
  `tests/motionPreference.test.ts`.

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
- Summary: Waves 0–1 landed; durability promotion now runs and is real-SQL proven.
- Follow-up: Wave 2 daily-plan deletion; see tasks.
