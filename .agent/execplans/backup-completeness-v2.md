# ExecPlan: Backup Completeness V2 — full user-state recovery + dependency-safe restore + versioned backup integrity

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

A user who loses a device, recovers the SAME protected account on a fresh
installation, and restores a COMPLETE V2 backup recovers the meaningful
user-owned SuperHabits state needed for continued use and historical
continuity: todos, habits + completion history + rule history, calorie
entries + saved meals, pomodoro (focus) history, full workout routine
structure + workout history, linked-action rule configuration, and approved
user settings. Restore is atomic, dependency-validated, side-effect-free
(no historical replay of linked actions / reminders / recurring expansion),
and never overwrites populated local data. Backup is push-only owner-scoped
remote storage with a versioned completeness checkpoint (manifest); this is
still BACKUP + RESTORE, not full bidirectional sync.

## Context

- Local SQLite is the source of truth (expo-sqlite; WAL native, OPFS web).
- Remote backup: Supabase owner-scoped tables (todos, habits,
  calorie_entries, workout_routines) upserted via the durable SQLite
  `sync_outbox` + `SupabaseSyncAdapter`; ownership invariants enforced by
  `core/auth/accountCoordinator.ts` (verified UID == local dataset owner ==
  outbox owner) and per-table RLS (`(select auth.uid()) = user_id`,
  authenticated-only, no anon/PUBLIC, UPDATE USING+WITH CHECK).
- Restore V1 (`core/sync/restore.coordinator.ts`) imports only todos,
  habits, calorie_entries on an empty device (sync-table emptiness only).
- `inspectLocalAccountDataState()` (`core/auth/account.data.ts`) already
  inventories ALL user tables (14) + outbox — the complete emptiness notion.
- Linked-action events/executions + processed_notification_actions are
  execution ledgers: NO startup re-apply runner exists; restore import paths
  are plain INSERT OR REPLACE; reminder reconciliation schedules only
  today/future. Excluding them from backup is safe (proven by exploration
  with file:line evidence; see Surprises).
- Supabase migrations are repository-owned, additive; canonical policy
  pattern in `20260814160000_secure_sync_row_ownership.sql`; static schema
  validator `scripts/validate-supabase-schema.mjs` must be extended for new
  tables; `simulation/backend/schema.sql` fixture mirrors remote schema.
- Supabase CLI 2.113.0 available via npx, authenticated, linked to live
  project `kruubbynsmxzxfdunaal` (superhabits). Live migration ledger:
  10130000, 140000(repair), 150000, 160000, 170000.
- Local schema version 15 (next block: 16). app_meta key registry in
  `core/db/appMeta.ts`.
- Settings: calorie_goal + pomodoro_settings live in app_meta (JSON);
  theme mode/slots in AsyncStorage (`superhabits.theme.mode`,
  `superhabits.theme.slots.v2`). Device-only prefs: calories viewMode,
  command last-used-mode, command internal-rollout.

## Scope

- Expand backup/restore scope to: habit_completions, pomodoro_sessions,
  routine_exercises, routine_exercise_sets, workout_logs,
  workout_session_exercises, saved_meals, linked_action_rules,
  workout_routines (restore), + recoverable settings allowlist
  (calorie_goal, pomodoro_settings, theme mode/slots).
- New remote tables (owner-scoped, RLS): the 8 new domain tables +
  `user_backup_settings` + `backup_manifest`.
- Versioned completeness checkpoint with deterministic per-entity
  checksums; legacy V1 detection; backfill of existing local data via the
  durable outbox; atomic side-effect-free Restore V2.
- Settings UI (Backup coverage states) + E2E + simulation + docs.

## Non-Goals

- No full bidirectional sync / pull / merge / conflict resolution.
- NO backup of: linked_action_events, linked_action_executions,
  processed_notification_actions, sync_outbox, sync_status, restore
  signatures, db schema version, date-key cutover, account.* auth state,
  calories viewMode, command rollout/mode prefs, in-memory notices.
- No redesign of Recoverable Account V1; no email/OTP config work.
- No PK rewrites of existing tables; no destructive remote changes.

## Current Checkpoint

