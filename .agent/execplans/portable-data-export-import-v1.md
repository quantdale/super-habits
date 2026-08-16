# ExecPlan: Portable Data Export & Import V1 — user-controlled file backup + verified atomic import

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

A Super Habits user can export their complete recoverable dataset (all 12
recoverable entities + recoverable settings, including theme) into ONE
self-contained, versioned, integrity-protected JSON file — with no Supabase
account and no network required — store/copy/share that file themselves, and
later import it onto an eligible EMPTY installation: preview exactly what the
file contains, verify integrity and owner compatibility, confirm explicitly,
and have all supported user state restored atomically with NO historical side
effects replayed (no linked-action replay, no notifications, no recurring-todo
creation).

The portable path is deliberately NOT cloud backup: it does not touch
Supabase, does not require Auth, does not replace Backup Completeness V2, and
never imports onto populated user data.

## Context

- Backup Completeness V2 (completed, `bc428d5`-era) already provides: the
  authoritative recoverable scope (`BACKUP_ENTITIES`, 12 tables),
  runtime row validators (`validateBackupRow`), dependency-graph validation
  (`validateBackupGraph`), deterministic SHA-256 row checksums
  (`checksumRows` in `lib/checksum.ts`), the recoverable-settings allowlist +
  canonical checksum (`backupSettings.ts`), side-effect-free `applyRemote*`
  import paths per feature, the complete emptiness guard
  (`isDeviceEmptyForRestore` over `inspectLocalAccountDataState`), the durable
  staged theme-application mechanism (`stagePendingThemeApplication` /
  `applyPendingThemeApplication`), and the versioned backfill/checkpoint cycle
  (`backupBackfill.ts`, `backupCheckpoint.ts`).
- Recoverable Account V1 provides the durable local dataset-owner binding
  (`app_meta.account.owner_user_id`) and the account coordinator's
  fail-closed ownership decisions (`decideAccountState` in
  `core/auth/account.domain.ts`).
- This feature adds a file-based portability path on top of those primitives:
  a versioned portable envelope, a deterministic payload canonicalization +
  payload checksum, an export snapshot (one SQLite read transaction), a
  validate-everything-before-write import pipeline, an explicit preview +
  confirm UX, an atomic SQLite import transaction reusing the `applyRemote*`
  functions, and durable import-origin metadata so a later unrelated account
  can never silently claim imported data.
- No portable file format existed before this feature (no V0). V1 starts
  clean.
- No `expo-file-system` / `expo-document-picker` / `expo-sharing` packages are
  installed today; SDK 55 bundled versions are `~55.0.24` / `~55.0.15` /
  `~55.0.22` (added via `npx expo install`; native-only paths).

## Scope

- One self-contained portable backup file per export.
- Export: complete recoverable user scope (12 entities + recoverable
  settings allowlist incl. theme), one coherent SQLite snapshot, read-only
  (no mutation, no sync enqueue), owner fingerprint when a durable local
  owner binding exists, no secrets.
- Import: explicit file selection (web file input; native
  DocumentPicker), 100 MB size bound, full validation pipeline (envelope →
  versions → rows → settings → entity checksums → settings checksum →
  payload checksum → dependency graph → owner compatibility → emptiness),
  human preview, explicit confirmation, single atomic SQLite transaction,
  side-effect-free `applyRemote*` reuse, staged theme application, durable
  import-origin metadata.
- Owner compatibility: same-owner allow; different-owner block; local-only
  source file allowed on any eligible device with explicit adoption
  disclosure; owner-fingerprint file allowed on an unclaimed (no permanent
  owner) device with import-origin metadata recorded; provisional anonymous
  binding on a pristine device is dropped (device is unclaimed).
- Post-import cloud interaction: imported data NEVER marks cloud backup
  complete. Backfill markers are reset + `backup.dirty` set so the next
  owner-scoped maintenance cycle re-enqueues and re-publishes the imported
  state; if remote is disabled, the import remains fully usable locally.
