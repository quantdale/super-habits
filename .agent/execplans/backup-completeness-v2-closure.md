# ExecPlan: Backup Completeness V2 — closure remediation (owner-scoped saved-meal uniqueness + transactional checkpoint coherence + full settings-atomic restore)

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Backup Completeness V2 was delivered but an independent post-session review
found three correctness defects. This closure makes V2 production-ready by
fixing, validating, deploying, and documenting:

1. Remote `saved_meals` uniqueness is global (`UNIQUE(food_name)`), so two
   different owners cannot both save "Chicken Breast". Must become
   owner-scoped, matching the local case-insensitive semantic.
2. Manifest publication has a coherence race: a local mutation committing
   between the final queue check and the manifest publication transaction can
   leave a stale manifest published while its rows changed and `backup.dirty`
   was wrongly cleared. The manifest snapshot must be captured and published
   inside ONE atomic local coherence boundary.
3. Recoverable settings are fetched INSIDE the local restore SQLite
   transaction (a Supabase network call), errors are not treated as restore
   failures, and the settings payload is not integrity-bound to the manifest.
   Restore must fetch + validate + integrity-verify settings BEFORE any local
   write, bind settings to the manifest generation, and never touch the
   network inside the import transaction.

End state: DOMAIN STATE + RECOVERABLE SETTINGS form one coherent, verified
Backup V2 recovery point; headless QA green; production schema remediated;
GitHub CI green; local main == origin/main, main-only remote.

## Context

- Repo: quantdale/super-habits. Local checkout
  `C:\Users\Michael Roy\Documents\super-habits`. Supabase project
  `superhabits` ref `kruubbynsmxzxfdunaal` (linked; CLI 2.113.0 authenticated).
- Local SQLite source of truth; durable `sync_outbox` (v14) + app_meta
  `backup.*` keys; `withSQLiteTransaction` (native exclusive txn / web regular
  txn, serialized per-db via a promise tail chain).
- Backup V2 modules: `core/backup/{backup.types,backupCheckpoint,backupRestore,
backupSettings,backupValidators,backupBackfill}.ts`, `core/sync/
{syncedMutation,supabase.adapter,sync.engine,syncPersistence}.ts`,
  `lib/checksum.ts`, `features/calories/calories.data.ts` (saved meals).
- Local saved-meal semantic (authoritative): `CREATE UNIQUE INDEX
idx_saved_meals_food_name ON saved_meals (food_name COLLATE NOCASE)` —
  case-INSENSITIVE uniqueness; `saveSavedMeal` upserts
  `ON CONFLICT(food_name COLLATE NOCASE)`.
- Live production state (verified 2026-08-15): all 6 migrations applied;
  `saved_meals` has `CONSTRAINT saved_meals_food_name_unique UNIQUE (food_name)`
  (the defect); ALL 10 V2 tables have ZERO rows; V1 counts todos=92 (7
  owners), habits=13 (3), calorie_entries=21 (2), workout_routines=0; 0 NULL
  owners; RLS: 4 owner policies per table, no anon/PUBLIC.
- `BACKUP_SCHEMA_VERSION = 2`, `BACKUP_SETTINGS_VERSION = 2`.
- Tests: vitest unit + integration (real SQLite harness
  `tests/integration/helpers/db.ts`), Playwright web E2E (static dist/),
  simulation platform, Maestro native (Nitro_API_36).

## Scope

- Fix the three findings in `core/backup/`, `core/sync/`, saved-meal sync
  semantics, manifest/settings wire contract, restore flow, schema validator,
  simulation fixture, tests, E2E, simulation persona/scenario, docs, OpenSpec.
- Additive remedial Supabase migration (saved_meals owner-scoped uniqueness;
  `backup_manifest.settings_metadata` column) applied to production.
- Full headless QA + live migration + Android regression + push + CI.

## Non-Goals

- No new product features; no redesign of Backup V2 architecture; no full
  two-way sync.
- No Recoverable Account V1 changes (regression only).
- No linked-action ledger backup changes (rules stay backed up; events/
  executions stay excluded).
- No edits to already-applied migrations (`20260815100000_...` stays as-is).
- No destructive remote changes, no row/owner rewrites, no RLS weakening.
- No dependency cleanup beyond `npm audit` recording.

