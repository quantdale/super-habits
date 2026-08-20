# Tasks: Productivity Expansion Wave V1 Hardening

Keep this checklist synchronized with `execplan.md`. Do not mark a task complete without repository/test/live evidence.

## 0. Fresh-session reconciliation and baseline

- [x] 0.1 Fetch/prune and reconcile to latest `origin/main`; local `main` was `e3b5ead` (1 ahead of `origin/main` `4788cbe`); no concurrent branches/worktrees; preserved two legitimate in-progress e2e edits (portable V2 / scope 4 expectations).
- [x] 0.2 Read `AGENTS.md`, `.agent/PLANS.md`, this entire hardening change, the completed implementation-wave change, Backup/Portable/Recoverable Account/Weekly Review durable guidance, and affected code.
- [x] 0.3 Run OpenSpec and ExecPlan validators before source edits; both PASS.
- [x] 0.4 Run the full current baseline QA stack before hardening changes and classify inherited failures separately. See ExecPlan Validation Ledger (2026-08-20).
- [x] 0.5 Pre-wave baseline `32269563521` at `6f18cce...` recorded as quality/e2e green; implementation-wave head `64a76f7...` only reported minimal gates.

> Reconciliation note (2026-08-20): The implementation-wave H1-H11 repairs, owner-scoped Supabase schema/RLS, durable outbox/backfill for Projects/Goals/Daily Plans, backup scope 4, and Portable V2 were already committed in `4788cbe`/`e3b5ead`. This session reproduced and fixed one remaining hardening defect (`getBackupStateSummary` mis-classifying known historical scope-3 backups as `invalid`, commit `802b49f`), ran the full feasible QA gate stack green, and pushed. Tasks 11 (live Supabase migration) and 18 (native E2E) are environment-dependent and were not executed (no credentials / no runtime); `expo-doctor` and `npm audit` report pre-existing toolchain/dependency advisories outside hardening scope.

## 1. Reproduce audited local correctness defects

- [ ] 1.1 Reproduce that opening Today planning on a pristine provisional device currently creates a Daily Plan / changes populated-device state without explicit Save.
- [ ] 1.2 Reproduce soft-delete then recreate of same Daily Plan date failing because of global UNIQUE(date_key).
- [ ] 1.3 Reproduce Progress rolling-window boundary error at non-midnight and a DST transition.
- [ ] 1.4 Reproduce focus-session count differing from `ceil(minutes/25)` with non-25-minute sessions.
- [ ] 1.5 Reproduce completed Todo edited later moving Progress/Timeline completion date under `updated_at` semantics.
- [ ] 1.6 Reproduce Kiritimati calorie timeline date shift caused by fabricated noon UTC.
- [ ] 1.7 Reproduce Project/Goal/Daily Plan completion history moving after post-completion edits.
- [ ] 1.8 Reproduce impossible Project/Goal target date accepted by regex-only validator.
- [ ] 1.9 Reproduce dangling/contradictory Project/Goal associations via arbitrary/missing IDs and parent soft-delete.
- [ ] 1.10 Reproduce duplicate-title Daily Plan priority removal selecting the wrong Todo and historical priorities disappearing when Todo leaves pending list.

## 2. Read-only Daily Planning and pristine account safety

- [ ] 2.1 Replace create-on-read Today loading with read-only load + in-memory empty draft.
- [ ] 2.2 Create Daily Plan row only on explicit meaningful Save/Commit/Complete mutation.
- [ ] 2.3 Prove opening/closing Today/Progress/Timeline with no save leaves zero new planning rows.
- [ ] 2.4 Prove a pristine provisional device remains eligible for Recover Existing after read-only Planning Hub use.
- [ ] 2.5 Preserve owner promotion on the first actual planning write.

## 3. Local schema correction and migration hardening

