# ExecPlan: Harden Massive Parallel Completion Wave V2

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Turn the accepted massive parallel completion wave into production-grade behavior: correct durable semantics, coherent Backup/Portable/Supabase evolution, complete remote/native integrations, broad regression coverage, and exact-head CI closure.

## Context

- Repository: `quantdale/super-habits`.
- Authoring baseline: `4b9b8ccf0dee7ce9ed9b1c6b8b6a10e3c7732051` on remote `main` only.
- Prior implementation campaign: `openspec/changes/complete-product-roadmap-parallel-wave-v2/`.
- Primary input: its `HARDENING_HANDOFF.md`.
- The wave touched more than one hundred files across nearly every feature and intentionally deferred broad QA.
- Critical correction: the prior wave documents call the local schema v15, but authoritative `core/db/client.ts` already contains migrations 16, 17, 18, and 19. New local schema work must start from the actual next free migration, expected >=20.
- Current production Supabase already supports the pre-wave Backup Scope V4 planning contract; new durable fields from this hardening may require further additive DDL/version evolution.

Authoritative artifacts:

- `proposal.md`
- `design.md`
- `specs/parallel-wave-v2-hardening/spec.md`
- `tasks.md`
- this ExecPlan

## Scope

- Reconcile swarm residue and safe parallel workflow.
- Full correctness/regression hardening for all accepted V2 wave capabilities.
- Durable promotion of domain state that should survive reinstall/restore.
- Backup/Restore/Portable/Supabase contract evolution for approved fields/settings.
- Command Edge Function parity and deployment when accessible.
- Notification response action completion.
- Multi-record transaction/idempotency repairs.
- PWA/browser/native-as-available verification.
- Live Supabase migration/advisor/remote-boundary verification where access exists.
- Exact-final-SHA GitHub quality/e2e closure.

## Non-Goals

- Unrelated feature expansion.
- Force-push/history rewrite for mixed swarm attribution.
- Weakening ownership, RLS, restore emptiness, Backup/Portable integrity, Linked Action exactly-once, or canonical mutation boundaries.
- Faking environment-dependent native results.

## Current Checkpoint

- Current milestone: SHARED_LAYER_IMPLEMENTATION (Wave A — orchestrator-owned persistence/backup/sync/Supabase change set).
- Completed (2026-08-21 session): repo reconciled to 3d0b363 then campaign commits c162716 (checkpoint) + d817103 (parallel-commit protocol doc); residue swept (10 stashes dropped per audit, stash@{0}/@{1} of remaining two retained = old @{1} QuickCapture undo + old @{3} goal/project rollups); baseline typecheck/lint/vitest all PASS; 10-area parallel audit completed and preserved verbatim at `.agent/hardening-evidence/audit-reports.md` (1473 lines — authoritative defect inventory with file:line refs).
- Consolidated design decisions (2026-08-21):
  1. Migration v20 (single append-only block): `habits.status TEXT NOT NULL DEFAULT 'active'` + `habits.lifecycle_history TEXT NULL` (JSON intervals `{status,from_date_key,to_date_key|null}`); `pomodoro_sessions.linked_todo_id/linked_todo_title/note TEXT NULL`; new table `workout_session_sets(id TEXT PK, session_exercise_id TEXT NOT NULL, set_number INTEGER NOT NULL, weight REAL NULL, reps INTEGER NULL, weight_unit TEXT NULL, completed INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`; `workout_logs.started_at/ended_at TEXT NULL` + `duration_seconds INTEGER NULL`; index `idx_calorie_entries_consumed_on`. Bootstrap DDL gains the same objects.
  2. Backup Scope V5 epoch per audit Area10-F4 steps 1–8: freeze V4 columns+entity-set snapshots FIRST, rework resolveBackupScope (===4 → V4; ===5 → current; >5 → null), scope-aware backupEntityColumnsForScope, append-only column additions, workout_session_sets appended at END of BACKUP_ENTITIES, optionalColumnRule validators, portable formatVersion-2 branch accepts scope 4 (frozen V4 columns) and current scope. PORTABLE_BACKUP_FORMAT_VERSION stays 2.
  3. Settings V3 epoch per Area10-F8: BACKUP_SETTINGS_VERSION=3; new SQLite-backed app_meta keys calorie_targets, pomodoro_presets {presets,activePresetId}, workout_rest_seconds, notification_preferences {todoRemindersEnabled,dailyPlanReminderTime}; V2 payloads accepted via frozen V2 canonical text; new fields appended LAST in canonical text. Overview card layout stays device-local (documented presentation-only); command history stays local (privacy).
  4. Restore/portable P0 fixes: create applyRemoteProjects/Goals/DailyPlans; applyRemoteWeeklyReviews gains db param and moves inside restore transaction; portable import calls all 16 appliers; sync adapter projects rows onto BACKUP_ENTITY_COLUMNS before upsert (F5); V1 restore path validates rows (F7); getRemoteFingerprint tolerates missing remote entity tables fail-safe w/o weakening certified checks (F6); getBackfillStatusForSummary uses BACKUP_SCOPE_VERSION (F10); TABLES_WITH_DELETED_AT += weekly_reviews (F11); planning graph validation (F9); stale comments fixed (F14).
  5. Supabase: additive migration creating public.weekly_reviews (RLS + 4 owner policies + grants + owner index, pattern of planning migration) + additive migration for V5 columns + workout_session_sets table (composite owner FKs); simulation/backend/schema.sql parity incl. missing FKs/uq indexes/REAL types (F13); validate-supabase-schema.mjs weekly_reviews + new-column coverage (+ refactor to importable validate() with negative self-tests if budget allows).
  6. Delegation waves after Wave A lands: habits / todos(+quick-capture stash recovery) / pomodoro / workout / calories / planning(+rollup stash recovery) / command(+edge function) / notifications / overview-activity-progress consistency agents on disjoint file sets; E2E coverage agent(s); each consumes shared-layer types/helpers I ship in Wave A.