## Current Checkpoint

- Current milestone: 3 — Implementation + unit/integration tests complete
  (985/985); E2E journeys extended + new settings-failures journey written;
  simulation model extended (setCalorieGoal) + scenario settings oracles;
  simulation scenario run in progress; full headless QA + live migration +
  Android + docs + push pending.
- Completed: git reconcile (main == origin/main == 6e005a2); guidance +
  source inspection; closure ExecPlan (validated) + OpenSpec closure change
  (27/27); baseline QA (951/951); live read-only snapshot; Finding 1 repro +
  remedial migration + fixture + validator (bad DDL fails validation);
  Finding 2 transactional coherence boundary (capture in one
  withSQLiteTransaction; in-transaction outbox rechecks; settings capture;
  stale-manifest drop + recapture; generation reuse for dropped intents;
  lastComplete recorded only for actually-pushed manifests; crash
  reconciliation); Finding 3 settings prefetch/verify before transaction
  (owner/version/checksum/row-presence), no-network-in-transaction (guarded
  integration test), generation-bound settings push (settings-G before
  manifest-G; adapter verifies pending checksum and re-upserts settings
  before manifest), durable theme pending-apply + bootstrap retry,
  getBackupStateSummary invalid for manifests without settings integrity.
- In progress: long-term simulation rerun (setCalorieGoal selector fixed);
  then full headless QA; live migration; Android; docs; push.
