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

- Current milestone: E2E_TRIAGE_ROUND_2 — run 3 complete (148 passed / 15 failed); delegated batch triage in progress.
- Completed: Run 3 of full 4-lane suite finished: 148 passed, 15 failed over ~27 min of test time. 2 failures were already fixed on disk before run end (pomodoro reset label; portable scope V5). Triage of the remaining 13 delegated to a coder agent (test-only scope; product suspects reported back): workout spec stepper selectors fixed+committed; a-tuesday journey '8 pending tasks' → TodosCard now renders '{n} pending' (copy drift); command-center-v2 duplicate-name dialog count 3≠2 under investigation; P4 Sam delete-wrong-item; past-midnight freshness ×3 + writes ×1; P3 Priya settings ripple; P2 Tom HEAVY bounds; simulation selfTest reproducibility + schema (possible real nondeterminism — flagged for product investigation). dist-sync rebuilt with v5 worker for the e2e:sync lane.
- In progress: delegated triage agent (agent-34) fixing/verifying the 13.
- Exact next action: on triage completion — review report + PRODUCT_SUSPECTS, fix any product bugs myself, rerun affected specs, then full-suite confirmation run; then sim:run deterministic, e2e:sync lane, native attempt on emulator-5554, final ExecPlan/tasks reconciliation, push, CI watch.
- Completed: Wave A + Wave B committed (through f2ed6a6). First full local E2E pass surfaced 5 failures; all triaged as TEST_BUG/selector issues, none product bugs: (1) calories-day-navigation spec (new, never executed) had substring selector collisions ('Previous day' vs 'Copy a previous day') → exact:true; wrong repeat-copy expectation (status reports per-invocation count) → corrected, duplication still asserted via toHaveCount(2); spec now 4/4. (2) boundary habit-progress used fragile xpath preceding-sibling broken by redesigned HabitCircle rows → replaced with stable accessible-name selector. (3) boundary 30-todos: list virtualization mounts only a window; added hover+wheel scroll to mount tail before asserting (Task 1 head assert kept). (4) calories goal modal input now has stepper buttons sharing the label → getByRole('textbox'). (5) command.eval.mock:360 failed at 0ms in suite context only — passed in isolation; watch in rerun. All fixes verified green individually.
- In progress: full `npm run e2e` (chromium+journeys+simulation+pwa lanes) rerun in background.
- Exact next action: on E2E completion — if green, run `sim:run -- --mode deterministic`, then dist-sync build + `e2e:sync` lane, then native Android attempt (build/install/Maestro smoke on emulator-5554), then final ExecPlan/tasks reconciliation, push to main, and monitor GitHub Actions quality+e2e for the exact pushed SHA.
- Completed: Wave A fully committed (c7c415a, 5aaba3b, 6549e62, 9b10f94 + protocol/checkpoint commits). Wave B agents completed with targeted suites green: HABITS (151 tests: durable lifecycle APIs via runBackupMutation, legacy AsyncStorage idempotent migration, pause-interval masking in streaks/consistency/insights, reminder pipeline exclusion, notification refusal, F7/F8/F13), TODOS (bulk ops single-tx structured outcomes, sort_order races, order batching, plan pruning, goal-alignment invariant, stash@{0} QuickCapture undo recovered), POMODORO (111 tests: completion-once ref guard, pending-log retry queue, active-time ended_at semantics, durable session meta + AsyncStorage retirement, timer-intent reconcile, briefing focus filter, preset store to app_meta), WORKOUT (per-set capture UI + workout_session_sets persistence, skipped-set disposition, wall-clock duration, real PR feeding incl. findNewPersonalRecords wiring, rest seeding, e2e specs written), CALORIES (74 tests: day navigation wired, copy-day single-tx structured outcomes, targets to app_meta, DST tests, e2e written), PLANNING (F1-F8 all fixed, stash@{1} rollups merged into evolved HEAD, 15 new integration tests, .hardening-tmp cleaned), COMMAND (189 tests incl. parity contract test; edge planning kinds + ask intents wired end-to-end; turn cap; single-classify), CONSISTENCY (48 tests: overview caps/exclusions/error states, timeline midnight anchor + deleted-habit LEFT JOIN rule), NOTIFICATIONS (159 tests: full todo mark-done/snooze dispatch with occurrence-scoped dedupe, reconcile host, tri-state results, honest settings feedback).
- Integrator glue applied after swarm: ask.retrieval.ts habit-status exclusion (sites 5-6) + date-scoped countTodosCompletedBetween in retrieveDailyOverview (F4) + isActiveHabit guard in executeLogHabit (Area1 F3 command site) + F10 overall-scope fallback summary; tests/ask.retrieval.test.ts updated from lifetime-count semantics to date-scoped bounds (TZ-neutral assertions); 43/43 command-area tests green.
- Known deferred items: E2E execution for workout/calories/todos-bulk/habits-lifecycle/pomodoro specs awaits central dist rebuild (PWA agent rebuilding); progress.data.test.ts real-DB gap accepted (unit pins cover the rule); command Findings 8/9 (ask rollout gating, retry budgets) were out-of-brief P2 either/or items — recorded as follow-ups; native Maestro lane after app build.
- In progress: PWA agent (agent-33) completing sw.js/serve-e2e/dist/e2e-pwa work; one transient typecheck error in its in-flight e2e/pwa-update.spec.ts.
- Exact next action: when PWA agent lands — review its diff, fix residual type errors, then run FULL gates sequentially: typecheck, lint, full vitest, openspec+plan validators, supabase schema validator, npm run build:web, full Playwright E2E (+ journeys + pwa/project specs), sim:validate + deterministic sim, timezone matrix; commit Wave B in coherent chunks; then native build attempt on emulator-5554; then push + CI watch.
- Completed: 2026-08-21 session — repo reconciled to 3d0b363; residue swept; baseline gates PASS; 10-area audit preserved at `.agent/hardening-evidence/audit-reports.md`; Wave A shared layer landed and committed.
- Consolidated design decisions (historical record, all implemented):
  1. Migration v20 (single append-only block): `habits.status TEXT NOT NULL DEFAULT 'active'` + `habits.lifecycle_history TEXT NULL` (JSON intervals `{status,from_date_key,to_date_key|null}`); `pomodoro_sessions.linked_todo_id/linked_todo_title/note TEXT NULL`; new table `workout_session_sets(id TEXT PK, session_exercise_id TEXT NOT NULL, set_number INTEGER NOT NULL, weight REAL NULL, reps INTEGER NULL, weight_unit TEXT NULL, completed INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`; `workout_logs.started_at/ended_at TEXT NULL` + `duration_seconds INTEGER NULL`; index `idx_calorie_entries_consumed_on`.
  2. Backup Scope V5 epoch per audit Area10-F4 steps 1–8: freeze V4 columns+entity-set snapshots FIRST, rework resolveBackupScope (===4 → V4; ===5 → current; >5 → null), scope-aware backupEntityColumnsForScope, append-only column additions, workout_session_sets appended at END of BACKUP_ENTITIES, optionalColumnRule validators, portable formatVersion-2 branch accepts scope 4 (frozen V4 columns) and current scope. PORTABLE_BACKUP_FORMAT_VERSION stays 2.
  3. Settings V3 epoch per Area10-F8: BACKUP_SETTINGS_VERSION=3; new SQLite-backed app_meta keys calorie_targets, pomodoro_presets {presets,activePresetId}, workout_rest_seconds, notification_preferences {todoRemindersEnabled,dailyPlanReminderTime}; V2 payloads accepted via frozen V2 canonical text; new fields appended LAST in canonical text. Overview card layout stays device-local (documented presentation-only); command history stays local (privacy).
  4. Restore/portable P0 fixes: applyRemoteProjects/Goals/DailyPlans created; applyRemoteWeeklyReviews db param + in-transaction import; portable import calls all appliers; sync adapter projects rows onto BACKUP_ENTITY_COLUMNS before upsert (F5); V1 restore path validates rows (F7); getRemoteFingerprint tolerates missing remote entity tables fail-safe (F6); getBackfillStatusForSummary uses BACKUP_SCOPE_VERSION (F10); TABLES_WITH_DELETED_AT += weekly_reviews (F11); planning graph validation (F9); stale comments fixed (F14).
  5. Supabase: additive weekly_reviews migration + V5 columns/workout_session_sets migration with composite owner FKs; simulation fixture parity incl. missing FKs/uq indexes/REAL types (F13); validator coverage for all of it.
  6. Wave B delegation executed as designed (10 disjoint agents + integrator glue).
- Important modified files: see git log c162716..HEAD and the pending Wave B working tree (features/** across all areas, core/notifications/**, lib/notifications\*, app/\_layout.tsx, public/sw.js, scripts/serve-e2e.js, e2e specs, tests/**).
- Last successful validation: per-agent targeted suites green (see Completed above); integrator glue 43/43; full-suite rerun pending after PWA agent lands.
- Current failures: one transient typecheck error in PWA agent's in-flight e2e/pwa-update.spec.ts.
- Relevant quarantines: None accepted as final; will classify during QA.
- Blockers: None.
- Exact next action: when PWA agent lands — review its diff, fix residual type errors, then run FULL gates sequentially: typecheck, lint, full vitest, openspec+plan validators, supabase schema validator, npm run build:web, full Playwright E2E (+ journeys + pwa/project specs), sim:validate + deterministic sim, timezone matrix; commit Wave B in coherent chunks; then native build attempt on emulator-5554; then push + CI watch.
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
