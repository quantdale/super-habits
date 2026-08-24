# ExecPlan: SuperHabits Gym / Workout V2 Deep Expansion

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Extend the already-shipped Gym V2 Workout section into a more truthful,
recoverable training system: exercise definitions carry durable semantics,
unilateral work stays per-side, progression and PRs are modality-aware,
active sessions survive interruption, and existing Today/weekly-review and
backup/portable flows understand the result.

## Context

- Starting SHA: `110bb236ccf212ba1e791255fa91c4f743a0c1fd`.
- Branch: `codex/add-gym-training-system-v2`; worktree was clean at start.
- Existing prior campaign: `openspec/changes/add-gym-training-system-v2/`,
  complete with migration 22, scope 6, Gym V2 catalog/custom exercises,
  planning, guided modalities, progression, body weight, history, reminders,
  Backup V2, Portable Backup, simulation, and browser evidence.
- This change is deliberately additive and does not replace that completed
  campaign or alter account ownership/full-sync boundaries.
- Runtime authority is the bootstrap DDL plus append-only migrations in
  `core/db/client.ts`; the next local migration is 24 unless state changes.
- SQLite is authoritative and the existing `runBackupMutation`/outbox,
  soft-delete, `createId`, `toDateKey`, and single-page shell invariants apply.
- Bundled catalog data is repository-authored static source; no openGym source,
  media, artwork, or dataset is copied.

## Scope

- Exercise aliases/instructions/external-load metadata and routine/session
  unilateral snapshots.
- Pure modality-aware progression, 12-rep 1RM eligibility, PR classification,
  exercise-level trend reducers, and UI presentation.
- Active draft/session hardening and existing Today/weekly-review/reminder
  composition.
- Coordinated migration, backup scope, portable, restore, Supabase,
  simulation, browser/native tests, docs, and QA evidence.

## Non-Goals

- Full two-way Supabase sync, auth/account changes, new navigation surfaces,
  social/coaching/AI/paywall/telemetry, copied external assets, or a 1,000+
  exercise claim.
- Limb-by-limb performed-set rows, percentage/Greyskull programming, or a
  complete cardio lab; retain extension points for later work.

## Current Checkpoint

- Current milestone: Implementation, source-state QA, coherent commits, and
  remote delivery are complete; this is the final completed-state checkpoint.
- Completed: Read `AGENTS.md`, `.agent/PLANS.md`, authoritative project/rule
  docs, Codex workflow, repository skills, current Workout implementation,
  existing Gym V2 OpenSpec/ExecPlan, completed UI/UX/product-roadmap campaign
  artifacts, and current backup/sync/migration contracts. Verified clean
  baseline and created this change's proposal, two capability specs, design,
  tasks, and this Plan-Version 2 ExecPlan.
- Completed in source: scope-7 entity/column contracts, explicit frozen scope-6
  portable compatibility, migration fixtures, aliases/instructions/catalog
  search, routine/session unilateral and external-load propagation, active
  measurement draft persistence, typed timed/cardio duration entry,
  identity-first previous-performance lookup, exercise-level history summaries,
  Today/Next Best Action states, weekly-review workout summaries, manual
  confirmation for typed strength/bodyweight sets, superset sequencing,
  cardio-distance PR classification, and correction/skip/early-finish browser
  journeys.
- Completed in QA: focused Workout domain/PR tests (61), full Vitest (147
  files/1,774 tests), typecheck, lint (0 errors/13 existing warnings), fresh
  web build, sync E2E (46/46), deterministic simulation (22/22), Supabase
  schema validation, QA impact validation, timezone matrix, and the six-test
  Gym V2 Playwright journey. The earlier full `qa:full` browser matrix passed
  190/190 with 43 skips; a fresh source-state matrix exposed one
  non-reproducible HEAVY latency miss (805ms against the unchanged 800ms P2
  ceiling), while the complete P2 journey rerun passed 7/7 with a 728ms max.
- Native QA is explicitly environment-blocked: Android smoke, targeted
  persistence, and lifecycle lanes found no installed
  `com.dale16.superhabits` target; iOS smoke cannot run because Xcode/simctl is
  unavailable on this Windows host. Reports and replay/remediation commands
  are recorded in the final handoff.