- In progress: Wave A implementation by primary agent (exclusive owner of core/db, core/backup, core/portable, core/sync, core/auth, supabase/migrations, validator script, fixture).
- Important modified files: none yet in Wave A.
- Last successful validation: baseline gates PASS at 3d0b363 (see Validation Ledger).
- Current failures: None in CI gates; ~60 audited defects being fixed per inventory above.
- Blockers: None.
- Exact next action: Implement Wave A edits file-by file starting with core/db/client.ts + core/db/types.ts (migration v20 + types), then backup types/validators/settings/restore, portable, sync adapter, auth, feature appliers, Supabase migrations + fixture + validator; run focused vitest after each cluster; commit in reviewable increments.
- Remaining definition of done: every non-environment task in `tasks.md` satisfied with evidence; full required QA green; live remote convergence where accessible; clean main-only Git state; exact final SHA has GitHub quality and e2e success.

## Progress

- [x] Authoring: independently review swarm result and current GitHub main.
- [x] Authoring: identify stale schema-version narrative and durable AsyncStorage risks.
- [x] Authoring: persist hardening proposal/design/spec/tasks/ExecPlan.
- [x] Reconcile current repository and clean swarm residue (stash audit done; drop/recover decisions recorded in Decision Log; recovery of stash@{1}/@{3} pending implementation).
- [x] Establish baseline full-QA failure inventory (typecheck/lint/vitest green at 3d0b363; browser smoke deferred to E2E phase).
- [ ] Parallel audit packets across 10 areas; consolidate defect inventory.
- [ ] Shared-layer change set: migrations v20+, backup scope V5, portable V3, settings V3, Supabase DDL incl. weekly_reviews, restore-import gap fixes (orchestrator-owned).
- [ ] Harden Habit lifecycle durability/history semantics.
- [ ] Harden Pomodoro session metadata durability.
- [ ] Establish real Workout metric provenance and persistence.
- [ ] Evolve Backup/Restore/Portable/settings contracts safely.
- [ ] Evolve/apply Supabase schema and validator safely.
- [ ] Close remote Command parser/classifier parity.
- [ ] Close Todo notification actions.
- [ ] Harden batch/copy/apply transaction and idempotency semantics.
- [ ] Harden cross-feature aggregates and PWA behavior.
- [ ] Run full unit/E2E/sync/simulation/timezone/native-as-available regression.
- [ ] Verify live remote state/advisors/deployment.
- [ ] Obtain exact-final-SHA GitHub quality/e2e green and close plan.

## Surprises & Discoveries

- 2026-08-21 — Prior swarm documentation repeatedly says schema v15 even though `core/db/client.ts` already has migrations through v19; any v16 SCHEMA_REQUEST instruction is stale and dangerous.
- 2026-08-21 — Habit pause/archive state currently lives only in AsyncStorage, so its scheduling/actionability meaning disappears on restore/reinstall.
- 2026-08-21 — Pomodoro Todo associations and notes currently live only in AsyncStorage even though they describe completed session history.
- 2026-08-21 — The wave itself reports lint-staged stash races that temporarily deleted/merged worker content; hardening must reconcile local stash residue and prevent recurrence.
- 2026-08-21 — Cloud restore (`core/backup/backupRestore.ts`) validates projects/goals/daily_plans rows but never imports them; the corresponding `applyRemote*` functions do not exist anywhere. Scope-V4 backups advertise recoverable data that restore silently drops.
- 2026-08-21 — Portable import (`core/portable/portableImport.ts`) validates but never imports `weekly_reviews`.
- 2026-08-21 — `weekly_reviews` is in BACKUP_ENTITIES/SYNCABLE_ENTITIES but has no Supabase table, no simulation fixture table, and no validator coverage: with remote enabled, its outbox pushes target a nonexistent remote table.
- 2026-08-21 — AGENTS.md "not synced" list is stale: `pomodoro_sessions`, `workout_logs`, nested workout tables, `saved_meals`, and linked-action rules are all enqueued/synced in current code.
- 2026-08-21 — Stash audit verdicts: stash@{0} empty; stash@{1} holds a finished QuickCapture "Recent captures + Undo" feature absent from main; stash@{3} holds goal/project rollup data functions + richer list/detail views (domain half IS in main); other 9 stashes duplicate main content.
- 2026-08-21 — Workout PR domain stack is complete but dormant: history UI feeds `weight: 0, reps: 0` placeholders and no capture path exists for load/reps/duration.