- Settings UI: portable controls under the existing "Backup / Sync / Restore"
  bucket (no new top-level category).
- Tests: format unit tests, corruption matrix, owner matrix, full
  source→export→import semantic equivalence, large long-term dataset
  measurement, web E2E round-trip, account-domain regression, Backup V2
  regression, Command Center regression.
- Documentation: reconcile stale README/docs (Restore V1 claims, local-only
  history claims, Command Center draft kinds, schema-version mentions) and
  document Cloud V2 vs Portable V1.

## Non-Goals

- Full two-way sync, live multi-device sync, automatic merge.
- Import onto a populated database (empty-device only, complete inventory).
- Account merging, cross-account ownership transfer (the file never sets
  `account.owner_user_id`).
- Auth/session/JWT/service-role/token export; `sync_outbox` export; raw
  `app_meta` import; SQL dump or raw SQLite-file import; arbitrary SQL
  execution from file content.
- `linked_action_events`, `linked_action_executions`,
  `processed_notification_actions`, backup-checkpoint runtime metadata,
  schema-migration metadata, internal rollout flags, transient UI state.
- Encryption: V1 is plain, explicitly disclosed JSON. No home-grown crypto.
  (Investigation concluded the repo has `expo-crypto` but no proven
  cross-platform authenticated-encryption primitive wired for this; plain
  verified JSON with explicit disclosure is the accepted V1 contract.)
- Data deletion / local reset / account deletion (future data-lifecycle
  phase).
- Command Center / free-form AI commands for backup/import (Settings-only
  consequential actions).
- Supabase schema changes (no remote tables or columns required).

## Current Checkpoint

- Current milestone: 7 — ALL validation complete (unit/integration 1053/1053,
  web E2E 6/6 portable + full suite green with the documented flake re-run
  PASS, e2e:sync PASS, deterministic simulation 22/22, Android native smoke
  PASS via real OS picker/share surfaces, all static gates PASS); docs
  reconciled; plan ready to close after commit + push + CI.
- Completed: everything from milestone 5 + portable-import eligibility fix
  (import no longer gated on cloud-restore eligibility — computes semantic
  device emptiness itself; web E2E re-run 6/6 with an enabled-state
  assertion); Android release APK built twice (SHA-256
  `f44d92c85ea90a4172127e27d458e64772e8b26b6c707d51848fad014b7a397e` final),
  installed on Nitro_API_36, native smoke: card + disclosure, Export →
  system share resolver (bare image has no JSON targets — environment
  limitation) + success message with deterministic filename, Import → real
  DocumentsUI picker → fixture file (produced by production export code)
  previews → "Import complete. 7 records were restored." → persisted across
  relaunch; populated device blocks import with reason; Maestro flows added
  for CI's native lane (local Maestro scroll gestures unreliable on this
  emulator — adb-driven smoke used locally); docs (README, structure map,
  working rules, knowledge base, openspec config) reconciled; ExecPlan +
  OpenSpec tasks complete except commit/push/CI.
- In progress: commit sequence → fetch/reconcile → push main → CI
  verification → final report.
- Important modified files: (see Changed Files / Areas).
- Last successful validation: npm test 1053/1053; e2e:full 168 passed (1
  documented flake re-run PASS); e2e:sync 40/40 effective; simulation 22/22;
  Android native smoke PASS; all static gates PASS.
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- Condition required to unblock: none.
- Exact resume action after unblock: none.
- Exact next action: commit the five coherent commit groups, `git fetch
origin --prune`, reconcile, push main (no force), verify local ==
  origin/main + remote main-only + clean tree, inspect GitHub CI
  (quality + e2e) on the final SHA, fix any repository-caused failure, mark
  OpenSpec 8.3/8.4 + this plan COMPLETED, deliver the final report.
