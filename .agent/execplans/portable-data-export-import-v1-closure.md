# ExecPlan: Portable Data Export & Import V1 — closure of owner-recovery, native size, and round-trip size defects

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Portable Data Export & Import V1 is implemented and validated on main, but an
independent post-session review found three closure defects. This plan closes
them:

1. **Imported-owner recovery dead end (HIGH)** — after importing an
   owner-backed portable file on an unclaimed device (populated dataset,
   owner binding `null`, source fingerprint recorded, temporary anonymous
   session possibly still active), `AccountCoordinator.requestRecovery()`
   rejects every path (`canRecoverExisting` requires a pristine device,
   `canRecoverOwner` requires a permanent binding). The app tells the user
   "Sign in with the account that created this imported dataset" but provides
   no legal transition. The matching source account MUST be able to
   authenticate and bind the imported dataset; any unrelated account MUST
   fail closed without touching local data.
2. **Native size check after full read (MEDIUM/HIGH)** — Android/iOS import
   calls `file.text()` (loading the entire file into JS memory) before the
   100 MB bound is enforced. The picker/file metadata MUST be inspected
   BEFORE any body read, with the post-read UTF-8 verification kept as a
   second defense.
3. **Export/import round-trip size mismatch (MEDIUM)** — export succeeds for
   any dataset, but import rejects files above `PORTABLE_IMPORT_MAX_BYTES`.
   V1 needs ONE shared size contract: every successful V1 export MUST fit the
   V1 import bound; oversized exports MUST fail safely with a typed
   `too_large` result and no misleading "successful backup".

Observable success: on a fresh device, importing an owner-backed file leaves
the dataset locally usable and unbound; Settings exposes "Sign in to source
account"; matching-account OTP recovery binds the dataset permanently, the
wrong account is signed out with data untouched, and Backup V2 backfill then
enqueues the imported state under the matched owner without claiming cloud
completeness. Native import rejects oversized files before body allocation;
export never produces a file larger than V1 can import.

## Context

- Portable V1 shipped at `8e90e5dc1489bbf3eb98b624a7598c4d9662670a` (also
  the reviewed baseline and current `origin/main`). Previous session report:
  1053/1053 tests, 101 Vitest files, CI green — the Git history confirms the
  portable feature commits and the closure docs commit; do not rely on the
  report's counts, verify with the current suites.
- `core/portable/`: `portable.types.ts` (format constants +
  `PORTABLE_IMPORT_MAX_BYTES = 100 MB`), `portableFormat.ts` (pure envelope
  canonicalization + validation, no version change needed), `portableExport.ts`
  (`exportPortableBackup()` returns `{ok:true,fileName,json,byteLength}` or
  `{ok:false,error}` — no size gate today), `portableFileIo.ts`
  (`readPickedPortableFileWeb` checks `File.size` before `text()`; native
  `pickPortableFileNative` reads `File.text()` FIRST then checks bytes —
  the Finding 2 defect), `portableImport.ts` (validate → preview → confirm;
  import-origin metadata; provisional-binding drop; backfill reset + dirty).
- `core/auth/`: `account.domain.ts` `decideAccountState()` already fails
  closed for an imported dataset (import-origin fingerprint blocks an
  unrelated verified account) and reports the imported-origin message, but
  returns `canRecoverExisting=false` / `canRecoverOwner=false` — the dead end.
  `accountCoordinator.ts` `requestRecovery()` only allows pristine-device
  recovery or permanent-owner sign-back-in; `verifyRecovery()` binds by
  `expectedOwnerUserId`; `reconcile()` reads the import-origin fingerprint
  and passes it into every decision. `account.types.ts` has
  `PendingRecovery {email, requestedAt, temporarySessionUserId,
expectedOwnerUserId}` and `AccountState {..., canRecoverExisting,
canRecoverOwner}`.
- `lib/portableOwnerFingerprint.ts`: `portableOwnerFingerprint(uid)` =
  SHA-256(`superhabits-portable-owner-v1:` + uid). Compatibility metadata,
  NEVER authentication.
- `core/db/appMeta.ts` keys: `portable.last_import_owner_fingerprint` stores
  the hex fingerprint or the literal string `null` (local-only source file);
  `portable.last_import_at` / `portable.last_import_format_version`.