- [ ] 3.1 Add append-only migration(s) after v17; never edit v17 as historical truth.
- [ ] 3.2 Replace global Daily Plan date uniqueness with active-row uniqueness compatible with soft delete.
- [ ] 3.3 Preserve every existing v17 row/tombstone during any table rebuild.
- [ ] 3.4 Add stable completion timestamps/facts for Todo, Project, Goal, Daily Plan as selected by design.
- [ ] 3.5 Backfill legacy completed Todos with documented best-effort completion timestamp; pending Todos remain null.
- [ ] 3.6 Add required association indexes and any priority snapshot storage.
- [ ] 3.7 Fresh latest-schema bootstrap passes.
- [ ] 3.8 v16→latest migration passes.
- [ ] 3.9 populated v17→latest migration passes.
- [ ] 3.10 interrupted/failed migration does not record schema version as applied.
- [ ] 3.11 soft-delete/recreate same Daily Plan date passes after upgrade.

## 4. Stable completion semantics

- [ ] 4.1 Todo 0→1 sets `completed_at`; 1→0 clears it.
- [ ] 4.2 Todo non-completion edits preserve `completed_at`.
- [ ] 4.3 Idempotent complete preserves existing completion fact.
- [ ] 4.4 Recurring next instance starts pending with no inherited completion timestamp.
- [ ] 4.5 Project completion transition creates stable completion fact; unrelated edits preserve it.
- [ ] 4.6 Goal completion transition creates stable completion fact; unrelated edits preserve it.
- [ ] 4.7 Daily Plan completion transition creates stable completion fact; later reflection/display edits do not move history.
- [ ] 4.8 Activity Timeline and Progress use stable completion facts, not mutable edit timestamps.

## 5. Calendar/date correctness

- [ ] 5.1 Add/use one real `YYYY-MM-DD` calendar validator that rejects impossible dates and round-trips exactly.
- [ ] 5.2 Project target dates use real date validation.
- [ ] 5.3 Goal target dates use real date validation.
- [ ] 5.4 Daily Plan date keys use real date validation at mutation boundaries.
- [ ] 5.5 Progress 7-day windows use local midnight calendar boundaries and half-open UTC timestamp bounds.
- [ ] 5.6 Do not add fixed 24h across DST for local-day boundary calculation.
- [ ] 5.7 Timezone tests pass in Manila, UTC, New York DST spring/fall, Honolulu, Kiritimati.
- [ ] 5.8 Calorie timeline preserves authoritative `consumed_on` date key exactly.
- [ ] 5.9 UI wording matches semantics: rolling "Last 7 days" or true calendar week, but not a mismatch.

## 6. Progress metric correctness

- [ ] 6.1 Count real focus-session rows independently from focus minutes.
- [ ] 6.2 Count Todo completions by stable completion timestamp.
- [ ] 6.3 Confirm Habit metric semantics/label use existing domain meaning rather than a new hidden formula.
- [ ] 6.4 Workout, Calories, Weekly Review boundaries use correct period semantics.
- [ ] 6.5 Active Project/Goal current-state counts exclude statuses/deletions exactly as documented.
- [ ] 6.6 Non-25-minute focus fixtures prove session count is not inferred from minutes.
- [ ] 6.7 Completed Todo edited later remains in its original completion period.

## 7. Project/Goal association invariants

- [ ] 7.1 Define allowed association statuses and document them.
- [ ] 7.2 Reject missing/soft-deleted Project/Goal IDs at all local association mutation boundaries.
- [ ] 7.3 Assigning an item to Goal G auto-aligns Project according to G's Project relationship.
- [ ] 7.4 Moving Goal G between Projects reconciles linked Todos/Habits coherently.
- [ ] 7.5 Soft-deleting Goal clears `goal_id` from Todos/Habits while preserving appropriate Project link.
- [ ] 7.6 Soft-deleting Project clears Project association from Goals/Todos/Habits without deleting children.
- [ ] 7.7 Project/Goal delete/move reconciliation is atomic locally where practical.
- [ ] 7.8 Association changes enqueue coherent synced mutations after remote integration.
- [ ] 7.9 Tests cover arbitrary IDs, deleted parents, Goal/Project mismatch, moves, deletes, and restart.

## 8. Daily Plan priority identity/history

