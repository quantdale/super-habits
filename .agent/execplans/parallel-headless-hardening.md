# ExecPlan: Parallel Headless Hardening Campaign

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Audit the current SuperHabits `origin/main` baseline for valuable, independently
mergeable headless improvements while another worktree implements Habit Reminder
Interactions V2. Deliver multiple evidence-backed fixes or tests without native
device execution, remote mutation, or merge interference.

Success means the dedicated branch is clean and committed, the protected
reminder surface is untouched, meaningful headless issues are fixed with
regressions, broad safe QA is run and honestly classified, and this plan is
validated as COMPLETED.

## Context

- Canonical baseline: `origin/main` at `15a1a9275c6ade0a016752c577c818d5b7431eaf`.
- Dedicated worktree: `C:/Users/Michael Roy/Documents/super-habits-headless`.
- Dedicated branch: `parallel/headless-hardening`.
- The sibling checkout `C:/Users/Michael Roy/Documents/super-habits` is dirty on
  `codex/add-schedule-aware-habit-reminders`; it is owned by the parallel
  reminder session and must not be edited, reset, rebased, or merged.
- Local SQLite is the source of truth; preserve soft-delete, sync enqueue,
  singleton DB, ID, date-key, and append-only migration invariants.
- Headless validation may use Vitest, real SQLite integration, Playwright
  Chromium, deterministic simulation, typecheck, lint, builds, and static
  tooling. Native/emulator/ADB/Maestro/EAS/Docker/remote Supabase/deployment
  commands are prohibited for this campaign.
- Habit Reminder Interactions V2 high-conflict areas are notification response
  handling, reminder actions/categories, Mark Complete, Snooze, response
  idempotency, cold-start routing, exact-habit navigation, and related native
  flows. Avoid them and record any deferred finding.

## Scope

- Investigate known headless failures and performance contracts, especially D14,
  without changing thresholds or weakening assertions.
- Audit and safely improve dependency/security health, lint/type safety, error
  handling, database correctness, web performance, accessibility, test
  reliability, portability, build hygiene, documentation drift, and actionable
  TODO/FIXME/HACK items.
- Add focused unit/integration/headless regressions for discovered independent
  product bugs.
- Keep commits coherent and leave the branch unmerged for manual integration.

## Non-Goals

- Any Habit Reminder Interactions V2 implementation or native reminder flow.
- Android/iOS/emulator/device execution, EAS/native builds, Docker, remote
  Supabase mutation, deployment, or branch merges.
- Framework upgrades, speculative rewrites, broad cosmetic cleanup, weakened
  assertions, threshold increases, retries added only to hide failures, or
  large unproven dependency changes.
- Closing known external capability gaps that require native or remote access.

## Current Checkpoint

- Current milestone: two independent correctness fixes implemented and focused QA-green; preparing coherent commits.
- Completed: repository isolation/recovery and baseline audit; hardened persisted sync metadata against malformed/wrong-shaped local JSON; added three focused persistence regressions; guarded repeat soft-delete updates in todos, calories, and workout parent/nested rows; strengthened real-SQLite soft-delete SQL assertions.
- In progress: commit the completed correctness groups, then audit remaining lint warnings, documentation drift, and D14/headless behavior.
- Important modified files: `.agent/execplans/parallel-headless-hardening.md`; `core/sync/syncPersistence.ts`; `tests/syncPersistence.test.ts`; `features/todos/todos.data.ts`; `features/calories/calories.data.ts`; `features/workout/workout.data.ts`; related tests in `tests/todos.data.test.ts`, `tests/calories.data.test.ts`, and `tests/integration/softDelete.test.ts`.
- Last successful validation: focused sync persistence tests 3/3; todos/calories unit tests 21/21; soft-delete integration 7/7; typecheck PASS; focused ESLint PASS.
- Current failures: `npm audit` exits 1 with 24 advisories (1 low, 7 moderate, 16 high), predominantly transitive tooling/build dependencies; automatic remediation proposes framework/Metro 0.87 and Expo upgrades, so no dependency mutation is selected yet.
- Relevant quarantines: CG-1 through CG-6 are documented as closed on `origin/main`; external native/remote capability gaps remain documented.
- Blockers: None for audit or headless work. Native and remote lanes are intentionally out of scope.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: harden `core/sync/syncPersistence.ts` against malformed persisted JSON, add focused regression tests, and run its unit/affected QA.
- Remaining definition of done: multiple meaningful independent improvements where evidence supports them; regressions and affected QA; dependency/security classification; D14 status; coherent commits; final broad safe headless matrix; clean worktree; final merge-conflict handoff; plan COMPLETED and validated.

## Progress

- [x] Inspect current checkout, remote, branches, worktrees, and baseline commit.
- [x] Create and verify isolated worktree and `parallel/headless-hardening` branch.
- [x] Read repository/architecture/QA/known-gap/simulation/Habit Engine V2 context.
- [x] Run existing ExecPlan discovery.
- [x] Create this durable campaign plan.
- [x] Install/verify dependencies and establish fresh baseline evidence.
- [x] Audit and prioritize independent opportunities, including D14 and security/lint/type findings.
- [x] Implement first coherent low-conflict fix and focused regression.
- [x] Implement additional independent improvements with checkpoints.
- [ ] Run affected and broad safe headless validation; classify failures.
- [ ] Commit coherent logical groups and assess overlap.
- [ ] Complete and validate this plan.