- Post-import backup state is already correct: backfill markers reset,
  `backup.dirty = 1`, no completeness claim; `ensureBackupBackfill()` runs
  only when a durable owner exists — so after a successful matching bind the
  coordinator must trigger it for the imported rows to be enqueued under the
  matched owner.
- Settings: `SettingsBackupSection.tsx` `SettingsAccountCard` shows the
  recovery form when `canRecoverExisting || canRecoverOwner`; needs the new
  imported-owner capability + copy. No raw UUID/fingerprint may be shown.
- Native APIs (installed, SDK 55): `expo-document-picker ~55.0.15`
  `DocumentPickerAsset.size?: number` (document size in bytes);
  `expo-file-system ~55.0.24` `File.size` property and `File.info()` →
  `FileInfo.size` (0 when the file does not exist or cannot be read);
  `File.text()` loads the full file. Verified against installed type
  definitions, not memory.
- Testing: unit project (`tests/`), real-SQLite integration project
  (`tests/integration/` via better-sqlite3 `freshDatabase()`), Playwright
  chromium specs (`e2e/`), persona journeys (`e2e/journeys/` with mocked
  Supabase routes; account journeys run for real in the `journeys-sync`
  lane against `dist-sync/` via `npm run e2e:sync`), Maestro native flows
  (`.maestro/flows/portable-backup*.yaml`).

## Scope

- Imported-owner recovery: explicit state/capability, `requestRecovery`
  exception (narrow invariants only), pending-recovery fingerprint evidence,
  OTP verification fingerprint gate, wrong-account fail-closed path,
  temporary-session remote-footprint safety gate, Settings UX, post-bind
  backfill, coordinator + domain + real-SQLite tests, web E2E journey
  (matching + wrong account), docs.
- Finding 2: native pre-read size bound (picker metadata then File stat),
  conservative failure when size cannot be verified, post-read UTF-8
  verification kept, test seams + boundary tests (MAX+1 / MAX / MAX−1 /
  under-reporting metadata / body-read spy evidence).
- Finding 3: ONE shared V1 size constant used by export eligibility, web
  import, native import, tests, UI copy; typed `too_large` export failure;
  UI copy for oversized import/export; boundary tests.
- Documentation: Portable V1 docs (README, structure map, knowledge base,
  working rules as needed) + OpenSpec remediation change + this ExecPlan.

## Non-Goals

- No generic populated-device account switching; no account merging; no
  cross-account ownership transfer.
- No portable payload format change: `PORTABLE_BACKUP_FORMAT_VERSION`
  stays 1 (owner recovery and size handling are application semantics).
- No Supabase schema migration (none required).
- No Command Center commands for portable/account actions (Settings-only).
- No import-automatically-binds behavior: import and account authentication
  remain separate explicit user actions.
- No streaming/archive formats (Portable V2 may add them); no encryption.
- No change to the 100 MB limit value (re-evaluated and retained with
  justification; the in-memory JSON architecture already bounds the import at
  100 MB and realistic long-term datasets are a few MB).

## Current Checkpoint

- Current milestone: F2+F3 implementation complete; E2E journeys (A+B)
  both green on `journeys-sync`; regression suites green; full QA gates
  passing; full E2E running; docs/ExecPlan/OpenSpec update in progress.
- Completed: F1 imported-owner recovery (domain + coordinator + UI + 9
  integration tests + 43 unit tests + 33 domain tests); F2 native pre-read
  size gate + post-read verification (`readNativePortableAsset` seam, 12
  unit tests); F3 unified V1 size contract + oversized export failure
  (`PORTABLE_V1_MAX_BYTES`, `too_large` result, 2 unit tests); Settings
  `refreshAccountState()` after import (fixes stale post-import UI state);
  web SQLite WASM `bindLocalDatasetOwner` transaction-rollback resilience;
  E2E journeys matching-account (A) + wrong-account (B) on `journeys-sync`.
- In progress: full E2E (chromium + journeys) running in background;
  docs + ExecPlan/OpenSpec completion.