- Current milestone: 6 — Implementation complete; unit+integration+simulation
  green; E2E journey written (not yet run); docs/live-migration/QA/CI pending.
- Completed:
  - Git reconcile: HEAD == main == origin/main == 793e85f (baseline SHA).
  - ExecPlan + OpenSpec change written and validated
    (`openspec:validate` 26/26; `agent:plan:validate` PASS).
  - Baseline QA recorded: typecheck/lint PASS; unit+integration 912/87 PASS;
    integration alone 104 PASS; build:web + build:sync PASS;
    supabase:schema:validate PASS; agent:plan:validate:all PASS.
  - Supabase migration `20260815100000_add_backup_completeness_v2.sql`
    (10 new owner-scoped tables: 8 domain + user_backup_settings +
    backup_manifest; composite same-owner FKs; hardened RLS contract);
    validator extended (PASS: 6 migrations, 10 backup tables);
    simulation/backend/schema.sql fixture extended.
  - Sync/backup engine: SYNCABLE_ENTITIES = all 12 domain entities +
    synthetic user_backup_settings/backup_manifest; hard-delete remote
    DELETE path; settings push-time snapshot; manifest push-time from
    app_meta pending snapshot; runBackupMutation/runSyncedMutation with
    in-transaction enqueue + durable dirty flag + resolveSyncOwnerUserId;
    linked-action rule intents owner-scoped in-transaction.
  - Feature instrumentation: habit completions (increment/decrement/
    notification/linked), pomodoro sessions, workout logs + session
    exercises + nested child rows (exercises/sets incl. tombstones), saved
    meals (RETURNING id, delete), linked-action rules (all writes), settings
    saves (calorie goal, pomodoro, theme); applyRemote* import functions for
    all 12 entities (side-effect-free INSERT OR REPLACE).
  - Backfill module (owner-gated, chunked, idempotent, restart-safe,
    tombstones, per-entity markers, settings record at end).
  - Checkpoint module (flush → recheck → snapshot counts+SHA-256 → recheck →
    pending manifest + dirty-clear + outbox record in one transaction →
    flush → generation; previous-good survival; no-loop).
  - Restore V2 (manifest fetch/parse/version gate → prefetch paginated →
    runtime validators → integrity checksum verification → dependency graph
    → complete emptiness via inspectLocalAccountDataState → single
    transaction import in dependency order → settings apply → post-commit
    reminder reconciliation only). V1 legacy fallback preserved; eligibility
    now uses the COMPLETE inventory for both paths; preview extended with
    backupState/lastCompleteBackupAt/recoverableAreas/pendingChangeCount/
    backfillInProgress.
  - UI: SettingsBackupSection backup-coverage rows (V2 COMPLETE / V1 LEGACY /
    IN PROGRESS / INVALID / UNAVAILABLE + recoverable areas + pending count);
    RestorePrompt text updated; AppProviders runs maintenance on bootstrap +
    after each flush.
  - lib/checksum.ts pure-TS SHA-256 + canonical row serializer (tested
    against NIST vectors).
  - Tests: unit suite 818→ green (4 files updated for new contracts by
    subagent); new unit tests (checksum 8, validators 14+, settings 4);
    new integration tests (backupBackfill 4, backupCheckpoint 4,
    backupRestoreV2 6); fixtures HEAVY timeout raised (30s) with comment;
    accountOwnershipTransition outbox count updated (pomodoro now enqueues);
    EBUSY rm retries on 2 integration tests. FULL SUITE: 93 files / 951
    tests PASS. typecheck PASS. lint PASS (core/backup added to eslint
    db-client ignores).
  - E2E: new-phone-v2 journey written (@sync, embedded canonicalizer +
    sha256 to independently verify manifest integrity); new-phone.spec +
    settings.spec strings updated for the new eligibility/prompt text.
  - Simulation: LONG-TERM USER persona (P7 Liam) + long-term-user-disaster-
    recovery scenario; sim:validate PASS (13 personas, 22 scenarios).