- Remaining definition of done: mission completion gate §66 (36 items) —
  full recoverable scope exports; excluded state proven absent; no secrets in
  export; versioned format; entity/settings/payload hashes verify; export is
  read-only; web export works; native path implemented (Android verified if a
  device is available, else exact limitation documented); import validates
  everything before write; future or unsupported versions fail safely; malformed
  files fail safely; dependency corruption fails safely; wrong checksums fail
  safely; owner incompatibility fails safely; populated device cannot import;
  preview before import; explicit confirmation; no double-confirm; atomic
  SQLite transaction; no historical side-effect replay; theme application
  crash-recoverable; no false cloud-complete claim; compatible imported data
  can later backfill; semantic source→import equivalence; Backup V2 /
  Recoverable Account / Command Center regressions; full headless QA;
  Android status known; GitHub CI green; local main == origin/main; working
  tree clean; remote main-only; English-only prose.

## Progress

- [x] Prior-session hygiene: commit + push closure docs (`7a6189e`), main-only verified
- [x] Durable guidance + source inventory (Backup V2, account, settings, DB, tests)
- [x] Design: envelope, canonicalization, payload checksum, owner model, post-import backfill
- [ ] ExecPlan + OpenSpec change written and validated
- [ ] Baseline QA recorded (typecheck/lint/test/qa:fast/qa:integration/validators/build)
- [ ] `core/portable/portable.types.ts` + `portableFormat.ts` (pure envelope + integrity)
- [ ] `lib/portableOwnerFingerprint.ts` + backupSettings canonical-text refactor
- [ ] `core/portable/portableExport.ts` (coherent read-only snapshot + serialization)
- [ ] `core/portable/portableFileIo.ts` (web download/input; native File/DocumentPicker/Sharing)
- [ ] `core/portable/portableImport.ts` (full validation pipeline + preview + atomic confirm)
- [ ] appMeta keys + `clearLocalDatasetOwner` + account-domain import-origin gating
- [ ] Settings UI (Backup / Sync / Restore bucket: Export + Import + preview card)
- [ ] Unit tests: format canonicalization/shuffle, fingerprint, version rejection
- [ ] Integration tests: source→export→import equivalence (all domains + settings)
- [ ] Integration tests: corruption matrix + owner matrix + no-write-before-confirm
- [ ] Integration tests: large long-term dataset (thousands of rows, measured)
- [ ] Web E2E: export/download round-trip, preview, cancel, import, corrupt file, populated block
- [ ] Android validation (Nitro_API_36 or exact environment limitation)
- [ ] Full QA gates (qa:fast/integration/timezones, themes, supabase, openspec, impact, plans, build:web/sync, e2e:sync, e2e:full, simulation, expo-doctor, audit, diff --check)
- [ ] Documentation reconciliation (README, structure map, working rules, knowledge base, config)
- [ ] Complete ExecPlan/OpenSpec → coherent commits → reconcile → push main → CI green → final report

## Surprises & Discoveries

- `decideAccountState` currently binds ANY verified account to
  populated-but-unbound local data (`shouldBindLegacy`); without a change, an
  imported dataset could be silently claimed by an unrelated account. Fix:
  gate the legacy bind on the durable import-origin owner fingerprint
  (recorded at import time), fail closed on mismatch.
- A pristine device bootstraps a PROVISIONAL anonymous owner binding as soon
  as Supabase is configured. Treating that as "owner B" would block all
  portable imports on default devices; treating it as claimable would attach
  imported data to a throwaway anonymous session. Correct policy: drop the
  provisional binding during import (device is unclaimed) and record the
  import-origin fingerprint; only a matching owner can later bind.
- `ensureBackupBackfill` marks entities done even when it enqueues zero rows
  on an empty device; portable import must reset
  `backup.backfill_done_entities` / `backup.scope_version` and set
  `backup.dirty` so imported rows are actually re-enqueued for the owner's
  cloud backup.
- `canonicalizeSettingsPayload` hashes an internal canonical object; the
  portable payload checksum needs that canonical TEXT. Refactor:
  `canonicalSettingsPayloadText()` exported, checksum = sha256Hex(text) —
  byte-identical result.
