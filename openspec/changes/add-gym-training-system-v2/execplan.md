# SuperHabits Gym V2 Full Training System

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Ship a coherent Gym / Training system in the existing Workout section so a user
can build routines from recognizable or custom exercises, prescribe and reorder
work, plan a week, train through a durable modality-aware guided session, record
body weight and effort, understand explainable progression/PRs, and recover the
complete dataset locally, through Backup V2, and through Portable Backup.

## Context

- Starting certified main SHA: `d0a9d84e7829efdf002f2ed6a8de3462b2e9bfbe`
- Working branch: `codex/add-gym-training-system-v2`
- Runtime schema observed in `core/db/client.ts`: v22; migration 23 is the next append-only block.
- Existing Workout implementation already owns routine CRUD, nested exercises/sets, quick logs, guided timer drafts, session-set provenance, PR detection, history detail, heatmap, linked-action logging, and backup restore adapters.
- The repository is offline-first: SQLite is authoritative; Supabase is optional backup; web uses SQLite WASM/OPFS and static Expo export.
- OpenGym repositories were used only for UX concept research. No source, assets, media, animations, or dataset will be copied.

## Scope

In scope: migration 22 and Workout model extensions; built-in/custom exercise identity; routine builder V2; weekly plan and date overrides; Today dashboard; guided strength/bodyweight/timed/cardio session flow; durable drafts; rest/wake/notification behavior; deterministic progression; body weight; PR/history/totals/body-area progress; ownership/sync/Backup V2/Portable/Supabase/simulation contracts; tests, PWA versioning, and docs.

## Non-Goals

- No social features, subscriptions, leaderboards, trainer marketplace, AI coaching, or network dependency.
- No large media/exercise-animation pipeline or copied openGym implementation/data.
- No new top-level navigation tab, competing persistence stack, or state-management framework.
- No automatic fuzzy remapping of legacy exercise names or mutation of historical training facts.

## Current Checkpoint

- Current milestone: Wave 5 certification and delivery — Gym V2 is implemented, validated, committed, pushed, and CI-certified.
- Completed: Repository preflight and OpenSpec artifacts; migration 22; exercise catalog/custom identity; routine prescriptions and reorder data API; weekly plan/overrides/Today; guided strength/bodyweight/timed/cardio sessions; durable drafts; progression; body weight; progress/totals; reminder/wake behavior; owner/account, sync, Backup V2, Portable, Supabase, simulation, PWA, and documentation contracts.
- In progress: None — all required implementation, validation, delivery, and evidence work is complete.
- Important modified files: `core/db`, `core/auth`, `core/backup`, `core/portable`, `core/notifications`, `features/workout`, `features/settings`, Supabase/simulation schemas, tests, E2E/QA maps, docs, and the OpenSpec change.
- Last successful validation: Full Vitest (147 files / 1,759 tests); lint (0 errors, 13 warnings); typecheck; OpenSpec all 41 items; committed web export; full browser matrix (233 listed, 190 passed, 43 expected skips, 0 failures); committed deterministic simulation (22/22 scenarios, 526/526 steps); e2e:sync (46/46); timezone matrix (5 zones); themes (140/140); Supabase schema; QA impact validation; focused Gym V2/legacy Workout (14/14); and CI success for `b626584a`.
- Current failures: No known product, migration, data/backup, typecheck, lint, web, browser, simulation-spec, sync-lane, or schema failure. The first long-lived simulation attempt ended without a final report after the harness session-age limit; bounded canonical-8081 reruns completed the full committed matrix. A probe on port 8094 exposed an existing simulation-helper hardcoded 8081 assumption; it is a harness/environment issue, not a product failure.
- Relevant quarantines: Native Android target is missing `com.dale16.superhabits`; native iOS is unavailable because Xcode `xcrun/simctl` is absent on Windows. The temporary canonical static server used for simulation was stopped after the run.
- Blockers: No product blocker. Native platform evidence remains environment-blocked as documented; CI completed successfully.
- Condition required to unblock: None for the delivered web/data product; native reruns require an installed Android e2e-test APK or a macOS/Xcode iOS target.
- Exact resume action after unblock: None — task complete.
- Exact next action: None — task complete.
- Remaining definition of done: None — all mandatory Gym V2 definition-of-done items are validated, delivered, and synchronized.

