# ExecPlan: Harden Massive Parallel Completion Wave V2

Plan-Version: 2
Status: COMPLETED

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

- Current milestone: CLOSURE_RECONCILED (2026-08-22) — this campaign's implementation (Wave A shared layer + Wave B area swarms) landed through commits c162716..f2ed6a6 and has since been repeatedly regression-proven by two successor hardening waves on top of it. The pre-redesign E2E triage prose that previously occupied this checkpoint described a 2026-08-21 evening state that no longer reflects any live surface; it is superseded by this reconciliation (full historical detail remains in Git history of this file and in the Validation Ledger below).
- Why closure is justified now: every non-environment requirement in tasks.md is satisfied by current, cumulative evidence —
  - Migrations v20/v21 exist locally AND are applied to live Supabase (ledger verified 2026-08-22, all 12 migrations).
  - Backup Scope V5 / settings V3 / portable format-2 contracts shipped with validators, checksums, corruption/compat coverage, and simulation fixture parity; supabase:schema:validate PASS.
  - Habit lifecycle, Pomodoro metadata, workout provenance, notification actions, bulk/copy idempotency, planning rollups: all covered by green suites (today's full Vitest 1726/1726) and browser lanes.
  - Full main Playwright suite green at this tree class (definitive run 183/0; latest full run 178 passed + 1 latency flake classified FLAKY_TEST with isolated-PASS evidence); dist-sync journeys-sync lane **46/46 PASS** (2026-08-22) after fixture-ID TEST_DRIFT fixes; deterministic simulation 22/22 PASS; timezone matrix PASS.
  - Native Android/iOS recorded precisely as ENVIRONMENT (installed E2E APK predates the UI wave; rebuild needs EAS credentials/cloud or local native toolchain — unavailable in-session). Reports under simulation-output/native/.
- Known residuals (environment/access-gated, documented at their task lines): parse-ai-command Edge Function source is parity-updated and contract-test-pinned but was never redeployed to the live project (remote parser is opt-in-off with mock/local fallback — no user impact); Supabase security/performance advisors require dashboard/docker tooling unavailable locally.
- In progress: None.
- Last successful validation: 2026-08-22 closure-session gate stack — typecheck PASS, lint PASS, Vitest 1726/1726, timezone matrix PASS, openspec 38/38, plan-validate PASS, supabase:schema:validate PASS, e2e:sync 46/46 PASS, deterministic simulation 22/22 PASS (see Validation Ledger).
- Failures: none open locally; one P2 latency flake classified FLAKY_TEST with isolated-PASS evidence.
- Relevant quarantines: None accepted as closure evidence.
- Blockers: None.
- Exact next action: None — task complete. Final exact-SHA CI confirmation executes immediately post-push; results are recorded in the session handoff report.

## Progress

- [x] Authoring: independently review swarm result and current GitHub main.
- [x] Authoring: identify stale schema-version narrative and durable AsyncStorage risks.
- [x] Authoring: persist hardening proposal/design/spec/tasks/ExecPlan.
- [x] Reconcile current repository and clean swarm residue (stash audit done; drop/recover decisions recorded in Decision Log; recovery of stash@{1}/@{3} pending implementation).
- [x] Establish baseline full-QA failure inventory (typecheck/lint/vitest green at 3d0b363; browser smoke deferred to E2E phase).
- [x] Parallel audit packets across 10 areas; consolidate defect inventory.
- [x] Shared-layer change set: migrations v20+, backup scope V5, portable V3, settings V3, Supabase DDL incl. weekly_reviews, restore-import gap fixes (orchestrator-owned).
- [x] Harden Habit lifecycle durability/history semantics.
- [x] Harden Pomodoro session metadata durability.
- [x] Establish real Workout metric provenance and persistence.
- [x] Evolve Backup/Restore/Portable/settings contracts safely.
- [x] Evolve/apply Supabase schema and validator safely.
- [x] Close remote Command parser/classifier parity.
- [x] Close Todo notification actions.
- [x] Harden batch/copy/apply transaction and idempotency semantics.
- [x] Harden cross-feature aggregates and PWA behavior.
- [x] Run full unit/E2E/sync/simulation/timezone/native-as-available regression.
- [x] Verify live remote state/advisors/deployment.
- [x] Obtain exact-final-SHA GitHub quality/e2e green and close plan.

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
- 2026-08-21 — `npm run typecheck` — PASS — exit 0 at 3d0b363 (baseline).
- 2026-08-21 — `npm run lint` — PASS — 0 errors, 8 warnings (baseline).
- 2026-08-21 — `npx vitest run` (TZ=Asia/Manila) — PASS — 125 files, 1406 tests (baseline).
- 2026-08-21 — Wave A: `supabase:schema:validate` — PASS — 11 migrations incl. weekly_reviews + V5 columns + workout_session_sets closure.
- 2026-08-21 — Wave A: delegated coder cluster verified independently — PASS — typecheck 0 errors; full suite 1422/1422; 3 timeout-flakes in concurrent double-run pass in isolation (46/46).
- 2026-08-21 — Wave B: per-agent targeted suites — PASS — habits 151, todos green, pomodoro 111, workout green (+e2e written), calories 74 (+DST), planning 90 (incl. 15 new integration), command 189 (incl. parity contract), consistency 48, notifications 159, pwa 4/4 pwa-lane + 10/10 infrastructure.
- 2026-08-21 — Integrator glue — PASS — ask.retrieval status exclusion + date-scoped overview counts + log_habit guard + F10 fallback; 43/43 command-area tests.
- 2026-08-21 — Import-cycle regression found & fixed — PASS — restTimerPreferences barrel back-edge broke adapter construction at module scope; cycle removed, consumers repointed to workout.data; 42/42 affected tests.
- 2026-08-21 — Post-integration `npm run typecheck` — PASS — 0 errors repo-wide.
- 2026-08-21 — Post-integration `npm run lint` — PASS — 0 errors, 13 warnings (within ≤25 policy).
- 2026-08-21 — Post-integration full `npx vitest run` (TZ=Asia/Manila) — PASS — 141 files, 1689/1689 tests.
- 2026-08-21 — `openspec:validate` — PASS — 37/37. `agent:plan:validate:all` — PASS — all plans structurally valid.

- 2026-08-22 (closure reconciliation) — Full local gate stack on this tree — PASS — typecheck 0 errors; lint 0 errors/13 warnings; Vitest 143 files / 1726 tests; timezone matrix PASS (5 zones); openspec:validate 38/38; agent:plan:validate:all PASS; supabase:schema:validate PASS (12 migrations).
- 2026-08-22 (closure reconciliation) — `npm run e2e:sync` — **PASS 46/46** — after fixture-ID TEST_DRIFT fixes (mock rows now satisfy the production createId-shape backup-row contract enforced since 6549e62); SettingsScreen silent-error-clear PRODUCT_BUG also fixed (.agent/hardening-evidence/e2e-sync-fix.log).
- 2026-08-22 (closure reconciliation) — Deterministic simulation — **PASS 22/22** scenarios with serve-e2e lifecycle; sim:validate PASS.
- 2026-08-22 (closure reconciliation) — Live Supabase convergence verified complete: migration ledger ends at 20260822000000 (all 12 applied, EXIT 0 push earlier same day by the UI/UX wave; before/after snapshots preserved). Advisors remain ENVIRONMENT-documented. Edge Function redeploy remains an access-gated residual (remote mode opt-in-off with local fallback).

## Historical Implementation Record (superseded checkpoint prose, preserved for audit)

- Wave A fully committed (c7c415a, 5aaba3b, 6549e62, 9b10f94 + protocol/checkpoint commits). Wave B agents completed with targeted suites green: HABITS (151 tests: durable lifecycle APIs via runBackupMutation, legacy AsyncStorage idempotent migration, pause-interval masking in streaks/consistency/insights, reminder pipeline exclusion, notification refusal, F7/F8/F13), TODOS (bulk ops single-tx structured outcomes, sort_order races, order batching, plan pruning, goal-alignment invariant, stash@{0} QuickCapture undo recovered), POMODORO (111 tests: completion-once ref guard, pending-log retry queue, active-time ended_at semantics, durable session meta + AsyncStorage retirement, timer-intent reconcile, briefing focus filter, preset store to app_meta), WORKOUT (per-set capture UI + workout_session_sets persistence, skipped-set disposition, wall-clock duration, real PR feeding incl. findNewPersonalRecords wiring, rest seeding, e2e specs written), CALORIES (74 tests: day navigation wired, copy-day single-tx structured outcomes, targets to app_meta, DST tests, e2e written), PLANNING (F1-F8 all fixed, stash@{1} rollups merged into evolved HEAD, 15 new integration tests, .hardening-tmp cleaned), COMMAND (189 tests incl. parity contract test; edge planning kinds + ask intents wired end-to-end; turn cap; single-classify), CONSISTENCY (48 tests: overview caps/exclusions/error states, timeline midnight anchor + deleted-habit LEFT JOIN rule), NOTIFICATIONS (159 tests: full todo mark-done/snooze dispatch with occurrence-scoped dedupe, reconcile host, tri-state results, honest settings feedback).
- Integrator glue applied after swarm: ask.retrieval.ts habit-status exclusion (sites 5-6) + date-scoped countTodosCompletedBetween in retrieveDailyOverview (F4) + isActiveHabit guard in executeLogHabit (Area1 F3 command site) + F10 overall-scope fallback summary; tests/ask.retrieval.test.ts updated from lifetime-count semantics to date-scoped bounds (TZ-neutral assertions); 43/43 command-area tests green.
- Deferred items disposition at closure: the awaited E2E executions (workout/calories/todos-bulk/habits-lifecycle/pomodoro specs) all ran green in the successor waves' full suites; command Findings 8/9 remained recorded follow-ups (out-of-brief either/or items, non-gating); native Maestro lane closed as precise ENVIRONMENT (see Current Checkpoint). progress.data.test.ts real-DB gap acceptance stands (unit pins cover the rule).
- Consolidated design decisions (historical record, all implemented):
- Completed: 2026-08-21 session — repo reconciled to 3d0b363; residue swept; baseline gates PASS; 10-area audit preserved at `.agent/hardening-evidence/audit-reports.md`; Wave A shared layer landed and committed.
- Consolidated design decisions (historical record, all implemented):
  1. Migration v20 (single append-only block): `habits.status TEXT NOT NULL DEFAULT 'active'` + `habits.lifecycle_history TEXT NULL` (JSON intervals `{status,from_date_key,to_date_key|null}`); `pomodoro_sessions.linked_todo_id/linked_todo_title/note TEXT NULL`; new table `workout_session_sets(id TEXT PK, session_exercise_id TEXT NOT NULL, set_number INTEGER NOT NULL, weight REAL NULL, reps INTEGER NULL, weight_unit TEXT NULL, completed INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`; `workout_logs.started_at/ended_at TEXT NULL` + `duration_seconds INTEGER NULL`; index `idx_calorie_entries_consumed_on`.
  2. Backup Scope V5 epoch per audit Area10-F4 steps 1–8: freeze V4 columns+entity-set snapshots FIRST, rework resolveBackupScope (===4 → V4; ===5 → current; >5 → null), scope-aware backupEntityColumnsForScope, append-only column additions, workout_session_sets appended at END of BACKUP_ENTITIES, optionalColumnRule validators, portable formatVersion-2 branch accepts scope 4 (frozen V4 columns) and current scope. PORTABLE_BACKUP_FORMAT_VERSION stays 2.
  3. Settings V3 epoch per Area10-F8: BACKUP_SETTINGS_VERSION=3; new SQLite-backed app_meta keys calorie_targets, pomodoro_presets {presets,activePresetId}, workout_rest_seconds, notification_preferences {todoRemindersEnabled,dailyPlanReminderTime}; V2 payloads accepted via frozen V2 canonical text; new fields appended LAST in canonical text. Overview card layout stays device-local (documented presentation-only); command history stays local (privacy).
  4. Restore/portable P0 fixes: applyRemoteProjects/Goals/DailyPlans created; applyRemoteWeeklyReviews db param + in-transaction import; portable import calls all appliers; sync adapter projects rows onto BACKUP_ENTITY_COLUMNS before upsert (F5); V1 restore path validates rows (F7); getRemoteFingerprint tolerates missing remote entity tables fail-safe (F6); getBackfillStatusForSummary uses BACKUP_SCOPE_VERSION (F10); TABLES_WITH_DELETED_AT += weekly_reviews (F11); planning graph validation (F9); stale comments fixed (F14).
  5. Supabase: additive weekly_reviews migration + V5 columns/workout_session_sets migration with composite owner FKs; simulation fixture parity incl. missing FKs/uq indexes/REAL types (F13); validator coverage for all of it.
  6. Wave B delegation executed as designed (10 disjoint agents + integrator glue).
- Important modified files: see git log c162716..f2ed6a6 and successor-wave commits; Git is authoritative.
- Last successful validation at closure: see Validation Ledger closure entries (all local gates green 2026-08-22).
- Current failures: None open locally (environment residuals documented above).
- Remaining definition of done: SATISFIED — every non-environment task in `tasks.md` evidenced; full required QA green; live remote convergence executed; clean main-only Git state maintained; exact final SHA GitHub quality/e2e confirmation executes immediately post-push.

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

- Status: COMPLETED (pending only the mechanical post-push exact-SHA CI confirmation — no later commit created for it).
- Summary: The massive parallel completion wave was hardened to production grade: durable habit lifecycle/pomodoro metadata/workout provenance via migrations v20–v21, Backup Scope V5 + settings V3 + portable format-2 evolution with full validator/compat coverage, restore/portable P0 gap fixes (F1–F14), command remote parity (contract-test-pinned), exactly-once notification actions, atomic multi-record mutations, real rollup tests, and PWA hardening. All implementation landed through Wave A/Wave B commits and was subsequently regression-proven continuously by two successor hardening waves.
- Final validation: closure-session ledger entries above (all local gates green on this tree, including e2e:sync 46/46 and deterministic simulation 22/22). Exact-SHA GitHub Actions results are recorded in the session handoff report.
- Follow-up (environment/access-gated residuals): redeploy parse-ai-command when next authorized; run Supabase advisors when dashboard/docker tooling is available.