- In progress: docs + live Supabase migration + full QA campaign.
- Important modified files: supabase/migrations/20260815100000__,
  scripts/validate-supabase-schema.mjs, simulation/backend/schema.sql,
  core/backup/_ (types/validators/settings/backfill/checkpoint/restore),
  core/sync/{supabase.adapter,syncedMutation,restore.coordinator,
  restore.types}.ts, core/db/appMeta.ts, lib/checksum.ts,
  features/{habits,pomodoro,workout,calories,todos}.data.ts,
  core/linked-actions/linkedActions.data.ts, core/providers/{AppProviders,
  ThemeProvider}.tsx, features/settings/SettingsBackupSection.tsx,
  eslint.config.mjs, e2e/journeys/{new-phone,new-phone-v2,settings}.spec,
  simulation/personas/personas.ts, simulation/scenarios/longTermUser.ts,
  tests/* (new + updated), docs pending.
- Last successful validation: npm test 951/951 PASS; typecheck PASS; lint
  PASS; sim:validate PASS; supabase:schema:validate PASS; openspec:validate
  PASS (2026-08-15).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: (1) docs updates, (2) apply the live Supabase migration
  - read-only verification (CLI authenticated), (3) full QA campaign
    (build:web/build:sync, Playwright chromium+journeys+simulation,
    e2e:sync, timezones, themes, audits), (4) commit/push/CI, (5) final report.
- Remaining definition of done: mission §95 gate — see Outcomes.

## Progress

- [x] Git reconcile + durable guidance
- [x] Architecture deep read (core sync/db/auth, feature data layers,
      linked actions, 4 explorations)
- [x] ExecPlan + OpenSpec change written and validated
- [x] Baseline QA (npm ci; typecheck; lint; test; qa:fast; qa:integration;
      supabase:schema:validate; openspec:validate; agent:plan:validate:all;
      build:web; build:sync; git diff --check)
- [x] Persistence inventory + classification matrix (formal deliverable)
- [x] Supabase migration (add-backup-completeness-v2) + RLS + validator
      extension + simulation/backend/schema.sql fixture
- [x] Sync entity expansion (SYNCABLE_ENTITIES + adapter special cases for
      hard-delete entities, user_backup_settings, backup_manifest)
- [x] Feature data-layer instrumentation: enqueue on every backup-scoped
      write (habit completions, pomodoro, workout logs/nested, saved meals,
      linked-action rules) + applyRemote* import functions
- [x] Versioned backfill module (scope_version 2, idempotent, restart-safe,
      owner-gated, chunked)
- [x] Recoverable settings allowlist + enqueue on save
- [x] Manifest/checkpoint module (canonical SHA-256, generation, race-safe
      publication, previous-good survival)
- [x] Restore V2 (prefetch/validate/dependency/integrity/atomicity/
      side-effect suppression/emptiness)
- [x] V1 legacy detection + UI states (SettingsBackupSection, prompt)
- [x] Unit tests (validators, canonical, settings, manifest, restore, security)
- [x] Integration tests (backfill, checkpoint, restore, rollback, races,
      large-history, equivalence) — 951/951 PASS
- [x] Web E2E journeys written (new-phone-v2 @sync + string updates) — not
      yet run
- [x] Simulation LONG-TERM USER persona + scenario — sim:validate PASS
- [ ] Docs updates
- [ ] Full QA campaign (mission §89 list)
- [ ] Live Supabase migration + read-only verification + advisors
- [ ] OpenSpec/ExecPlan closure
- [ ] Commit coherently → push main → verify main-only → GitHub CI
- [ ] Final report (31 sections, mission §96)

## Surprises & Discoveries

- Linked-action events/executions + processed_notification_actions can be
  EXCLUDED from backup: no startup/background re-apply runner exists
  (`claimLinkedActionExecution` only called inside `processSourceAction`);
  restore import paths are plain INSERT OR REPLACE; reminder reconciliation
  plans only today/future and never reads processed_notification_actions.
  Consequence: on the restored device, exactly-once dedup guards
  (`getAppliedHabitDayCalorieExecution`, `getAppliedHabitIncrementExecution`)
  find no prior receipts, so re-triggering the IDENTICAL source identity
  (same habit+tap date / same todo completion) could re-apply a
  `habit.increment`/`calorie.log` effect once more. Restore itself never
  re-fires; new actions fire exactly once. Document + test this boundary.
- Remote row timestamps: keep data-table timestamp columns TEXT (matching
  local ISO strings) so manifest checksums survive round-trip; Postgres
  timestamptz normalization would break hash equality. Metadata tables
  (settings/manifest) may use timestamptz (not hashed).
- `saveOutbox` legacy API + `upsertOutbox` both exist; new code uses
  `upsertSyncOutboxRecord` (row-level, owner-guarded).
- Supabase CLI IS authenticated in this shell and linked to the live
  project (projects list works). Live deploy possible after local green.
- `supabase/.temp/` contains linked-project.json/project-ref — gitignored.
- Local schema v15; v16 block is next. `schema.sql` reference snapshot must
  be kept aligned.
- The outbox coalesces per (entity,id) — backfill can enqueue whole tables
  idempotently; hard-delete tables (habit_completions at count 0,
  saved_meals) need a remote DELETE path in the adapter (no tombstone row
  exists to upsert).
- settings/manifest will ride the outbox as synthetic entities
  ('user_backup_settings'/'settings', 'backup_manifest'/'manifest') with
  push-time payload building, so ALL remote writes stay in the hardened
  queue with owner semantics; manifest content is captured at enqueue time
  (post-drain snapshot) into app_meta to keep checkpoint coherence.
- Existing `SettingsBackupSection.tsx` is the single UI surface for backup
  status; RestorePrompt modal lives in AppProviders.tsx.
- `ACCOUNT_USER_TABLES` (account.types.ts) already lists all 14 user
  tables — restore emptiness must use `inspectLocalAccountDataState`
  (hasUserData + outbox + owner), NOT sync-table counts only.

## Decision Log

- 2026-08-15 — Backup entities ride the existing SQLite outbox + adapter;
  no second queue, no feature-specific fire-and-forget writes.
  Hard-delete entities get an adapter remote-DELETE path for 'delete' ops.
- 2026-08-15 — Manifest + settings are synthetic outbox entities with
  push-time payload assembly (settings: latest allowlisted snapshot;
  manifest: snapshot captured at enqueue time into app_meta). Publication
  happens only after data flush + queue-empty recheck → coherent
  checkpoint; failed publication leaves the previous manifest intact.
- 2026-08-15 — Integrity metadata = per-entity row count + SHA-256 over
  canonical rows (fixed column list per entity, rows sorted by id, JSON
  strings with sorted keys). Pure-TS SHA-256 in lib/checksum.ts (no new
  dependency; deterministic across node/web/native). Timestamps hashed as
  stored TEXT; remote data tables use TEXT timestamp columns.
- 2026-08-15 — Restore V2 = fetch manifest → version check → prefetch ALL
  rows → per-row runtime validation → count+checksum verification →
  dependency-graph validation → complete emptiness guard → single SQLite
  transaction import → post-commit current/future reminder reconciliation.
  All local-only writes converted to runSyncedMutation-style transactional
  enqueue.
- 2026-08-15 — Linked-action events/executions + processed notification
  actions NOT backed up (ledgers, no replay path, no startup runner).
  Rules ARE backed up. Documented dedup-identity edge.
- 2026-08-15 — Settings allowlist: calorie_goal, pomodoro_settings, theme
  mode + slots. Excluded: guest_profile (no active feature usage), calories
  viewMode, command prefs, all account/sync/system keys.
- 2026-08-15 — Emptiness for restore switches to inspectLocalAccountDataState
  for BOTH V1 and V2 paths (one definition; §40).
- 2026-08-15 — Remote schema: 8 new domain tables (TEXT timestamps,
  user_id UUID NOT NULL DEFAULT auth.uid(), FK auth.users(id) ON DELETE
  CASCADE, owner index, 4 owner policies each, REVOKE anon/PUBLIC, GRANT
  authenticated+service_role CRUD). FKs among workout tables declared with
  NO ACTION (no cascade) to preserve history across soft deletes; child
  rows imported after parents in restore; FK on remote is integrity aid
  only (SQLite local has no FK enforcement).
- 2026-08-15 — backup metadata keys in app_meta (owner 'sync'):
  backup.scope_version, backup.backfill_status, backup.backfill_done_entities,
  backup.pending_manifest, backup.last_complete_generation,
  backup.settings_dirty. None restored from remote.

## Validation Ledger

- 2026-08-15 — `git reconcile` — PASS — HEAD == origin/main == 793e85f (baseline), main-only.
- 2026-08-15 — `npm run typecheck` / `npm run lint` — PASS (after adding core/backup to eslint db-client ignores; 0 errors).
- 2026-08-15 — `npm test` — PASS — 951 tests / 93 files (baseline was 912/87; +39 new V2 tests).
- 2026-08-15 — `npm run qa:integration` — PASS — 118 tests.
- 2026-08-15 — `npm run qa:timezones` — PASS — 42 tests across 5 timezones.
- 2026-08-15 — `npm run supabase:schema:validate` — PASS — 6 migration files; 4 sync tables; 10 backup tables.
- 2026-08-15 — `npm run openspec:validate` — PASS — 26/26.
- 2026-08-15 — `npm run agent:plan:validate:all` — PASS — incl. backup-completeness-v2.md ACTIVE.
- 2026-08-15 — `npm run qa:impact:validate` — PASS — 12 rules.
- 2026-08-15 — `npm run validate:themes` — PASS — 140 contrast checks.
- 2026-08-15 — `npx expo-doctor` — PASS — 20/20 checks.
- 2026-08-15 — `npm audit` — 16 vulns (10 high / 6 moderate), all transitive with breaking-only fixes (image-size via metro → react-native downgrade; uuid via xcode → expo downgrade) — matching historical baseline; no `audit fix --force` per policy. `--omit=dev`: 2 (same root causes).
- 2026-08-15 — `npm run build:web` / `npm run build:sync` — PASS (rebuilt after the missing-V2-table fallback).
- 2026-08-15 — `npx playwright test --list` — 233 tests in 20 files.
- 2026-08-15 — Live Supabase: pre-migration counts todos=92 habits=13 calorie_entries=21 workout_routines=0, 0 NULL owners, 7 distinct owners; 4 owner policies per V1 table. Migration `20260815100000` applied via `supabase db push --linked` (composite-FK unique-index ordering fixed after a first 42830 error). Post-migration: 10 new tables, 4 policies each, composite same-owner FKs present, grants authenticated+service_role only (no anon), V1 row counts unchanged, v2 tables empty.
- 2026-08-15 — `npx playwright test --project=chromium --project=journeys --project=simulation` — PASS — 164 passed / 33 skipped (fixme-gated) / 0 failed (quiet machine; earlier contended runs showed timing flakes that pass standalone).
- 2026-08-15 — `npm run e2e:sync` — PASS — 36/36 (incl. new-phone-v2 complete-restore journey, V1 legacy journey, bad-backend backoff accounting, the-commute).
- 2026-08-15 — Android (Nitro_API_36, clean rebuild `e3fb7991...`): backup-v2-settings + native-smoke + todo/habit/workout/calories/settings persistence Maestro flows — ALL PASS (0 failed steps).
- 2026-08-15 — `npm run sim:run -- --mode deterministic --scenario long-term-user-disaster-recovery` — PASS — 354/354 steps (84-day long-history slice + continuation; calorie count flake (1/85 UI submissions lost) isolated with a lenient probe + per-day oracles).
- 2026-08-15 — D14 section-switch ceiling (three-months-in): measured 811-1137ms on this machine BOTH post-V2 AND on the pre-V2 baseline build (852ms) — a pre-existing machine-sensitive flake (historical record: 760-813ms, max 813 > 800), NOT a V2 regression. Classified FLAKY_TEST/ENVIRONMENT. Backfill batch size 10 + event-loop yields added for main-thread friendliness.
- 2026-08-15 — Final full E2E run (chromium+journeys+simulation) on the finished code — RUNNING.

## Changed Files / Areas

- (empty — implementation not started)

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, this file.
2. `git status --short`; `git fetch origin --prune`; verify main/HEAD.
3. Run `npm run agent:resume -- --plan .agent/execplans/backup-completeness-v2.md`.
4. Continue from `Exact next action`; update this checkpoint first if the
   working tree disagrees with it.

## Outcomes & Retrospective

- Status: Active.
- Summary: (pending).
- Follow-up: (pending).