## Progress

- [x] Read AGENTS.md, PLANS, project map, rules, feature/RN/DB skills, testing/QA docs, and agent routing guidance.
- [x] Verify baseline SHA, branch policy context, clean worktree, origin/main equality, OpenSpec changes, and existing ExecPlans.
- [x] Inventory tracked repository and deep-read current Workout implementation plus DB/sync/backup/account contracts.
- [x] Create the Gym V2 OpenSpec proposal, design, capability spec, and task list.
- [x] Implement Wave 0 contracts and migration.
- [x] Implement Wave 1 routine builder and planning.
- [x] Implement Wave 2 guided session and progression.
- [x] Implement Wave 3 body weight and progress.
- [x] Implement Wave 4 tests, simulation, documentation, and shell reconciliation.
- [x] Complete Wave 5 certification, delivery, and exact-SHA evidence.

## Surprises & Discoveries

| Discovery                                                                                               | Impact / response                                                                                   |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| The current source is already schema v21, despite stale skill prose mentioning older versions.          | Treat `core/db/client.ts`, AGENTS, and project map as authoritative; append migration 22.           |
| Scope v5 includes session sets and timing but the portable validator only accepts scope 4 or current.   | Freeze current pre-Gym columns/entity set as historical scope 5 before adding scope 6.              |
| `ACCOUNT_USER_TABLES` does not list `workout_session_sets` even though Backup V2 does.                  | Add it while extending the emptiness boundary and test restore safety.                              |
| Routine history currently displays a current routine name, while old rows only snapshot exercise names. | Add a nullable routine-name snapshot for new logs and retain current-name fallback for legacy logs. |
| The existing guided timer is the compatibility spine and old E2E expects timed legacy rows.             | Preserve legacy missing-modality behavior as timed; new manual modalities use explicit completion.  |

## Decision Log

| Decision                                                                                                         | Rationale                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Four new tables: `custom_exercises`, `workout_weekly_plan`, `workout_schedule_overrides`, `body_weight_entries`. | Covers distinct lifecycles/cardinalities without mirroring every UI component.        |
| One weekly row per weekday with explicit `workout` or `rest`; date overrides are separate soft-deleted rows.     | Simple local-calendar resolution and no accidental mutation of recurring plans.       |
| Static built-in catalog in TypeScript; only custom identities sync.                                              | Avoids licensing/network uncertainty and keeps backups user-owned.                    |
| Extend routine/session rows with nullable fields instead of replacing tables.                                    | Preserves legacy rows, IDs, soft-delete behavior, and existing adapters.              |
| Effort scale is stored per session set, while the current preference is recoverable settings.                    | Historical values remain interpretable if the user later changes from RPE to RIR/off. |
| Body-weight values remain in entered units.                                                                      | Display preference changes cannot destructively alter sensitive history.              |
| Scope version advances 5 → 6; settings contract advances 4 → 5.                                                  | Exact integrity manifests and old portable/cloud backups remain verifiable.           |

## Validation Ledger