## Decision Log

- 2026-08-21 — Hardening is a convergence campaign, not another breadth wave.
- 2026-08-21 — Migration numbering derives from authoritative code, never the stale wave narrative. Verified head = v19; new migrations start at v20.
- 2026-08-21 — User-domain state that changes recorded behavior/history should survive restore; presentation/privacy-oriented preferences may remain local by explicit decision.
- 2026-08-21 — Do not blindly apply the handoff's workout SQL; first prove the correct data model and input provenance.
- 2026-08-21 — Shared persistence/backup/sync hotspots remain primary-agent-owned even if sub-agents are used for parallel hardening audits.
- 2026-08-21 — Stash dispositions: drop stash@{0} (empty) and the 9 duplicate stashes deliberately after this checkpoint is committed; RECOVER stash@{1} (QuickCapture undo) and stash@{3} (goal/project rollup data+views) as legitimate lost wave work — rollup recovery also satisfies task 11.1's real-SQLite rollup test requirement. Neither may overwrite newer main content; integrate via review.
- 2026-08-21 — Restore/portable import gaps for planning entities and weekly_reviews are defects against the already-issued Scope V4 contract; fixing them does not require weakening anything and precedes scope evolution work.

## Validation Ledger

- 2026-08-21 — GitHub compare `6dbbc426...` -> `4b9b8ccf...` — PASS — 45 commits, broad multi-feature wave present.
- 2026-08-21 — remote branch search — PASS — `main` only.
- 2026-08-21 — source inspection `core/db/client.ts` — PASS — migrations 16–19 exist; next new migration must be >=20.
- 2026-08-21 — source inspection Habit lifecycle store — PASS — AsyncStorage-only lifecycle confirmed.
- 2026-08-21 — source inspection Pomodoro session metadata store — PASS — AsyncStorage-only association/note confirmed.
- 2026-08-21 — `git fetch --prune` + fast-forward — PASS — local main == origin/main == 3d0b363; remote heads: main only.
- 2026-08-21 — `npm run agent:plans` — PASS — this plan ACTIVE; `harden-productivity-expansion-wave-v1` ACTIVE on environment gates only (left open honestly).
- 2026-08-21 — conflict-marker grep over tracked files — PASS — none found.
- 2026-08-21 — delegated 12-stash audit vs HEAD — PASS — verdicts recorded in Decision Log; no stash modified during audit.
- 2026-08-21 — `npm run typecheck` — PASS — exit 0 at 3d0b363.
- 2026-08-21 — `npm run lint` — PASS — 0 errors, 8 warnings (within policy).
- 2026-08-21 — `npx vitest run` (TZ=Asia/Manila) — PASS — 125 files, 1406 tests, both projects.

## Changed Files / Areas

Expected hardening areas include:

- `core/db/client.ts`, `core/db/types.ts`
- `features/habits/**`, `features/pomodoro/**`, `features/workout/**`
- affected Todos/Calories/Planning/Overview/Progress/Activity/Command/Settings files
- `core/backup/**`, `core/portable/**`, `core/sync/**`
- `core/notifications/**`, `lib/notifications.ts`
- `supabase/migrations/**`, `supabase/functions/parse-ai-command/**`
- simulation schema, schema validator, tests/e2e/QA artifacts
- this change's tasks/ExecPlan

Git remains authoritative for the actual diff.

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md`.
2. Read this entire change and prior wave `HARDENING_HANDOFF.md`.
3. Fetch/prune and reconcile latest origin/main.
4. Inspect `git status --short`, stashes, merge markers, actual migration head, current backup/portable versions, and live-access configuration.
5. Run `npm run agent:resume -- --plan openspec/changes/harden-parallel-completion-wave-v2/execplan.md` if supported.
6. Run OpenSpec/ExecPlan validators before implementation.
7. Continue only from `Exact next action`, updating this checkpoint whenever actual state differs.

## Outcomes & Retrospective

- Status: Active.
- Summary: Hardening implementation has not started; this plan captures the audited starting state and required convergence work.
- Follow-up: None yet; final follow-ups must be limited to genuinely environment-dependent or explicitly non-gating items after the campaign runs.