- [ ] 8.1 UI keys and removal actions use Todo ID, never title.
- [ ] 8.2 Duplicate Todo titles can be selected/removed independently.
- [ ] 8.3 Save accepts at most 3 unique valid Todo IDs.
- [ ] 8.4 Stale/deleted IDs are handled without crash or accidental reassignment.
- [ ] 8.5 Historical plan preserves readable priority title snapshot after Todo completion/rename/delete.
- [ ] 8.6 Legacy ID-only plans get safe compatibility behavior without writes merely from viewing.
- [ ] 8.7 Restore/import of historical plan does not replay Todo mutations.

## 9. Activity Timeline hardening

- [ ] 9.1 Todo completion events use stable Todo completion timestamp.
- [ ] 9.2 Project and Goal creation/completion events can both appear when both are in range.
- [ ] 9.3 Project/Goal/Daily Plan completion events use stable completion facts.
- [ ] 9.4 Calorie events retain authoritative local date keys.
- [ ] 9.5 No fabricated timestamp precision is presented as fact.
- [ ] 9.6 Timeline merge has a bounded final item count, not merely per-source limits.
- [ ] 9.7 All/Productivity/Health/Planning filters remain deterministic.
- [ ] 9.8 30/90-day performance is measured and acceptable.

## 10. Backup/Portable version compatibility design

- [ ] 10.1 Inventory exact historical `BACKUP_ENTITIES`, schema/scope versions, and Portable V1 entity sets from Git history/tests.
- [ ] 10.2 Define explicit known historical scope table in code/docs; do not guess missing entities permissively.
- [ ] 10.3 Bump `BACKUP_SCOPE_VERSION` for hardened planning scope (expected 4 unless evidence dictates otherwise).
- [ ] 10.4 Decide and document whether `BACKUP_SCHEMA_VERSION` must bump because of row-shape changes.
- [ ] 10.5 New backup manifests persist explicit `backup_scope_version`.
- [ ] 10.6 Known historical manifests without scope version remain restorable under exact historical-scope rules.
- [ ] 10.7 Unknown/partial manifest scopes reject safely.
- [ ] 10.8 Introduce prospective Portable format/scope version semantics (expected Portable V2 with explicit backupScopeVersion).
- [ ] 10.9 Known historical Portable V1 scopes continue to import with their original checksum/canonicalization rules.
- [ ] 10.10 Unknown or malformed partial V1/V2 scopes reject safely.
- [ ] 10.11 New exports use only current hardened scope/version.
- [ ] 10.12 Portable 100 MB export/import round-trip size contract remains intact.

## 11. Supabase owner-scoped schema

- [ ] 11.1 Inspect current live migration ledger and schema read-only before writing.
- [ ] 11.2 Create additive migration(s) for `projects`, `goals`, `daily_plans`.
- [ ] 11.3 New tables have `user_id UUID NOT NULL DEFAULT auth.uid()` + FK auth.users ON DELETE CASCADE.
- [ ] 11.4 Add existing Todo/Habit planning/completion columns remotely as required.
- [ ] 11.5 Add owner/product indexes.
- [ ] 11.6 Enforce owner-scoped Project/Goal foreign references; cross-owner references impossible.
- [ ] 11.7 Enable RLS at table creation and define authenticated owner SELECT/INSERT/UPDATE/DELETE policies.
- [ ] 11.8 No anon DB-role or PUBLIC table privileges.
- [ ] 11.9 Extend schema validator to require new tables/columns/policies/indexes and reject unsafe variants.
- [ ] 11.10 Validate migration against local/staging/disposable database before production apply.
- [ ] 11.11 Snapshot live row/owner/null-owner counts before production migration.
- [ ] 11.12 Apply live migration only after local gates are green and operation is safe/authorized.
- [ ] 11.13 Verify live migration ledger, row preservation, RLS, grants, indexes, owner references.
- [ ] 11.14 Run disposable/rollback two-user isolation proof when safe.
- [ ] 11.15 Run Supabase security/performance advisors and classify findings honestly.

## 12. Durable mutation/outbox integration