| Check                               | Status                        | Evidence / next action                                                                                                                                                                      |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git baseline/status/branch/origin   | PASS                          | Starting SHA verified; branch created; all current edits are campaign-scoped.                                                                                                               |
| OpenSpec artifacts                  | PASS                          | Proposal/design/spec/tasks/plan written; 41/41 repository OpenSpec items validate and Gym V2 task 5.2 is complete.                                                                          |
| Migration/domain focused tests      | PASS                          | Migration 22 integration 8/8; Workout domain/integrity/reminder 40/40.                                                                                                                      |
| Backup/portable/account integration | PASS                          | Scope-6 Backup/Portable/owner recovery suites and e2e:sync 46/46 are green; invalid/corrupt/reference rejection remains covered.                                                            |
| Workout E2E/simulation              | PASS                          | Focused Workout 14/14; committed deterministic simulation 22/22 unique scenarios and 526/526 steps passed with final SHA-stamped reports; full browser matrix 190 passed/43 expected skips. |
| Typecheck/lint/build/full tests     | PASS                          | Typecheck, lint 0 errors/13 warnings, web export, and Vitest 1,759/1,759 pass.                                                                                                              |
| Native Workout QA                   | PASS WITH ENVIRONMENT BLOCKER | Android smoke/targeted/lifecycle report missing installed APK; iOS report lacks Xcode xcrun/simctl.                                                                                         |
| Exact remote SHA/CI                 | PASS                          | Local HEAD and `origin/codex/add-gym-training-system-v2` both equal `b626584aab43945c87e970b78f7651a7174857de`; CI run 32673553567 succeeded.                                               |

## Changed Files / Areas

Expected implementation areas (final list must be reconciled against Git):

- `core/db/client.ts`, `core/db/types.ts`, `core/db/appMeta.ts`, account ownership tables.
- `features/workout/` data/domain/catalog/types/screens/components.
- `core/backup/`, `core/portable/`, `core/sync/`, notification/settings contracts.
- Supabase and simulation backend schema/contracts.
- Workout unit/integration tests, E2E journeys/helpers, simulation seeders/scenarios.
- QA impact map, PWA service worker version, project/backup/Workout documentation.
- `openspec/changes/add-gym-training-system-v2/` artifacts.

## Recovery / Resume Instructions

After compaction or a fresh session:

1. Read `AGENTS.md`, `.agent/PLANS.md`, this file, and the OpenSpec artifacts.
2. Run `npm run agent:resume -- --plan openspec/changes/add-gym-training-system-v2/execplan.md`.
3. Inspect `git status --short`, `git diff --stat`, `git diff --name-only`, recent QA evidence, and OpenSpec status.
4. Run `npm run qa:affected` when the changed-file impact map supports it.
5. Continue from the exact `Current Checkpoint` action; do not create a second task-state file.

## Outcomes & Retrospective

- Final delivery tree: `codex/add-gym-training-system-v2` is pushed and clean;
  local HEAD equals `origin/codex/add-gym-training-system-v2` at
  `b626584aab43945c87e970b78f7651a7174857de` at the time of this closeout
  record. The closeout metadata commit itself is documentation-only.
- Persistence: runtime schema v22 via append-only migration 22; Backup scope 6;
  Backup settings version 5; legacy scope snapshots remain restorable.
- Shipped outcome: built-in/custom/legacy exercise identity; type-aware routine
  prescriptions and reorder; weekly plan and date overrides; Today dashboard;
  strength/bodyweight/timed/cardio guided sessions; durable drafts; rest/wake
  behavior; effort; manual/linear/double progression; PR/history/totals/body
  areas; body-weight trend/goal; notifications; owner-safe sync, Backup V2,
  Restore V2, Portable Backup, Supabase contracts, and legacy quick-complete.
- Evidence: full unit/integration, typecheck, lint, web export, OpenSpec,
  themes, timezones, focused Workout E2E, full browser matrix, committed
  deterministic simulation (22/22, 526 steps), e2e:sync (46/46), Supabase
  schema, and QA-impact validation passed. CI run 32673553567 succeeded for
  the pushed SHA.
- Deliberate debt: native Android smoke/targeted/lifecycle lanes are blocked by
  the missing installed `com.dale16.superhabits` APK; iOS is blocked by missing
  Xcode `xcrun/simctl` on Windows. No native success is claimed for this wave.