- Modified files: `core/portable/portable.types.ts`, `core/portable/portableExport.ts`, `core/portable/portableFileIo.ts`, `core/auth/account.types.ts`, `core/auth/account.domain.ts`, `core/auth/accountCoordinator.ts`, `features/settings/SettingsBackupSection.tsx`, `tests/integration/portableOwnerRecovery.test.ts`, `tests/portableNativeSize.test.ts`, `tests/portableExportSize.test.ts`, `e2e/journeys/portable-owner-recovery.spec.ts`.
- Last successful validation:
  - typecheck: 0 errors; lint: 0 errors, 2 pre-existing warnings.
  - npm test: 104 files, 1101 tests PASS.
  - qa:fast: 74 files, 942 tests PASS.
  - qa:integration: 30 files, 159 tests PASS.
  - openspec:validate: 29/29 PASS.
  - agent:plan:validate:all: all PASS (closure plan ACTIVE).
  - portable corruption: 6/6 PASS.
  - portable export/import integration: 12/12 PASS.
  - portable owner recovery integration: 9/9 PASS.
  - account coordinator: 43/43 PASS.
  - account domain: 33/33 PASS.
  - linked actions: 49/49 PASS.
  - portable large dataset: 1/1 PASS.
  - E2E journeys-sync @portable-owner: 4/4 PASS.
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- Exact next action: check E2E (chromium + journeys) completion, then
  update docs, commit, reconcile, push, verify CI, write final report.
- Remaining definition of done: 33/33 items verified or verified-in-progress
  (see completion gate §50 of mission spec).

## Progress

- [x] 0. Git reconciliation + durable guidance + source inventory
- [x] 1. Closure ExecPlan + OpenSpec remediation change written and validated
- [x] 2. Baseline QA recorded (typecheck 0 err, lint 0 err, test 1053→1101 pass, openspec/plan validators pass)
- [x] 3. Finding 1 reproduced: failing real-SQLite/coordinator test proves requestRecovery dead end
- [x] 4. Imported-owner state: `canRecoverImportedOwner` capability + narrow eligibility
- [x] 5. PendingRecovery extended with `expectedOwnerFingerprint`; requestRecovery imported-owner exception + remote-footprint gate
- [x] 6. verifyRecovery: fingerprint gate → exact-match bind → post-bind backfill; mismatch → sign out + owner_mismatch
- [x] 7. Settings UI: "Imported backup account required" + "Send sign-in code"; post-import `refreshAccountState()` fix
- [x] 8. Finding 2: `readNativePortableAsset` seam + native/web pre-read size gate + post-read verification; 12+3 unit tests
- [x] 9. Finding 3: `PORTABLE_V1_MAX_BYTES` shared contract; `too_large` export result; 2 unit tests
- [x] 10. Test matrix: A–J coordinator + integration tests; real-SQLite e2e ownership + backfill
- [x] 11. Web E2E journeys (journeys-sync): matching (A) + wrong-account (B) — 4/4 pass
- [x] 12. Regressions: portable corruption 6/6, account 76/76, linked actions 49/49, restore 9/9, large dataset 1/1, chromium + journeys E2E in progress
- [ ] 13. Full QA gates + Android validation (Nitro_API_36) + performance re-measurement
- [ ] 14. Documentation + OpenSpec/ExecPlan completion + plan validation
- [ ] 15. Coherent commits → fetch/reconcile → push main (no force) → verify CI → final report

## Surprises & Discoveries

- `decideAccountState` already has the fingerprint fail-closed gate and the
  imported-origin message; the gap is purely the missing recovery CAPABILITY
  and the `requestRecovery`/`verifyRecovery` transition. The reproduction test
  must target the coordinator, not the domain decision, or it will pass
  without proving anything (this is exactly how the gap slipped through).
- `readPortableImportOriginFingerprint()` maps the literal `'null'` text back
  to `null`, so a local-only portable import (fingerprint `'null'`) is
  naturally NOT eligible for the imported-owner exception — requirement F
  falls out of the existing storage encoding.
- `requestRecovery` already runs the temporary-session remote-footprint check
  for the `!ownerRecovery` path; the imported-owner case flows through the
  same branch because it has no permanent binding, so the T-footprint gate
  (mission §14) reuses the existing code path — verify with tests.
- `expo-document-picker` assets expose `size?: number` and
  `expo-file-system` `File` exposes `size` / `info().size` (metadata only,
  no body read). `copyToCacheDirectory: true` copies the picked file into the
  app cache first, so a post-copy File stat is authoritative.
- `FileInfo.size` returns 0 when a file "does not exist, or it cannot be
  read" — indistinguishable from a genuinely empty file. Since a valid
  portable backup is never empty (envelope JSON), a 0/unverifiable metadata
  size is a conservative rejection, never an unlimited read.
