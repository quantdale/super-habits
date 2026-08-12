# ExecPlan: Post-parallel integration and autonomous continuation

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Integrate the completed Habit Reminder Interactions V2 work with the completed
`parallel/headless-hardening` workstream, prove the result as one coherent
SuperHabits product, and continue through the highest-value remaining work
before handing off. Success means both source histories remain recoverable, the
integration branch is validated across static, web/headless, performance,
dependency, and serialized native lanes, and any remaining gaps are classified
with evidence rather than hidden.

## Context

- Repository: SuperHabits, Expo SDK 55 / React Native 0.83 / SQLite-first PWA
  and native app.
- Main and common ancestor: `15a1a92` (`Plans`).
- Reminder source branch: `codex/add-schedule-aware-habit-reminders`, stable
  feature tip `2d8223e` (`feat: complete schedule-aware habit reminder
actions`). It contains the completed `add-schedule-aware-habit-reminders`
  (28/28 tasks) and `add-habit-reminder-actions` (16/16 tasks) artifacts and
  implementation, including migration 13 and native probes.
- Headless source branch: `parallel/headless-hardening`, tip `bd46856`
  (`docs: record dummy sync validation`), with its clean sibling worktree at
  `C:\Users\Michael Roy\Documents\super-habits-headless`.
- Integration branch/worktree: `integration/reminder-actions-headless` at
  `C:\Users\Michael Roy\Documents\super-habits-integrated`.
- The original feature worktree retains unrelated dependency/configuration
  edits in `package.json`, `package-lock.json`, `eslint.config.mjs`, patch
  files, and `.agent/execplans/install-configure-dependencies.md`; these are
  preserved outside this branch until their ownership and compatibility are
  deliberately reassessed.
- Runtime schema truth is `core/db/client.ts` bootstrap plus append-only
  migrations. `schema.sql` is reference-only. Migration 13 is the durable
  processed-notification-action store.

## Scope

- Merge both completed workstreams without wholesale `ours`/`theirs`
  conflict resolution.
- Verify sync metadata hydration, repeat soft-delete guards, journey fixture
  contracts, reminder routing/actions/idempotency/snooze/Linked Actions,
  migration ordering, and Pomodoro isolation.
- Run the affected static, OpenSpec, integration, web/headless, performance,
  dependency, and serialized Android QA required by current evidence.
- Reassess D14/CG-4 under a controlled environment and fix only a reproduced
  root cause.
- Attempt the remaining real Android notification-shade and direct cold-start
  proofs honestly, then continue with the highest-value current-tree work.
- Create a new OpenSpec for Habit Progress Insights V1 only after stabilization
  proves no higher-priority correctness, security, reliability, or performance
  issue remains.

## Non-Goals

- Do not mutate `main` before the integrated branch is clean and all required
  evidence is reviewed.
- Do not delete or rewrite either source branch, weaken tests, raise thresholds,
  reduce fixtures, or use retry roulette.
- Do not run competing emulator/Maestro sessions or use remote Supabase
  mutation without explicit product need and safe verification.
- Do not include the preserved dependency/configuration worktree edits merely
  because they are available; assess them as a separate evidence-backed phase.
- Do not expand Habit Progress Insights into AI, social, gamification, backend
  analytics, or prediction features.

## Current Checkpoint

- Current milestone: Source preservation complete; isolated integration
  worktree created; semantic merge is next.
- Completed: Read repository startup/architecture/QA/ExecPlan instructions;
  located the actual Reminder worktree and OpenSpec history; verified the
  headless branch/worktree and common ancestor; staged only task-owned Reminder
  V2 plus its schedule-aware prerequisite; committed feature tip `2d8223e`;
  created `integration/reminder-actions-headless` from that tip.
- In progress: Merge `parallel/headless-hardening` into the integration branch.
- Important modified files: None in the integration worktree yet. The source
  worktree's preserved unrelated dependency edits are outside this plan's
  current branch.
- Last successful validation: Git topology inventory and OpenSpec status show
  both source changes complete; staged feature commit passed its repository
  pre-commit formatting/lint tasks.
- Current failures: None recorded for the clean integration tip; broad QA has
  not yet run on the integrated tree.
- Relevant quarantines: Native iOS is expected to be Windows/macOS-limited;
  visual Android notification-shade and direct OS cold-start action selection
  are explicit proof attempts, not assumed passes; D14/CG-4 must be measured
  under controlled conditions.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: From `C:\Users\Michael Roy\Documents\super-habits-integrated`,
  run `git merge --no-ff parallel/headless-hardening`, inspect every conflict
  semantically, then record the merge result and resolution rationale here.
- Remaining definition of done: A committed semantic merge; valid append-only
  migration sequence; focused Reminder/headless regressions green; required
  static/OpenSpec/impact/integration/timezone/simulation/web/sync/build gates
  run and classified; D14/CG-4 reliably green or root-caused/classified;
  dependency and Expo health understood; serialized Android lanes and focused
  actionable-reminder proof attempted; at least one additional high-value
  continuation task completed when safe; final plan validation and handoff
  evidence recorded.

## Progress