- Final sync evidence: the committed-tree `dist-sync` rebuild passed; the
  full 46-test sync run had one non-reproducible portable-owner recovery label
  timeout (45 passed, 1 failed), and the complete owner-recovery file rerun
  passed 6/6. The failure artifact is preserved under
  `.cursor/playwright-output/e2e-failures/portable-owner-recovery-A--f4b1f-account-portable-owner-sync-journeys-sync/`.
- Completed: inspected the complete diff, created coherent implementation,
  recovery, and documentation commits, and pushed the branch. The exact final
  HEAD SHA is recorded in the campaign handoff.
- In progress: None; no implementation or delivery work remains.
- Important modified files: `core/db/client.ts`, `core/db/types.ts`,
  `core/backup/backup.types.ts`, `features/workout/exerciseCatalog.ts`,
  `features/workout/workout.data.ts`, `features/workout/workout.domain.ts`,
  `features/workout/RoutineDetailScreen.tsx`, `features/workout/WorkoutSessionScreen.tsx`,
  the backup/portable contracts, simulation fixtures, and focused Workout
  tests/E2E.
- Last successful validation: `npm run qa:affected` impact planning (matched
  workout, DB/migration, E2E/simulation, native, and documentation rules),
  `npm run openspec:validate` (42 items), and the focused/full gates listed in
  the Validation Ledger below.
- Current failures: None observed in the final source-state product checks;
  native lanes are environment-only limitations documented above and below.
- Relevant quarantines: native Android/iOS availability remains an explicit
  environment limitation, not a pass.
- Blockers: None.
- Condition required to unblock: None for web/local delivery; native evidence
  requires an installed e2e-test Android APK/device and a macOS/Xcode host for
  iOS.
- Exact resume action after unblock: No implementation action remains; if
  remote CI or native targets become available, run the documented follow-up
  validation commands and append evidence without changing the completed
  contract.
- Exact next action: No implementation action remains; final handoff only.
- Remaining definition of done: Completed for the available environment. All
  applicable tasks are evidenced, the repository remains buildable, V1/prior
  Gym V2 data and recovery contracts remain compatible, and the final report
  separates PASS, environment-only limitations, and deferred P2 work.

## Progress

- [x] Orientation and baseline inspection.
- [x] Read required project, feature, RN, DB/sync, OpenSpec, and QA guidance.
- [x] Review prior Gym V2 and completed UI/UX/product-roadmap campaign state.
- [x] Create proposal, capability specs, design, tasks, and this ExecPlan.
- [x] Validate OpenSpec change and ExecPlan before implementation.
- [x] Implement migration/type/catalog/legacy semantic foundation.
- [x] Implement routine/session unilateral and metadata persistence/UI.
- [x] Implement progression/PR/history domain and presentation.
- [x] Integrate Today/weekly-review behavior; existing workout reminder
      scheduling remains covered by its prior schedule-aware contract.
- [x] Extend backup/portable/restore/Supabase contracts and validate scope 7.
- [x] Extend new deep semantics into deterministic simulation observations.
- [x] Add native evidence and finish affected/full QA.
- [x] Commit/push coherent checkpoints and complete final handoff evidence.

## Surprises & Discoveries

- The starting branch already contains a complete earlier Gym V2 campaign at
  schema 22/scope 6; this task must extend it rather than recreate it.
- Existing code already has a curated static catalog, custom `unilateral`
  metadata, Workout reminders, and a coarse weekly-review workout summary, but
  routine/session snapshots and richer semantic PR/progression behavior are
  incomplete.
- Current `estimate1RM()` accepts up to 30 reps, which conflicts with the new
  documented 12-rep eligibility contract; high-rep load/rep history must stay
  intact while 1RM math tightens.
- The existing active timer was authoritative for legacy/free-text and timed
  entries but too eager for typed strength/bodyweight sets; the final contract
  keeps the timer as pacing for those modalities and requires explicit Complete
  or Skip, preserving old routine timing behavior.
- The existing portable E2E fixture expected scope 6 even though the additive
  metadata contract correctly advances current backups to scope 7; the stale
  assertion was updated while preserving frozen scope-6 compatibility.