- README is almost entirely pre-V2 (Restore V1 described as current; habit
  history/saved meals/workout restore "local-only"; Command Center limited to
  create_todo/create_habit; RN 0.83.4 vs 0.83.10). Knowledge base + structure
  map have localized stale sentences too; `openspec/config.yaml` says schema
  v14/next v15 (actual: v15/next v16).

## Decision Log

- 2026-08-16 — File format: single versioned JSON envelope
  (`superhabits-portable-backup`, formatVersion 1, backupSchemaVersion 2,
  extension `.json`, MIME `application/json`) — inspectable, archive-friendly,
  non-executable. Not a SQL dump, not a raw SQLite file.
- 2026-08-16 — Integrity: per-entity `{count, checksum}` via
  `checksumRows`; settings `{version, checksum}` via
  `canonicalizeSettingsPayload`; envelope `payloadChecksum` = SHA-256 of a
  documented canonical text covering envelope fields + every canonical row
  (entity order = `BACKUP_ENTITIES`, rows sorted by id, columns in
  `BACKUP_ENTITY_COLUMNS` order, undefined→null) + canonical settings text,
  excluding `payloadChecksum` itself (no self-reference).
- 2026-08-16 — Owner fingerprint: SHA-256(`superhabits-portable-owner-v1:` +
  durable owner binding) — one-way compatibility metadata, NEVER treated as
  authentication, never trusted from the file, never sets owner binding.
- 2026-08-16 — Export coherence: capture all entities + SQLite settings +
  theme inside ONE serialized read transaction
  (`withSQLiteTransaction`); after commit, re-read settings/theme and retry
  once if the canonical settings text changed; export performs no writes.
- 2026-08-16 — Import: zero local mutation before validation; preview from
  validated payload; confirm re-checks emptiness + owner inside the
  transaction; one `withSQLiteTransaction` applying `applyRemote*` in
  Restore V2 dependency order + settings + theme staging + import-origin
  metadata.
- 2026-08-16 — Post-import backup state: NEVER mark backfill complete.
  Delete backfill-done/scope markers + stale pending manifest/settings,
  set `backup.dirty`, then `ensureBackupBackfill()` when a durable owner
  exists — the imported state uploads under that owner and only a real
  checkpoint records completeness.
- 2026-08-16 — Encryption: plain JSON for V1 with explicit user-facing
  disclosure; no new crypto primitive (no proven cross-platform
  authenticated-encryption path already wired; would balloon V1).
- 2026-08-16 — Import size bound: 100 MB (documented rationale: >10 years of
  heavy use; generous but bounded memory).
- 2026-08-16 — Native: `expo-file-system` (new File API) temp file +
  `expo-sharing` share sheet for export; `expo-document-picker` for import;
  web uses DOM Blob download + file input (no server).
- 2026-08-16 — UI: portable card under Backup / Sync / Restore; import
  disabled with reason when the device is not empty; preview card with
  Cancel/Import; busy + success/error states; accessibility labels.

## Validation Ledger