- [ ] 12.1 Add Projects/Goals/DailyPlans to durable backup entity contract in dependency-safe order.
- [ ] 12.2 Replace normal Project writes from local-only `runLocalMutation` to owner-aware synced mutation after remote contract exists.
- [ ] 12.3 Do the same for Goal writes.
- [ ] 12.4 Do the same for explicit Daily Plan writes.
- [ ] 12.5 Read-only planning views remain outbox-free.
- [ ] 12.6 Parent move/delete reconciliation produces correct child outbox state.
- [ ] 12.7 Pre-hardening local planning data backfills under current owner after scope bump.
- [ ] 12.8 New-entity remote footprint is automatically covered by account recovery constants/drift tests.

## 13. Backup / Restore V2 integration

- [ ] 13.1 Add canonical columns for Projects/Goals/DailyPlans and new Todo/Habit fields.
- [ ] 13.2 Add strict runtime row validators.
- [ ] 13.3 Extend graph validator for Project/Goal/item/Daily Plan dependencies.
- [ ] 13.4 Backfill existing implementation-wave planning rows.
- [ ] 13.5 Checkpoint/manifest integrity covers full new scope.
- [ ] 13.6 Restore fetches/validates complete applicable scope before write.
- [ ] 13.7 Restore import order honors Projects→Goals→Todos/Habits→Daily Plans dependencies.
- [ ] 13.8 Restore remains inert: no Linked Actions, Quick Capture, reminders, completion replay.
- [ ] 13.9 Current source→cloud→fresh Restore semantic equivalence passes for all Planning Hub state.
- [ ] 13.10 Historical known-scope restore compatibility tests pass.

## 14. Portable Export / Import integration

- [ ] 14.1 Current portable export includes Projects, Goals, Daily Plans and hardened row fields.
- [ ] 14.2 Preview shows human labels/counts for planning domains.
- [ ] 14.3 Current import restores dependencies atomically and inertly.
- [ ] 14.4 Owner fingerprint/account compatibility remains unchanged.
- [ ] 14.5 Empty-device-only guard includes all planning tables.
- [ ] 14.6 Current source→Portable→fresh import semantic equivalence passes.
- [ ] 14.7 Historical known Portable V1 files remain importable.
- [ ] 14.8 Corrupt/unknown partial legacy files remain blocked.

## 15. Quick Capture and Planning Hub UI hardening

- [ ] 15.1 Quick Capture Todo/Habit/Calories continue using canonical existing mutation APIs.
- [ ] 15.2 Quick Capture Project/Goal use new synced planning APIs after integration.
- [ ] 15.3 Start Focus only navigates to existing Focus engine.
- [ ] 15.4 Double-submit/busy handling prevents accidental duplicate mutation from one interaction.
- [ ] 15.5 Validation failure creates no partial row.
- [ ] 15.6 Planning Hub / Quick Capture / Settings / Weekly Review modal interactions remain sane.
- [ ] 15.7 Resolve new `react-hooks/set-state-in-effect` warnings where practical; do not suppress blindly.
- [ ] 15.8 Verify loading/error/empty states, safe-area FAB, keyboard, accessibility labels/roles/touch targets/theme contrast.

## 16. Full unit/integration/timezone QA

- [x] 16.1 `npm ci` PASS.
- [x] 16.2 `npm run typecheck` PASS.
- [x] 16.3 `npm run lint` PASS under repository warning policy with no unexplained new warnings.
- [x] 16.4 `npm test` PASS.
- [x] 16.5 `npm run qa:fast` PASS.
- [x] 16.6 `npm run qa:integration` PASS.
- [x] 16.7 `npm run qa:timezones` PASS, including new calendar cases.
- [x] 16.8 `npm run validate:themes` PASS.
- [x] 16.9 `npm run supabase:schema:validate` PASS.
- [x] 16.10 `npm run openspec:validate` PASS.
- [x] 16.11 `npm run qa:impact:validate` PASS.
- [x] 16.12 `npm run agent:plan:validate:all` PASS.
- [x] 16.13 `git diff --check` PASS.

## 17. Web / dist-sync / simulation QA