- Existing `WorkoutRoutine`/nested rows and backup registry are shared
  hotspots; schema and scope edits must remain serialized in this orchestrator.

## Decision Log

- 2026-08-24 — Build `add-gym-workout-v2` as an additive second-wave change —
  prior `add-gym-training-system-v2` is complete and must remain auditable.
- 2026-08-24 — Use migration 23 and backup scope 7 when implementation confirms
  no intervening schema change — runtime files are authoritative over stale
  prose.
- 2026-08-24 — Snapshot unilateral/external-load semantics on routine and
  session exercise rows rather than deriving them from current catalog data —
  old history must remain legible after catalog edits.
- 2026-08-24 — Keep drafts local-operational and performed rows insert-only —
  recovery must not create fake completed remote workouts.
- 2026-08-24 — Cap estimated 1RM at 12 reps while retaining higher-rep load/rep
  history — truthful analytics without data loss.
- 2026-08-24 — Treat cardio distance as a first-class PR/history metric while
  leaving weight×reps volume undefined for cardio; timed and distance events
  remain distinct from strength PRs.
- 2026-08-24 — Persist superset grouping in the existing routine/session
  exercise context and sequence adjacent grouped exercises without inserting a
  full rest between them; rest remains a group boundary concern.
- 2026-08-24 — Use explicit typed-set completion in the active UI and keep
  correction local to the draft until the user completes or skips the set;
  recommendations never become performed data automatically.

## Validation Ledger

- 2026-08-24 — `git status --short`, branch/HEAD/recent log — PASS; clean
  baseline at `110bb236` on `codex/add-gym-training-system-v2`.
- 2026-08-24 — Required repository/skill/workflow reads — PASS; completed.
- 2026-08-24 — Existing `openspec list --json` — PASS; prior Gym V2 complete
  (24/24) and this change newly scaffolded.
- 2026-08-24 — `openspec validate --changes add-gym-workout-v2` — PASS; all
  42 repository change items validated.
- 2026-08-24 — `npm run agent:plan:validate -- --plan openspec/changes/add-gym-workout-v2/execplan.md` — PASS; final COMPLETED-state validation.
- 2026-08-24 — `npx vitest run tests/workout.domain.test.ts tests/workout.pr.test.ts` — PASS; 61 tests.
- 2026-08-24 — `npm test` — PASS; 147 files and 1,774 tests.
- 2026-08-24 — `npm run typecheck` — PASS; zero TypeScript errors.
- 2026-08-24 — `npm run lint` — PASS; 0 errors and 13 existing warnings.
- 2026-08-24 — `npm run qa:affected` — PASS; impact plan matched the expected
  Workout, database/migration, E2E/simulation, native, and documentation gates.
- 2026-08-24 — `npm run supabase:schema:validate` — PASS; 14 migration files,
  owner-scoped sync/backup tables, planning/weekly-review closure, and Gym V2
  scope-V6/V7 closure.
- 2026-08-24 — `npm run qa:impact:validate` — PASS; 13 impact rules.
- 2026-08-24 — `npm run qa:timezones` — PASS; five timezone matrices, 43 tests
  each.
- 2026-08-24 — `npm run build:web` — PASS; fresh static export.
- 2026-08-24 — `npx playwright test e2e/workout-gym-v2.spec.ts` — PASS; 6/6
  after correction and skip/early-finish assertions.
- 2026-08-24 — `npm run e2e` via the earlier final `npm run qa:full` — PASS;
  190 passed, 43 skipped.
- 2026-08-24 — `npm run e2e` fresh after the final source changes —
  FLAKY_TEST/host-performance classification; 185 passed, 43 skipped, one
  P2 HEAVY section switch measured at 805ms against the unchanged 800ms
  ceiling, and four later serial cases did not run. Artifact:
  `.cursor/playwright-output/e2e-failures/three-months-in-P2-—-Tom-t-9ffe1-x-of-6-measured-switches-p2-journeys/`.
- 2026-08-24 — `npx playwright test e2e/journeys/three-months-in.spec.ts
--project=journeys` — PASS; complete seeded P2 journey 7/7, max
  section-switch latency 728ms.