- 2026-08-16 — `git fetch origin --prune` — PASS — local == origin/main == `bc428d5` before hygiene commit.
- 2026-08-16 — `git push origin main` (closure docs) — PASS — `bc428d5..7a6189e`, main-only verified.
- 2026-08-16 — baseline — PASS — typecheck + lint clean; unit 848/848; integration 137/137; supabase:schema:validate PASS; openspec:validate 28/28; agent:plan:validate:all PASS; build:web PASS; git diff --check clean.
- 2026-08-16 — `npm test` (full) — PASS — 1053/1053 (101 files) after portable suites landed.
- 2026-08-16 — portable unit suites — PASS — portableFormat 46/46; portableAccountGating 9/9.
- 2026-08-16 — portable integration suites — PASS — export/import equivalence 6/6 (incl. read-only proof, double-confirm block, theme crash recovery, post-import backfill enqueue); corruption + owner matrix 6/6; large dataset 1/1 (18,127 rows, 5.15 MB, export ~1.0s / validate ~0.9s / import ~0.7s).
- 2026-08-16 — `npx playwright test --project=chromium e2e/portable-backup.spec.ts` — PASS — 6/6.
- 2026-08-16 — qa:timezones — PASS — Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati.
- 2026-08-16 — validate:themes — PASS — 140 contrast checks.
- 2026-08-16 — supabase:schema:validate — PASS — 7 migrations; 4 owner-scoped sync tables; 10 owner-scoped backup tables.
- 2026-08-16 — openspec:validate — PASS — 28/28 (incl. change/add-portable-data-export-import-v1).
- 2026-08-16 — agent:plan:validate:all — PASS — all versioned plans valid (incl. portable-data-export-import-v1).
- 2026-08-16 — qa:impact:validate — PASS — 12 rules.
- 2026-08-16 — expo-doctor — PASS — 20/20.
- 2026-08-16 — npm audit — PASS (baseline) — 17 (7 moderate, 10 high); breaking-only omit=dev unchanged.
- 2026-08-16 — `npm run e2e:full` — PASS (with documented flake) — 168 passed / 37 skipped / 1 did-not-run / 1 failed = the pre-existing machine-sensitive `a-tuesday` D14 section-switch step under heavy load; full journey re-run 8/8 PASS (classified FLAKY_TEST/ENVIRONMENT, matching the closure plan record).
- 2026-08-16 — Android release APK (`android/app/build/outputs/apk/release/app-release.apk`, SHA-256 `4be242a6...7ac02d` then rebuilt with the portable-import eligibility fix: `f44d92c8...b397e`) — PASS — installed on Nitro_API_36 emulator; verified: Portable card + disclosure render; Export data opens the system share resolver (bare emulator image has no JSON share targets — environment limitation) and shows the success message with the deterministic filename; Import data opens the REAL system document picker (DocumentsUI), the pushed fixture file (produced by the production export code) previews with counts + `Integrity: Verified`, Import reports "Import complete. 7 records were restored.", imported todos persist across app relaunch; populated device shows the block reason and disables Import. Maestro flow files written for CI's native lane; local Maestro scroll gestures are unreliable on this emulator's RN ScrollView (adb-driven smoke used instead — see the flow comments).
- 2026-08-16 — Portable import eligibility fix — PASS — portable import no longer depends on the cloud-restore eligibility; it computes the semantic device emptiness itself, so the Import action works on local-only devices (web E2E re-run 6/6 with a new enabled-state assertion).
- 2026-08-16 — `npm run e2e:sync` — PASS — 40/40 effective (38 passed + bad-backend step 5 failed under concurrent load; isolated re-run with the correct lane env 6/6 PASS — FLAKY_TEST/ENVIRONMENT, code untouched).
- 2026-08-16 — `npm run qa:simulation -- --all --mode deterministic` — PASS — all 22 scenarios passed.

## Changed Files / Areas

- (populated as the work lands)

## Recovery / Resume Instructions

1. `git fetch origin --prune`; verify local main == origin/main before resuming.
2. Read `AGENTS.md`, this plan, `.agent/PLANS.md`; run `npm run agent:resume -- --plan .agent/execplans/portable-data-export-import-v1.md`.
3. Reconcile `git status --short`; if prior-session closure docs reappear
   uncommitted, they must already be pushed (see hygiene commit `7a6189e`);
   never overwrite unknown modifications without inspection.
4. Continue from `Exact next action` above; keep `Current Checkpoint` current
   at every milestone; run `npm run agent:plan:validate -- --plan <path>`
   before complex-task completion.
5. Validation evidence: `npm run qa:affected` before choosing gates; full
   gates per mission §59 before completion.

## Outcomes & Retrospective

- Status: ACTIVE.
- Summary: (filled at completion).
- Follow-up: (filled at completion).
