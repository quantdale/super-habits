# Tasks — Portable Data Export & Import V1

## 1. Foundation

- [x] 1.1 Create `.agent/execplans/portable-data-export-import-v1.md` (Plan-Version 2, Status ACTIVE) and validate with `npm run agent:plan:validate -- --plan .agent/execplans/portable-data-export-import-v1.md`.
- [x] 1.2 Create OpenSpec change `add-portable-data-export-import-v1` (proposal, design, tasks, spec delta) and validate with `npm run openspec:validate`.
- [x] 1.3 Baseline QA: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run qa:fast`, `npm run qa:integration`, `npm run supabase:schema:validate`, `npm run openspec:validate`, `npm run agent:plan:validate:all`, `npm run build:web`, `git diff --check` — record exact baseline in the Validation Ledger.

## 2. Format primitives

- [x] 2.1 `lib/portableOwnerFingerprint.ts`: `PORTABLE_OWNER_DOMAIN = "superhabits-portable-owner-v1:"` + `portableOwnerFingerprint(userId)` = `sha256Hex(domain + userId)`; unit tests (NIST-vector-safe, distinct users, deterministic).
- [x] 2.2 `core/backup/backupSettings.ts`: export `canonicalSettingsPayloadText(payload)` (canonical JSON text) and redefine `canonicalizeSettingsPayload` as `sha256Hex(text)` — byte-identical checksum; keep existing tests green.
- [x] 2.3 `core/portable/portable.types.ts`: `PORTABLE_BACKUP_FORMAT`, `PORTABLE_BACKUP_FORMAT_VERSION = 1`, `PORTABLE_IMPORT_MAX_BYTES = 100 * 1024 * 1024`, envelope/integrity/preview types.
- [x] 2.4 `core/portable/portableFormat.ts` (pure): canonical payload text builder (envelope fields + entities in `BACKUP_ENTITIES` order + canonical row lines + canonical settings text), `buildPortableBackupFile(...)`, `validatePortableBackupFile(input)` (envelope → versions → entity presence/strictness → rows → settings → entity checksums → settings checksum → payload checksum → graph), returning typed results.
- [x] 2.5 Unit tests `tests/portableFormat.test.ts`: shuffle-order determinism (row order, object key order), tamper detection (row, checksum, payload, fingerprint, exportedAt), version rejections (future format, future schema, legacy schema), missing/unknown entities, malformed rows, hostile strings, duplicate ids, broken graph.

## 3. Export

- [x] 3.1 `core/portable/portableExport.ts`: `exportPortableBackup()` — one serialized read transaction capturing all 12 entities + recoverable settings + theme; post-commit re-verification + one retry; owner fingerprint from the durable binding; no writes; deterministic filename; returns `{fileName, json, byteLength}`.
- [x] 3.2 `core/portable/portableFileIo.ts`: web `savePortableFileOnWeb` (Blob + object URL + anchor + revoke) and native `savePortableFileNative` (`expo-file-system` cache `File` + `expo-sharing`, best-effort temp cleanup); platform-gated.
- [x] 3.3 Integration tests: export read-only proof (outbox, app_meta, use_count, updated_at unchanged); snapshot coherence (concurrent write retry path); theme included.

## 4. Import

- [x] 4.1 `core/portable/portableImport.ts`: file loading (size check + text read), full validation pipeline (order per spec), preview builder (human domain labels, counts, created date, settings/integrity/owner status, disclosures, warnings), `confirmPortableImport(preview)` — in-transaction emptiness + owner re-check, `applyRemote*` in dependency order, `applyRecoverableSettingsToSqlite`, `stagePendingThemeApplication`, import-origin metadata, provisional-binding drop, backfill-marker reset + `backup.dirty`; post-commit `applyPendingThemeApplication`, `requestHabitReminderReconciliation`, `ensureBackupBackfill` when a durable owner exists.
- [x] 4.2 `core/db/appMeta.ts`: add `portable.last_import_at` / `portable.last_import_format_version` / `portable.last_import_owner_fingerprint` keys + `deleteAppMetaKey` helper.
- [x] 4.3 `core/auth/account.data.ts`: `clearLocalDatasetOwner(db)` (delete binding keys + prime cache); use in import.
- [x] 4.4 `core/auth/account.domain.ts` + `accountCoordinator.ts`: pass `importOriginOwnerFingerprint` into `decideAccountState`; fail closed when a populated dataset's origin fingerprint does not match the verified account (no `bindCurrentUserId`); message mentions imported dataset; coordinator reads the key and passes it.
- [x] 4.5 Import file I/O: web hidden file input; native `expo-document-picker` (`application/json`, copy to cache, size check, explicit selection only).
- [x] 4.6 Integration tests: corruption matrix (invalid JSON, wrong format, missing/future versions, missing entity, duplicate ids, invalid todo/habit rule_history, duplicate completions, broken workout parents/sets, bad pomodoro type, malformed meal/rule, bad settings, wrong entity/settings/payload checksums, truncated, oversized) — each rejected, DB unchanged; no-write-before-confirm; double-confirm idempotency; atomicity on injected mid-transaction failure.

## 5. Owner matrix + equivalence

- [x] 5.1 Integration tests: owner matrix (local-only file → empty local-only device; same-owner file → same-owner empty device; owner A file → owner B device blocked; owner file → no-account device allowed with origin metadata; local-only file → owner-bound device requires adoption disclosure; tampered fingerprint fails payload integrity).
- [x] 5.2 Integration tests: full source→export→import equivalence — todos (incl. recurrence), habits (streaks/7/30/90-day/consistency/scheduled occurrences via domain selectors), calorie entries/daily totals/macros, saved meals (incl. use_count/last_used_at), pomodoro session history/today+weekly minutes, workout hierarchy/logs/session exercises/last workout, linked-action rules restored + ledgers empty + a new source event executes once, settings (calorie goal, pomodoro defaults, theme mode + slots) equal; excluded tables/keys absent from the file.
- [x] 5.3 Integration tests: post-import backfill — owner-bound device: backfill markers reset, `backup.dirty` set, `ensureBackupBackfill` enqueues every imported row + settings; no false `last_complete` claim.
- [x] 5.4 Integration test: large long-term dataset (thousands of history rows) — measure serialization time, file size, checksum time, import validation time, import transaction time; assert correctness and generous time bounds.

## 6. Settings UI

- [x] 6.1 `features/settings/SettingsPortableSection.tsx`: "Portable data" card under Backup / Sync / Restore — disclosure text (personal data, not encrypted), Export button (+busy/success/error), Import button (disabled with reason when the device has data), hidden web file input, preview card (created date, domain counts, settings, integrity, owner compatibility, warnings) with Cancel/Import, busy states, accessibility labels.
- [x] 6.2 `features/settings/SettingsScreen.tsx`: wire the portable section (props: device-emptiness eligibility, handlers).
- [x] 6.3 Unit/component sanity via existing settings tests; ensure no Command Center exposure.

## 7. E2E + QA

- [x] 7.1 Web E2E `e2e/journeys/portable-backup.spec.ts`: seed data → Export → capture download (Playwright download event, no OS dialog) → assert filename + parse + integrity; re-import the downloaded file on an empty device: preview counts → Cancel (nothing written) → Import → success + data visible + settings applied; corrupt file (tampered checksum) rejected; populated device blocked; no-write-before-confirm asserted via DB.
- [x] 7.2 Android: build `e2e-test` APK from current source; run serial Maestro flows (portable export → share surface, import picker → preview → cancel → confirm → persisted state) on Nitro_API_36 if available; otherwise document the exact environment limitation with the file APIs covered by the web E2E + integration seams.
- [x] 7.3 Full QA gates: `npm ci`, typecheck, lint, `npm test`, `qa:fast`, `qa:integration`, `qa:timezones`, `validate:themes`, `supabase:schema:validate`, `openspec:validate`, `qa:impact:validate`, `agent:plan:validate:all`, `build:web`, `build:sync`, `e2e:sync`, `e2e:full`, `qa:simulation --all --mode deterministic`, `expo-doctor`, `npm audit` (+omit=dev), `git diff --check`.
- [x] 7.4 Regressions: Backup V2 (manifest coherence/settings integrity/backfill/Restore V2/saved-meal uniqueness/schema validator), Recoverable Account (owner binding, provisional, session loss, wrong owner, Recover Existing), Command Center V2 — via existing suites + affected tests.

## 8. Documentation + closure

- [x] 8.1 Reconcile README (Restore V1 → V2 + portable, local-only history claims, workout restore, SupabaseSyncAdapter, Command Center draft kinds, RN version), `docs/PROJECT_STRUCTURE_MAP.md`, `docs/working-rules.md`, `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`, `openspec/config.yaml` schema-version drift — factual corrections only.
- [x] 8.2 Document Portable V1 (scope, exclusions, format/versioning, integrity, owner policy, plain-text warning, cloud-vs-portable distinction) in README + knowledge base.
- [x] 8.3 Complete ExecPlan (Validation Ledger, Changed Files, Outcomes) + OpenSpec tasks; `npm run agent:plan:validate:all` + `npm run openspec:validate` green.
- [x] 8.4 Coherent commits → `git fetch origin --prune` → reconcile → push main (no force) → verify local == origin/main, remote main-only, working tree clean → GitHub CI quality + e2e PASS on the final SHA → final report (mission §67 format).