- Post-bind backfill: import already resets `backup.scope_version` etc. and
  sets `backup.dirty`; after binding, `ensureBackupBackfill()` re-enqueues
  every imported row + settings under the matched owner (verified by the
  existing `portableExportImport` backfill test pattern).
- The fingerprint metadata can be retained after binding: every
  `decideAccountState` branch that consults `importOriginOwnerFingerprint`
  runs only while `local.ownerBinding === null`, so a retained fingerprint
  is inert once bound. Keep it as diagnostics; document the decision.
- Web SQLite WASM (`expo-sqlite` on OPFS) `withTransactionAsync` throws
  "cannot rollback - no transaction is active" after a successful COMMIT
  — the callback completed, writes are durable, but the WASM layer tries
  an extra ROLLBACK. Fixed by making `bindLocalDatasetOwner` catch this
  specific error and treat it as success. The existing
  `withSQLiteTransaction` wrapper was unaffected because most data-layer
  writes avoid `withTransactionAsync` or use `better-sqlite3` in tests.
- `SettingsPortableSection` must call `refreshAccountState()` after a
  successful portable import. Without this, the account card stays stale
  (shows pre-import anonymous state) because nothing else triggers the
  account coordinator to re-evaluate. The E2E journey caught this: the
  imported-owner form was never surfaced because the UI was stuck on the
  old "anonymous / unprotected" state.

## Decision Log

- 2026-08-16 — Explicit capability `canRecoverImportedOwner` (option A) over
  overloading `canRecoverOwner` — the states are different (unbound imported
  dataset vs permanent-owner sign-back-in); overloading would blur the
  fail-closed invariants and the Settings copy.
- 2026-08-16 — PendingRecovery gains `expectedOwnerFingerprint` alongside
  `expectedOwnerUserId`; exactly one of them is set (owner recovery vs
  imported-owner recovery) and `verifyRecovery` branches on it.
- 2026-08-16 — Imported-owner eligibility is narrow: `hasUserData` true,
  `ownerBinding === null`, import-origin fingerprint present + valid 64-hex
  format, no owner-bound outbox rows, and the dataset was produced by
  validated Portable Import V1 (the durable fingerprint key IS that proof).
  Local-only imports (stored `'null'`), legacy unbound data (no key), owner
  B devices, and conflicting outboxes never qualify.
- 2026-08-16 — Fingerprint is compatibility metadata, not authentication:
  the binding decision is verified-UID → `portableOwnerFingerprint(uid)` →
  exact compare with the recorded import-origin fingerprint. The file can
  never set `account.owner_user_id`.
- 2026-08-16 — Temporary anonymous session T: before switching to A,
  requestRecovery reuses the existing verified-session remote-footprint gate
  (T with remote rows → `account_conflict`; no rows → allowed; remote
  unavailable → retryable `remote_unavailable`). Portable import itself stays
  fully offline-capable — the gate applies only when the user later
  authenticates A.
- 2026-08-16 — `verifyRecovery` mismatch path: sign out the newly
  authenticated session, leave local data untouched, owner stays unbound,
  source fingerprint preserved, return `owner_mismatch`. Never rewrite the
  fingerprint, never attach imported data to B, never clear the dataset,
  never merge.
- 2026-08-16 — Import-origin metadata lifecycle: `portable.last_import_owner_fingerprint`
  is RETAINED after a successful matching bind as diagnostics; it is inert
  while bound and does not affect future state (all fingerprint-gated
  branches require `ownerBinding === null`).
- 2026-08-16 — One shared V1 size constant `PORTABLE_V1_MAX_BYTES = 100 MB`
  replaces `PORTABLE_IMPORT_MAX_BYTES` for every V1 size decision (export
  eligibility, web import, native import, tests, UI copy). 100 MB retained:
  realistic long-term datasets are a few MB (18k rows ≈ 5.15 MB measured),
  the import path already bounds memory at ~2× file size transiently, and the
  web/native pre-read guards prevent unbounded allocation.
- 2026-08-16 — Native pre-read bound: `asset.size` when present, else
  `FileSystem.File.size`/`info().size`; unverifiable size (0/throws) is a
  conservative typed rejection (a valid portable backup is never empty), with
  the post-read UTF-8 byte check as the second defense against
  under-reporting metadata.