- 2026-08-24 — `npm run e2e:sync` — PASS; 46/46.
- 2026-08-24 — `npm run build:sync` — PASS; fresh committed-tree `dist-sync`
  export with dummy Supabase credentials.
- 2026-08-24 — `npm run e2e:sync` fresh — FLAKY_TEST/host-timing
  classification; 45 passed and one portable-owner recovery assertion timed
  out waiting for `Protected`. Focused rerun below passed all six tests.
- 2026-08-24 — `npm run e2e:sync -- e2e/journeys/portable-owner-recovery.spec.ts`
  — PASS; 6/6 portable-owner recovery tests.
- 2026-08-24 — `npm run sim:validate` and deterministic simulation — PASS; 22
  scenarios.
- 2026-08-24 — Native Android smoke/targeted/lifecycle — ENVIRONMENT; no
  installed `com.dale16.superhabits` target. Reports:
  `simulation-output/native/native-android-smoke-2026-08-24T040201040Z.json`,
  `simulation-output/native/native-android-persistence-2026-08-24T040217244Z.json`,
  and `simulation-output/native/native-android-lifecycle-2026-08-24T040217220Z.json`.
- 2026-08-24 — Native iOS smoke — ENVIRONMENT; Xcode `xcrun`/`simctl` is
  unavailable on this Windows host. Report:
  `simulation-output/native/native-ios-smoke-2026-08-24T040224965Z.json`.

## Changed Files / Areas

- `openspec/changes/add-gym-workout-v2/proposal.md` — motivation, capability,
  impact, and guardrails.
- `openspec/changes/add-gym-workout-v2/specs/**` — normative deep-expansion
  and recovery requirements.
- `openspec/changes/add-gym-workout-v2/design.md` — additive data/domain/UI/
  recovery architecture and trade-offs.
- `openspec/changes/add-gym-workout-v2/tasks.md` — ordered implementation and
  verification checklist.
- `openspec/changes/add-gym-workout-v2/execplan.md` — resumable campaign state.
- `core/db/client.ts` — append-only migration 23 for semantic snapshots and
  custom exercise metadata.
- `core/db/types.ts`, `features/workout/exerciseCatalog.ts`,
  `features/workout/workout.data.ts` — typed catalog/data propagation and
  legacy-compatible normalization.
- `features/workout/workout.domain.ts`, `tests/workout.domain.test.ts`,
  `tests/workout.pr.test.ts` — 12-rep e1RM eligibility, identity-aware PR
  classification, timed/bodyweight progression, and focused coverage.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this ExecPlan.
2. Run `git status --short`, `git diff --stat`, and inspect the change
   artifacts; Git is authoritative for actual files.
3. Run `npm run agent:resume -- --plan openspec/changes/add-gym-workout-v2/execplan.md`
   and reconcile warnings with this checkpoint.
4. Read the OpenSpec apply context via
   `openspec instructions apply --change add-gym-workout-v2 --json`.
5. Continue only from `Exact next action`, updating this checkpoint after each
   migration/domain/recovery/QA milestone.

## Outcomes & Retrospective

- Status: COMPLETED. The implementation, validation, coherent commits, and
  remote push are complete.
- Summary: The campaign now has additive migration 23 semantics, identity-
  aware exercise metadata, modality-correct set logging and progression/PR
  behavior, crash-safe typed drafts, superset sequencing, Today/weekly-review
  integration, scope-7 cloud/portable recovery, simulation observations, and
  focused/browser regression coverage while preserving frozen scope-6 backup
  compatibility and V1 workout behavior.
- Native limitation: Android smoke/targeted/lifecycle require an installed
  `com.dale16.superhabits` e2e-test target; iOS requires macOS/Xcode. The
  recorded reports remain environment-only limitations.
- Deferred P2: complete cardio-lab analytics, percentage/Greyskull programming,
  limb-specific performed-set rows, keep-screen-awake/equipment profiles, and
  richer analytics remain extension points rather than fragile partial work.
- Commits: `9efacb6` (Workout semantics/session analytics), `d5e47ad`
  (scope-7 backup/recovery), `438aaf0` (OpenSpec/maps/docs), and `f40d73b`
  (completed ExecPlan closure), followed by this final evidence update. The
  final HEAD SHA is reported by the handoff.