- Important modified files: core/backup/{backupCheckpoint,backupRestore,
  backupSettings,backup.types}.ts, core/sync/{supabase.adapter,
  syncedMutation}.ts, core/db/appMeta.ts, core/providers/AppProviders.tsx,
  supabase/migrations/20260815200000_backup_v2_closure_remediation.sql,
  scripts/validate-supabase-schema.mjs, simulation/backend/schema.sql,
  simulation/{model/types,model/steps,runner/actions,runner/execute}.ts,
  simulation/scenarios/longTermUser.ts, e2e/journeys/new-phone-v2.spec.ts,
  e2e/journeys/new-phone-v2-settings-failures.spec.ts (new),
  tests/* (backupSettings, backupManifest new, simulation.model),
  tests/integration/{backupCheckpoint,backupRestore,savedMealUniqueness
  (new),backupPerformance (new)}.test.ts,
  docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md,
  openspec/changes/fix-backup-v2-closure-defects/* (new).
- Last successful validation: npm test 985/985 (96 files); typecheck PASS;
  lint PASS; sim:validate PASS (22 scenarios); supabase:schema:validate PASS
  (7 migrations); openspec:validate 27/27; expo-doctor 20/20; npm audit
  matches baseline (16 total; omit=dev: image-size+uuid, breaking-only).
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- Condition required to unblock: none.
- Exact resume action after unblock: none.
- Exact next action: collect the long-term-user-disaster-recovery simulation
  result; then run full headless QA (§52), then live remedial migration +
  verification, Android regression, docs, commit + push + CI.
- Remaining definition of done: mission §62 gate (30 items) + final report.

## Progress

- [x] Git reconcile (fetch, branch/remote/worktree inspection, baseline 6e005a2)
- [x] Read AGENTS.md / PLANS.md / working-rules / PROJECT_STRUCTURE_MAP /
      V2 execplan + OpenSpec (proposal/design/tasks/spec)
- [x] Inspect all V2 source (backup._, sync._, transactions, appMeta,
      checksum, calories.data saved meals, migration, validator, tests)
- [x] Live read-only Supabase snapshot (ledger, V1/V2 counts, saved_meals
      constraints/indexes, RLS policies)
- [x] OpenSpec closure delta (new requirement set, mission §4)
- [x] Baseline QA recorded
- [x] Finding 1: reproduce global-uniqueness conflict; owner-scoped
      uniqueness migration + fixture + validator assertion
- [x] Finding 2: deterministic race test proving stale publication; checkpoint
      rewritten with single atomic local coherence boundary (snapshot +
      settings capture + manifest intent inside one transaction)
- [x] Finding 3: settings prefetch before write; settings row/error/version/
      checksum validation; no network in restore transaction; durable
      cross-store theme reconciliation (pending theme apply marker + retry)
- [x] Settings integrity: canonical settings checksum; manifest
      settingsMetadata {version, checksum}; generation-bound settings push
      (settings remote before manifest remote)
- [x] Unit tests (checksum canonicalization, manifest parsing, version compat)
- [x] Integration tests (race matrix A–H, restore failure matrix, theme
      crash recovery, no-network seam, saved-meal client contract,
      status summary, performance recording)
- [x] Semantic equivalence + long-term simulation (settings integrity)
- [x] Web E2E extensions (settings error/checksum/restore-with-settings)
- [ ] Full headless QA (§52 list)
- [ ] Live remedial migration + verification + advisors (§53–55)
- [ ] Android regression (Nitro_API_36, serial Maestro)
- [ ] Docs + OpenSpec + ExecPlan finalization
- [ ] Coherent commits → reconcile → push main → verify main-only → CI green
- [ ] Final report (mission §63 format)

## Surprises & Discoveries

- Live V2 tables are ALL empty (manifest/settings too) → extending the v2
  manifest contract with `settingsMetadata` is safe (no deployed v2 manifest
  exists anywhere); BACKUP_SCHEMA_VERSION stays 2 (backward-compatible
  additive extension), and v2 manifests without settings integrity metadata
  are treated as incomplete/invalid (cannot certify settings integrity).
- `withSQLiteTransaction` serializes transactions per db via a promise tail
  chain (native also exclusive). Feature data-layer writes always go through
  it, so inside a checkpoint transaction no other transaction can interleave
  on native; the second in-transaction outbox recheck is cheap
  defense-in-depth for the web path and gives a deterministic test barrier.
- A test hook that runs `runBackupMutation` INSIDE the checkpoint transaction
  would deadlock (it chains behind the open transaction); hooks that need a
  real mutation must fire outside the transaction, hooks inside the
  transaction simulate the durable effects with direct SQL on transactionDb.
- `pushSettingsSnapshot` currently builds the payload at push time — the
  manifest cannot certify it. Fix: snapshot settings at enqueue/capture into
  app_meta `backup.pending_settings` and push from that; manifest push
  verifies the pending snapshot still matches its certified checksum and
  re-upserts settings before the manifest (settings-G-before-manifest-G).
- Settings checksum must canonicalize values client-side (sorted keys,
  fixed shape, undefined→null); JSONB key order/whitespace normalization is
  thereby neutralized; JS-number round-trips are stable (local doubles are
  already the JS values).
- `readRecoverableSettings` reads AsyncStorage (theme) — safe inside the
  SQLite transaction (no network), but theme WRITES must leave the
  transaction: stage in app_meta `backup.pending_theme_apply` inside the
  transaction, apply to AsyncStorage after commit, retry on bootstrap until
  cleared.
- Restore currently ignores `settingsResult.error` (the Finding-3 bug shape
  `{data: null, error: {...}}` → silent settings skip).

## Decision Log

- 2026-08-15 — Remote saved-meal uniqueness becomes
  `CREATE UNIQUE INDEX uq_saved_meals_owner_food_name ON saved_meals
(user_id, lower(food_name))`, dropping `saved_meals_food_name_unique`.
  Matches local NOCASE (ASCII-case-insensitive) semantics; `lower()` on
  Postgres is the standard owner-scoped case-insensitive form.
- 2026-08-15 — BACKUP_SCHEMA_VERSION stays 2; `settingsMetadata
{version, checksum}` is a mandatory part of the v2 manifest going forward
  (zero live v2 manifests; restore rejects v2 manifests lacking it as
  incomplete). `backup_manifest.settings_metadata JSONB` added by the
  remedial migration.
- 2026-08-15 — Checkpoint capture moves ENTIRELY inside one
  `withSQLiteTransaction`: recheck outbox → verify dirty → snapshot →
  recheck outbox → capture settings → persist pending manifest + pending
  settings + enqueue settings/manifest records + clear dirty → commit →
  flush → record lastComplete. No network inside the transaction.
- 2026-08-15 — Settings generation binding: `backup.pending_settings` app_meta
  holds the latest allowlisted snapshot (with the generation that captured
  it); adapter pushes settings from it; manifest push re-verifies checksum
  and upserts settings before the manifest (settings-first ordering).
- 2026-08-15 — Restore: settings row fetched + error-checked + version-checked
  - runtime-normalized + canonical-checksum-verified BEFORE the import
    transaction; theme staged into `backup.pending_theme_apply` inside the
    transaction, applied to AsyncStorage after commit, retried on bootstrap
    until success (durable crash recovery; no fire-and-forget).
- 2026-08-15 — Schema validator: remediation migration must drop the global
  saved_meals constraint, add the owner-scoped unique index, add
  settings_metadata; any later migration reintroducing global food_name
  uniqueness fails validation; fixture mirrors the contract.
- 2026-08-15 — Test hooks: `runBackupMaintenance` accepts an internal
  `hooks` option (`beforeCapture` outside the transaction; `afterSnapshot`
  inside, direct-SQL mutation simulation) so the race matrix is deterministic.

## Validation Ledger

- 2026-08-15 — `git fetch origin --prune` — PASS — HEAD == main == origin/main
  == 6e005a24cc6438f7c5f35c6a7419538271b7a307; remote heads: main only.
- 2026-08-15 — Live read-only snapshot — PASS — see Context; saved_meals
  global unique confirmed; all V2 tables 0 rows; RLS intact.
- 2026-08-15 — `npm ci` — PASS — clean install (patch-package + hooks ran).
- 2026-08-15 — `npm run typecheck` / `npm run lint` — PASS — 0 errors.
- 2026-08-15 — `npm test` — PASS — 951/951 (93 files) — matches historical
  baseline.
- 2026-08-15 — `npm run qa:integration` — PASS — 118/118.
- 2026-08-15 — `npm run supabase:schema:validate` — PASS — 6 migrations, 4
  sync + 10 backup tables.
- 2026-08-15 — `npm run openspec:validate` — PASS — 27/27 (incl. new closure
  change fix-backup-v2-closure-defects).
- 2026-08-15 — `npm run agent:plan:validate:all` — PASS — incl. new closure
  execplan ACTIVE.
- 2026-08-15 — `git diff --check` — PASS — clean.
- 2026-08-15 — Core implementation — PASS — checkpoint capture inside ONE
  SQLite transaction (outbox recheck → dirty → snapshot → recheck → settings
  capture → pending manifest/settings → enqueue settings+manifest → clear
  dirty); settings generation-bound push with stale-intent drop + recapture;
  restore fetches/validates/verifies settings BEFORE the transaction; theme
  staged durably (`backup.pending_theme_apply`) and applied post-commit with
  bootstrap retry; no network inside restore transaction; `settings_metadata`
  wire contract; owner check on settings row.
- 2026-08-15 — `npm test` — PASS — 984/984 (95 files; was 951/93) — new:
  canonicalization unit tests, manifest-parsing unit tests, checkpoint race
  matrix (beforeCapture/afterSnapshot/in-transaction), stale-manifest drop +
  no-loop, crash reconciliation, settings failure matrix (fetch error/missing/
  malformed/checksum/version/no-metadata), no-network-in-transaction guard,
  theme pending-apply + restart retry, saved-meal client contract
  (case variation, delete/recreate, cross-owner push), status summary
  invalid/v2_complete.
- 2026-08-15 — `npm test` — PASS — 985/985 (96 files; +backupPerformance).
- 2026-08-15 — `npm run sim:validate` — PASS — 22 scenarios; new
  `setCalorieGoal` step kind + long-term scenario settings oracles.
- 2026-08-15 — `npm run sim:run -- --mode deterministic --scenario
long-term-user-disaster-recovery` — PASS — 356/356 steps incl. the
  Settings→Nutrition calorie-goal save and settings-integrity oracles
  (run_msuynbk1_zliua61k). Earlier runs: first failed on a stale
  getByLabel selector (TEST_BUG, fixed); second failed at step 321 when the
  ad-hoc static server was killed by the 600s background-task cap
  (ENVIRONMENT, fixed by no-timeout server); third failed at step 353 on a
  wrong oracle expectation (pomodoro_settings never saved by the persona —
  TEST_BUG, oracle corrected).
- 2026-08-15 — `npm run qa:impact:validate` / `validate:themes` /
  `qa:timezones` / `agent:plan:validate:all` / `openspec:validate` — PASS —
  12 rules; 140 contrast checks; 5 timezones; plans all PASS; openspec 27/27.
- 2026-08-15 — `npx expo-doctor` — PASS — 20/20.
- 2026-08-15 — `npm audit` — 16 (10 high / 6 moderate) transitive,
  breaking-only fixes — matches historical baseline; `--omit=dev` root
  causes: image-size (via metro) + uuid (via xcode), both expo-downgrade
  fixes — no new dependencies introduced by this closure.
- 2026-08-16 — `npm run e2e:sync` — PASS — 40/40 (4.1m) incl. new
  settings-failures journey (4 steps), new-phone-v2 (extended), bad-backend,
  the-commute, recoverable-account. First run had 2 failures: settings-
  failures step 1 (TEST_BUG — the SQL oracle left the page on the DB harness,
  so the following settings click hung; fixed with returnToApp + prompt
  dismissal) and bad-backend step 5 (FLAKY — passed 6/6 in isolation and in
  the rerun).
- 2026-08-16 — `npm run e2e` (chromium+journeys+simulation) — 159 passed /
  37 skipped (fixme-gated) / 4 did not run (settings-failures fixme'd in the
  standard build) / 1 failed: three-months-in D14 section-switch ceiling
  (1024ms > 800ms) — the documented pre-existing machine-sensitive flake
  (811–1137ms range, reproduced at the pre-V2 baseline); re-run of
  three-months-in PASSED (maxSwitch 781ms). Classified FLAKY_TEST/ENVIRONMENT.
- 2026-08-16 — `npm run qa:simulation -- --all --mode deterministic` — PASS —
  all 22 scenarios (run_msv3281v_oc2zzk86).
- 2026-08-16 — Live remedial migration `20260815200000` applied via
  `supabase db push --linked`; verified: migration ledger 7/7;
  `saved_meals_food_name_unique` removed; `uq_saved_meals_owner_food_name
(user_id, lower(food_name))` present; `backup_manifest.settings_metadata
JSONB` present; RLS 4 policies/table unchanged; anon 0 grants;
  authenticated 7 privileges/table; row counts preserved (92/13/21/0/0/0/0);
  advisors: security = only expected anonymous-auth + leaked-password WARNs
  (no new regressions), performance = no issues. Adversarial proof
  (rollback-only): cross-owner "Chicken Breast" both-insert SUCCEEDED;
  same-owner case-variation duplicate BLOCKED; zero canary rows.
- 2026-08-16 — Android: built release APK from current source
  (`EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST=true ./gradlew assembleRelease`,
  SHA-256 e6d9fc5bf67ca9aa21194d0eefdb47a2730b723d3ecc3f8e24b4fbcc4ce26858),
  installed on Nitro_API_36; serial Maestro flows
  (backup-v2-settings, native-smoke, todo/habit/workout/calories/settings
  persistence) — ALL 7 PASS (EXIT=0). First attempt failed with
  `Application Not Responding: com.android.systemui` on the emulator
  (ENVIRONMENT — machine overloaded by the parallel simulation-library run;
  cold emulator restart resolved it). Native V2 restore round-trip is covered
  by web E2E + integration (native build has no Supabase env); the
  backup-v2-settings flow pins the native V2 surface.
- 2026-08-16 — Final gates on the committed state — PASS — typecheck; lint;
  npm test 985/985; openspec:validate 27/27; supabase:schema:validate (7
  migrations); agent:plan:validate:all.
- 2026-08-16 — Push — PASS — `git push origin main` (6e005a2..3d2f7db,
  no force); local main == origin/main == 3d2f7db3...; remote heads: main
  only. 5 coherent commits.
- 2026-08-16 — GitHub CI run 31925374349 — quality PASS; e2e in progress
  (main lane: full e2e + deterministic simulation + dist-sync + e2e:sync);
  nightly skipped (push trigger).

## Changed Files / Areas

- (populated as the work lands)

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, this file.
2. `git status --short`; `git fetch origin --prune`; verify main/HEAD.
3. Run `npm run agent:resume -- --plan .agent/execplans/backup-completeness-v2-closure.md`.
4. Reconcile this checkpoint with the working tree; continue from
   `Exact next action` (update it first if state differs).

## Outcomes & Retrospective

- Status: Active.
- Summary: (filled at completion).
- Follow-up: (filled at completion).
