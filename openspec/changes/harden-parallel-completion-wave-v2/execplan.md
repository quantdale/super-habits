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

- Current milestone: RECONCILIATION_AND_BASELINE_DONE — entering parallel audit phase.
- Completed (2026-08-21 session): fetched/pruned origin; fast-forwarded local main `4b9b8cc` -> `3d0b363` (campaign spec commit); confirmed remote has only `main`; read AGENTS.md, `.agent/PLANS.md`, prior wave HARDENING_HANDOFF, and all five authoritative files of this change; ran `npm run agent:plans` (this plan ACTIVE; `harden-productivity-expansion-wave-v1` also ACTIVE awaiting environment gates — must NOT be falsely closed); verified actual SQLite migration head is v19 so new migrations start at v20; grepped tracked files for conflict markers (none); audited all 12 lint-staged stashes against HEAD via delegated read-only audit (stash@{0} empty, stash@{1} unique QuickCapture "Recent captures + Undo" feature, stash@{3} unique goal/project rollup data layer + richer list views, remaining 9 duplicate current main); ran baseline QA: typecheck PASS, lint PASS (0 errors / 8 warnings), full Vitest PASS 1406/1406 in both projects under TZ=Asia/Manila; produced a persistence-layer dossier via delegated reconnaissance.
- Key dossier findings driving design: (1) cloud restore validates but never imports projects/goals/daily_plans — no `applyRemoteProjects/Goals/DailyPlans` exist (`core/backup/backupRestore.ts` import stops at weekly_reviews); (2) portable import never imports weekly_reviews (`core/portable/portableImport.ts` stops at linked_action_rules); (3) `weekly_reviews` has NO Supabase table, fixture presence, or validator coverage although it is in BACKUP_ENTITIES/SYNCABLE_ENTITIES, so outbox pushes target a nonexistent remote table; (4) habit lifecycle is AsyncStorage-only and consumed by HabitsScreen only (not Overview/planning/reminders/command/progress); (5) pomodoro session association/note AsyncStorage-only; `pomodoro_sessions` has only bootstrap columns; (6) workout weight/reps/duration have no storage anywhere; PR domain stack is fed zero placeholders; user never enters weight/reps today; (7) todo reminder mark-done/snooze actions registered but dispatcher classifies them as unknown; durable dedupe exists via `processed_notification_actions`; (8) settings allowlist currently covers calorieGoal + pomodoroSettings + theme mode/slots at BACKUP_SETTINGS_VERSION 2; (9) BACKUP_SCOPE_VERSION=4, PORTABLE_BACKUP_FORMAT_VERSION=2, historical scope epochs V2/V3 frozen in backup.types.ts; (10) AGENTS.md sync-list statements are stale (pomodoro_sessions/workout_logs/nested workout tables/saved_meals/linked_action_rules ARE synced).
- In progress: parallel read-only audit packets across 10 feature/boundary areas to finalize defect inventory and schema design inputs.
- Important modified files: none yet (working tree clean at 3d0b363).
- Last successful validation: baseline typecheck/lint/vitest all PASS (see Validation Ledger).
- Current failures: None in CI gates; functional recoverability gaps above are defects to fix, not test failures.
- Relevant quarantines: None accepted as final; will classify during QA.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Launch ~10 parallel read-only audit packets (habits/todos lifecycle+bulk, planning idempotency+rollups, pomodoro timing, workout provenance, calories copy-day, command remote parity, notification actions, cross-feature consistency, PWA behavior, restore/portable/sync boundary). Then design migrations v20+ (habits status+lifecycle history, pomodoro linked_todo_id/linked_todo_title/note, workout load/reps/duration per chosen model), Backup Scope V5, Portable V3, Settings V3, Supabase additive DDL incl. weekly_reviews table, and restore-import gap fixes as one orchestrator-owned shared-layer change set.
- Remaining definition of done: every non-environment task in `tasks.md` satisfied with evidence; all current durable-domain state coherently represented across local/Backup/Portable/remote layers; full required QA green; live remote convergence complete where required and accessible; clean main-only Git state; exact final SHA has GitHub quality and e2e success.

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