- [x] Read repository instructions, skills, and authoritative OpenSpec context.
- [x] Identify source branches, tips, worktrees, and common ancestor.
- [x] Commit task-owned Reminder V2 work as `2d8223e` without absorbing
      unrelated dependency/configuration edits.
- [x] Create integration branch/worktree from the Reminder V2 tip.
- [x] Create this durable Plan-Version 2 integration/continuation plan.
- [ ] Merge `parallel/headless-hardening` semantically and commit the merge.
- [ ] Verify migration ordering and focused Reminder/headless invariants.
- [ ] Run static, integration, OpenSpec, impact, timezone, simulation, web,
      sync, and build QA appropriate to the merged diff.
- [ ] Re-establish D14/CG-4 under controlled conditions and resolve or classify.
- [ ] Audit dependency/Expo/lint/format health without unsafe upgrades or
      broad formatting churn.
- [ ] Serialize Android native lanes and attempt remaining actionable-reminder
      system proofs; preserve environment/known-gap evidence.
- [ ] Audit the stabilized current tree and complete the highest-value safe
      continuation work.
- [ ] Inspect final diff/history, validate the plan, and decide whether the
      branch is READY TO MERGE to `main`.

## Surprises & Discoveries

- The Reminder V2 implementation was not present as a hidden Git commit or
  branch; it existed as a dirty feature worktree. It is now preserved in
  `2d8223e`.
- The current source worktree also contains a separate dependency/configuration
  effort. Its files remain uncommitted and outside the integration branch so
  they cannot be mistaken for Reminder V2 ownership.
- OpenSpec reports both schedule-aware reminders and actionable reminder
  changes complete, while their completed artifacts still describe the older
  runtime schema in generated context text; runtime migration inspection must
  be authoritative.

## Decision Log

- 2026-08-12 — Use `codex/add-schedule-aware-habit-reminders` as the Reminder
  source because Git topology and the complete OpenSpec artifacts identify it
  as the actual worktree containing the implementation; no other feature tip
  exists.
- 2026-08-12 — Commit only task-owned Reminder/schedule-aware files before
  integration; preserve dependency/configuration edits in their original dirty
  worktree rather than silently merging unrelated work.
- 2026-08-12 — Start the integration branch at `2d8223e` and merge
  `parallel/headless-hardening` with `--no-ff` so both histories remain visible
  and conflicts can be reviewed by intent.
- 2026-08-12 — Keep `main` unchanged until the final evidence review.

## Validation Ledger

- 2026-08-12 — Repository startup inventory (`git status`, branches,
  worktrees, logs, remotes) — PASS; common ancestor `15a1a92`, Reminder source
  worktree identified, headless tip `bd46856` identified.
- 2026-08-12 — `openspec status/instructions --change
add-habit-reminder-actions` — PASS; planning complete, 16/16 tasks done.
- 2026-08-12 — `openspec status/instructions --change
add-schedule-aware-habit-reminders` — PASS; planning complete, 28/28 tasks
  done.
- 2026-08-12 — `git diff --cached --check` and feature commit hook — PASS;
  Reminder source commit `2d8223e` created with staged-file formatting/lint.
- 2026-08-12 — Integrated-tree gates — NOT RUN; exact next action is the
  semantic merge.

## Changed Files / Areas

- `app/`, `core/notifications/`, `core/db/`, `core/providers/`,
  `core/sync/` — Reminder response lifecycle, bootstrap/navigation readiness,
  durable action migration, and restore/reconciliation integration.
- `features/habits/`, `lib/notifications.ts`, `lib/notificationConstants.ts`
  — Schedule-aware planning, notification actions, canonical completion,
  snooze, and native wrapper behavior.
- `tests/`, `e2e/`, `simulation/`, `.maestro/`, `scripts/` — unit,
  real-SQLite, journey, simulation, and Android probe coverage.
- `openspec/changes/add-habit-reminder-actions/` and
  `openspec/changes/add-schedule-aware-habit-reminders/` — normative artifacts
  and completed implementation plans.
- `parallel/headless-hardening` source areas — to be reviewed after merge for
  sync metadata validation, soft-delete guards, test fixture handling, lint,
  and current repository guidance.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `docs/PROJECT_STRUCTURE_MAP.md`,
   `docs/codex-workflow.md`, `.cursorrules`, `.cursor/rules/superhabits-rules.mdc`,
   and `.agent/PLANS.md`.
2. Read this plan completely.
3. From the integration worktree run `git status --short`, `git diff --stat`,
   `git diff --name-only`, and `npm run agent:resume -- --plan
.agent/execplans/post-parallel-integration.md`.
4. Reconcile Git with this checkpoint, inspect recent QA artifacts, and run
   `npm run qa:affected` when implementation changes are present.
5. Continue only from `Exact next action`, updating this plan after every
   meaningful merge, decision, failure, fix, delegation boundary, and QA
   milestone.

## Outcomes & Retrospective

- Status: Active.
- Summary: Source preservation and isolated integration setup are complete;
  merge, stabilization, QA, and continuation remain.
- Follow-up: Complete the remaining definition-of-done conditions before
  considering a merge to `main`.