- 2026-08-16 — Oversized export: after serialization, UTF-8 byte length >
  V1 max → `{ok:false, reason:'too_large', byteLength, maxBytes, error}`; the
  UI shows "Your dataset is larger than Portable Backup V1 can safely
  package." with optional current/supported size detail; no file is
  presented, no data is truncated, cloud backup is unaffected.

## Validation Ledger

- 2026-08-16 — `git fetch origin --prune` — PASS — local == origin/main == `8e90e5d`; remote main-only; clean tree.
- 2026-08-16 — typecheck — PASS — 0 errors.
- 2026-08-16 — lint — PASS — 0 errors, 2 pre-existing warnings.
- 2026-08-16 — npm test (full) — PASS — 104 files, 1101 tests.
- 2026-08-16 — qa:fast — PASS — 74 files, 942 tests.
- 2026-08-16 — qa:integration — PASS — 30 files, 159 tests.
- 2026-08-16 — openspec:validate — PASS — 29/29.
- 2026-08-16 — agent:plan:validate:all — PASS — closure plan ACTIVE.
- 2026-08-16 — portable corruption suite — PASS — 6/6.
- 2026-08-16 — portable export/import integration — PASS — 12/12.
- 2026-08-16 — portable owner recovery integration — PASS — 9/9.
- 2026-08-16 — account coordinator — PASS — 43/43 (incl. 23 F1 cases).
- 2026-08-16 — account domain — PASS — 33/33 (incl. 11 F1 cases).
- 2026-08-16 — linked actions — PASS — 49/49.
- 2026-08-16 — portable large dataset — PASS — 1/1.
- 2026-08-16 — E2E journeys-sync @portable-owner — PASS — 4/4 (A matching + B wrong-account).
- 2026-08-16 — full E2E (chromium + journeys) — PASS — 167 passed, 41 skipped, 0 failed.
- 2026-08-16 — build:web — PASS — exported to dist/.
- 2026-08-16 — build:sync — PASS — exported to dist-sync/ with dummy Supabase env.

## Changed Files / Areas

- `core/portable/portable.types.ts` — `PORTABLE_V1_MAX_BYTES` shared contract (alias/rename of the import bound), export result types.
- `core/portable/portableExport.ts` — post-serialization size eligibility + typed `too_large` result.
- `core/portable/portableFileIo.ts` — native pre-read size bound + conservative failure; shared constant.
- `core/auth/account.types.ts` — `canRecoverImportedOwner`, `PendingRecovery.expectedOwnerFingerprint`.
- `core/auth/account.domain.ts` — imported-owner eligibility + capability; anonymous-mismatch state surfaces the recovery path.
- `core/auth/accountCoordinator.ts` — requestRecovery imported-owner exception + pending fingerprint; verifyRecovery fingerprint gate + mismatch sign-out + post-bind backfill; reconcile surfaces capability.
- `features/settings/SettingsBackupSection.tsx` — imported-owner recovery UI (title/copy/button), no raw identifiers.
- Tests: `tests/integration/portableOwnerRecovery.test.ts` (real SQLite, coordinator, A/B/T matrix, post-bind backfill), coordinator unit additions, `tests/portableNativeSize.test.ts`, `tests/portableExportSize.test.ts`, existing suites updated for the constant rename.
- E2E: `e2e/journeys/portable-owner-recovery.spec.ts` (matching + wrong account; journeys-sync lane), fixture generation path.
- Docs: README, `docs/PROJECT_STRUCTURE_MAP.md`, knowledge base, working rules (as needed), OpenSpec remediation change, this ExecPlan.

## Recovery / Resume Instructions

1. `git fetch origin --prune`; verify local main == origin/main before resuming.
2. Read `AGENTS.md`, this plan, `.agent/PLANS.md`; run `npm run agent:resume -- --plan .agent/execplans/portable-data-export-import-v1-closure.md`.
3. Reconcile `git status --short` with the Current Checkpoint; Git wins over stale narrative.
4. Run `npm run qa:affected` to pick the cheapest sufficient gates for any in-flight change, then continue from `Exact next action`.
5. Update the checkpoint at every milestone/decision/failure/validation; run `npm run agent:plan:validate -- --plan .agent/execplans/portable-data-export-import-v1-closure.md` before completion.

## Outcomes & Retrospective

- Status: Active.
- Summary: (filled at completion).
- Follow-up: (filled at completion).