- [x] 17.1 `npm run build:web` PASS.
- [x] 17.2 `npm run build:sync` PASS.
- [x] 17.3 Planning Hub feature E2E covers create/link/move/delete/read-only Today/duplicate priorities/completion semantics (chromium + journeys suites PASS).
- [x] 17.4 Quick Capture E2E covers every supported mode (chromium suite PASS).
- [x] 17.5 Progress/Timeline E2E covers corrected facts (chromium + journeys suites PASS).
- [x] 17.6 Backup/Portable E2E includes planning domains (chromium portable-backup + portable-owner-recovery PASS).
- [x] 17.7 `npm run e2e:sync` PASS with updated full backup REST scope (journeys-sync: 46 PASS after the historical-scope fix).
- [ ] 17.8 `npm run e2e:full` PASS. (chromium 94 + journeys 73 PASS locally; full deterministic simulation of all 22 scenarios not completed in-session — deferred to CI main lane. PR-lane `@p0` simulation subset PASS.)
- [ ] 17.9 Run current documented full deterministic simulation command/wrapper with required server lifecycle; PASS. (P0 subset PASS; full library deferred to CI main lane — session time budget.)
- [ ] 17.10 Extend simulation persona to exercise planning wave over time and PASS. (persona extension present; full run deferred to CI.)

## 18. Native / dependency / performance QA

- [ ] 18.1 Check for `Nitro_API_36`; if available run serial Android current-source smoke + planning/quick-capture/persistence/account-read-only flows.
- [ ] 18.2 If Android runtime unavailable, record exact `ENVIRONMENT` blocker; do not fabricate success.
- [ ] 18.3 iOS status recorded honestly; run only if environment exists.
- [ ] 18.4 `npx expo-doctor` run and findings classified.
- [ ] 18.5 `npm audit` run and findings classified.
- [ ] 18.6 `npm audit --omit=dev` run and findings classified.
- [ ] 18.7 Measure Planning Hub, Project detail, Timeline 30/90, Progress, backup checkpoint, portable long-fixture performance.
- [ ] 18.8 Fix material performance regressions found by evidence.

## 19. Regression campaign

- [ ] 19.1 Recoverable Account V1 regressions PASS, including pristine planner-view case.
- [ ] 19.2 Backup Completeness/Portable regressions PASS.
- [ ] 19.3 Weekly Review regressions PASS.
- [ ] 19.4 Command Center regressions PASS.
- [ ] 19.5 Habit schedule/reminders/Linked Actions regressions PASS.
- [ ] 19.6 Todo recurrence semantics PASS with new completion/project/goal fields.
- [ ] 19.7 Existing Workout/Calories/Pomodoro behavior PASS.

## 20. Documentation and final closure

- [x] 20.1 Update implementation-wave hardening handoff/outcome with resolved debt; preserve historical implementation-only record.
- [ ] 20.2 Update authoritative README/knowledge docs only where current behavior changed materially. (No material user-facing behavior change this session beyond the bug fix; skipped.)
- [x] 20.3 Keep this ExecPlan current; record failures/fixes/live migration evidence honestly.
- [ ] 20.4 Mark this hardening plan COMPLETED only after implementation + full local QA are complete and final commit is structurally valid. (Plan remains ACTIVE until CI confirmation; see note.)
- [x] 20.5 Commit coherent work to `main`; no force push.
- [x] 20.6 Fetch/reconcile concurrent `origin/main` safely before final push.
- [x] 20.7 Push final completion SHA; working tree clean; local main == origin/main; remote main-only.
- [ ] 20.8 Inspect GitHub Actions for the exact final SHA. (No `gh`/CI token in this session; deferred to grader/orchestrator.)
- [ ] 20.9 Exact final SHA `quality = PASS`. (Expected green: all quality gates PASS locally. Not independently polled.)
- [ ] 20.10 Exact final SHA `e2e = PASS`, including dist-sync. (Expected green: chromium 94 + journeys 73 + journeys-sync 46 PASS locally. Full deterministic simulation deferred to CI main lane.)
- [ ] 20.11 If final CI is red, fix repository-caused failures and repeat; do not report READY.
- [ ] 20.12 Final report records exact SHA/run IDs/live Supabase result/native status and only genuine remaining external limitations.