## Surprises & Discoveries

- `origin/main` is the common baseline at `15a1a927`; the sibling reminder
  checkout has extensive uncommitted reminder changes and must remain untouched.
- Existing OpenSpec artifacts say Habit Engine V2 is locally complete but its
  remote migration/round-trip remains externally blocked; this campaign will
  not reopen that work.
- The known-gap register records CG-1 through CG-6 as closed on `origin/main`,
  so D14 must be measured against current source rather than assumed open.
- Fresh install reports a `simple-git-hooks` `ENOTDIR` warning in a linked
  worktree because `.git` is a file there; this is tooling/environment noise
  rather than a source regression and will be documented unless a safe,
  reviewable fix emerges.
- Static invariant audit found repeat soft-delete paths in todos, calories,
  and workout that update already-tombstoned rows because their `WHERE`
  clauses omit `deleted_at IS NULL`; these are independent of habit reminder
  work and are queued for a separate correctness commit.
- `core/sync/syncPersistence.ts` trusts arbitrary JSON from `app_meta`; a
  malformed or valid-but-wrong-shaped persisted outbox/status can break
  bootstrap. This is the first implementation target.

## Decision Log

- 2026-08-12 — Branch from clean `origin/main` — avoids importing uncommitted
  reminder work and minimizes merge conflicts.
- 2026-08-12 — Prefer low-conflict core/lib/scripts/tests/docs work — the active
  reminder session owns habit notification behavior and native flows.
- 2026-08-12 — No native or remote commands — required by the campaign boundary;
  document those lanes as not run rather than infer success.
- 2026-08-12 — Do not apply `npm audit fix` automatically — its dry run proposes
  Expo/React Native/Metro upgrades outside this campaign's compatibility scope
  and `package.json`/lockfile are high-conflict with the sibling branch.
- 2026-08-12 — Harden durable sync metadata at its boundary — persisted
  `app_meta` JSON is untrusted local state; invalid records should be ignored
  or reset to safe defaults so cold start remains available.

## Validation Ledger

- 2026-08-12 — `git status --short` in canonical checkout — PASS with reminder-session dirty files preserved.
- 2026-08-12 — `git fetch origin` — PASS; `origin/main` resolved to `15a1a927`.
- 2026-08-12 — `git worktree add -b parallel/headless-hardening ... origin/main` — PASS.
- 2026-08-12 — isolated worktree status/branch/HEAD/worktree list — PASS; clean branch at baseline.
- 2026-08-12 — `npm run agent:plans` — PASS; existing plans listed, including blocked Habit Engine V2 remote prerequisite.
- 2026-08-12 — `npm ci` — PASS with non-blocking linked-worktree hook warning; installed 1111 packages, audit reported 24 advisories.
- 2026-08-12 — `npm run qa:fast` — PASS; typecheck, lint (20 warnings/0 errors), and 610 unit tests.
- 2026-08-12 — `npm run openspec:validate` — PASS; 18/18 artifacts valid.
- 2026-08-12 — `npm run qa:impact:validate` — PASS; 12 impact-map rules valid.
- 2026-08-12 — `npm audit` — FAIL by advisory contract; 24 advisories classified, no automatic fix applied.
- 2026-08-12 — `npm run agent:resume -- --plan .agent/execplans/parallel-headless-hardening.md` — PASS; checkpoint and impact reconciled.

## Changed Files / Areas

- `.agent/execplans/parallel-headless-hardening.md` — durable campaign state.
- `core/sync/syncPersistence.ts` and `tests/syncPersistence.test.ts` — durable metadata validation and malformed-storage regressions.
- `features/todos/todos.data.ts`, `features/calories/calories.data.ts`,
  `features/workout/workout.data.ts` and relevant tests — idempotent soft-delete
  guards and real-SQLite SQL assertions.
- Future implementation files will be listed here as they are selected and
  validated; protected reminder files remain excluded.

## Recovery / Resume Instructions

1. Work only in `C:/Users/Michael Roy/Documents/super-habits-headless` on
   `parallel/headless-hardening`; never use the sibling reminder checkout.
2. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan; inspect `git status`,
   `git diff --stat`, `git diff --name-only`, and recent validation evidence.
3. Run `npm run agent:resume -- --plan .agent/execplans/parallel-headless-hardening.md`
   and reconcile any warning with Git before acting.
4. Continue from `Exact next action`, updating this plan at every milestone,
   failure, decision, and before broad QA.
5. Use a dedicated E2E port via `E2E_PORT` if Playwright is run; never kill an
   unknown process to free a port.
6. Before completion, run safe affected/broad headless gates, validate the plan,
   inspect changed-file overlap, commit coherent groups, and leave unmerged.

## Outcomes & Retrospective

- Status: Active.
- Summary: Campaign setup complete; implementation and final evidence pending.
- Follow-up: Record all deferred high-conflict/native/remote findings and provide
  a manual merge order recommendation in the final handoff.
