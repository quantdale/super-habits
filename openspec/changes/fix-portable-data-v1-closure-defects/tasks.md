# Tasks — Fix Portable Data V1 closure defects

## 1. Planning and baseline

- [x] 1.1 ExecPlan `.agent/execplans/portable-data-export-import-v1-closure.md` (Plan-Version 2, Status ACTIVE) written and validated with `npm run agent:plan:validate -- --plan .agent/execplans/portable-data-export-import-v1-closure.md`.
- [x] 1.2 OpenSpec remediation change `fix-portable-data-v1-closure-defects` (proposal, design, tasks, spec delta) written and validated with `npm run openspec:validate`.
- [x] 1.3 Baseline QA: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run qa:fast`, `npm run qa:integration`, `npm run openspec:validate`, `npm run agent:plan:validate:all`, `npm run build:web`, `git diff --check` — record in the ExecPlan Validation Ledger.

## 2. Finding 1 — imported-owner recovery

- [x] 2.1 Write the deterministic failing reproduction FIRST: real-SQLite + real `AccountCoordinator` — fresh device with provisional anonymous T → import owner-backed file FP_A → populated/unbound/FP recorded → `requestRecovery` must fail today ("switching") — proving the dead end before any fix.
- [x] 2.2 `core/auth/account.types.ts`: add `canRecoverImportedOwner` to `AccountDecision`/`AccountState`; add `expectedOwnerFingerprint: string | null` to `PendingRecovery`.
- [x] 2.3 `core/auth/account.domain.ts`: narrow imported-owner eligibility (populated, unbound, valid fingerprint, no owner-bound outbox) → `canRecoverImportedOwner`; anonymous-mismatch and no-session states surface the recovery path with the imported-dataset message; legacy/local-only/populated-owner/generic states never qualify.
- [x] 2.4 `core/auth/accountCoordinator.ts` `requestRecovery`: imported-owner exception (bypass empty-device rule ONLY when eligible); pending record carries `expectedOwnerFingerprint`; temporary-session remote-footprint gate applies (conflict / retryable-unavailable / no session).
- [x] 2.5 `verifyRecovery`: imported-owner branch — pre/post re-checks, verified-UID fingerprint EXACT compare; match → permanent bind (adopt unowned outbox) → clear pending → best-effort `ensureBackupBackfill()` → protected; mismatch → sign out, data/binding/fingerprint untouched → owner_mismatch.
- [x] 2.6 `reconcile()`: surface `canRecoverImportedOwner`; keep `sign_in_pending` while the imported-owner pending record matches; no raw UID/fingerprint in any message.
- [x] 2.7 `features/settings/SettingsBackupSection.tsx`: imported-owner recovery card (title "Imported backup account required", source-account copy, email + "Send sign-in code", OTP continuation); recovery form enabled by `canRecoverExisting || canRecoverOwner || canRecoverImportedOwner`; no raw identifiers.
- [x] 2.8 Import-origin metadata lifecycle: retain `portable.last_import_owner_fingerprint` after successful binding as diagnostics; document that fingerprint-gated branches only run while unbound (inert once bound).
- [x] 2.9 Coordinator unit tests (fake DB): A matching binds; B mismatch signs out + no binding; C T-with-remote-rows conflict; D no-rows allowed; E remote unavailable retryable; F local-only import no exception; G legacy unbound no exception; H owner-B device unaffected; I matching A auto-binds on refresh; J anonymous T signed in → Settings capability surfaced; pending-record restart continuity; drift during pending fails closed.
- [x] 2.10 Real-SQLite end-to-end (`tests/integration/portableOwnerRecovery.test.ts`): provisional T → import FP_A file → populated/unbound/FP stored → B recovery fails closed (signed out, data + FP untouched) → A recovery binds → rows identical → outbox enqueued under A + settings record → `backup.dirty=1` → no `last_complete_generation` claim → `ensureBackupBackfill` completes scope V2.

## 3. Finding 2 — native pre-read size bound

- [x] 3.1 Verify installed API surface (done during source inventory): `DocumentPickerAsset.size?`, `expo-file-system` `File.size` / `info().size`.
- [x] 3.2 `core/portable/portableFileIo.ts`: native pipeline — asset.size → File stat → pre-read reject before any body read; unverifiable size → conservative typed rejection; post-read actual UTF-8 verification kept.
- [x] 3.3 Test seam `tests/portableNativeSize.test.ts` (unit): MAX+1 → error, body-read method NEVER invoked (spy evidence); MAX → read allowed; MAX−1 → read allowed; metadata below max but UTF-8 text over → post-read rejection; asset.size undefined → File stat path; stat unavailable → conservative rejection.
- [x] 3.4 Web regression: `file.size > max` → `file.text()` not called (spy test added; existing behavior preserved).

## 4. Finding 3 — export/import size contract

- [x] 4.1 `core/portable/portable.types.ts`: single `PORTABLE_V1_MAX_BYTES` (100 MB, retained with documented justification); replace `PORTABLE_IMPORT_MAX_BYTES` usages (fileIo, tests) with the shared constant.
- [x] 4.2 `core/portable/portableExport.ts`: post-serialization UTF-8 byte check; typed `{ ok:false, reason:'too_large', byteLength, maxBytes, error }`; no file, no truncation.
- [x] 4.3 `features/settings/SettingsPortableSection.tsx`: oversized-export copy ("Your dataset is larger than Portable Backup V1 can safely package." + optional current/supported size detail); oversized-import copy kept ("This portable backup is larger than this version of Super Habits can safely import.").
- [x] 4.4 Tests `tests/portableExportSize.test.ts` (unit, mocked small limit): export over limit → `too_large` typed failure; under limit → ok; boundary exact; no misleading success.

## 5. Regressions and QA

- [x] 5.1 Portable format/corruption/equivalence suites green (no format version change; integrity, graph, hostile strings, no-write-before-confirm, double-confirm, atomicity, no historical replay).
- [x] 5.2 Recoverable Account V1 suite green (session persistence, provisional, promotion, session loss, owner mismatch, Protect Backup, pristine Recover Existing, owner sign-back-in, outbox ownership).
- [x] 5.3 Backup V2 suite green (manifest coherence, settings integrity, saved-meal uniqueness, backfill, Restore V2, RLS, completeness semantics).
- [x] 5.4 Command Center suites green (no new commands added).
- [x] 5.5 Web E2E: `e2e/journeys/portable-owner-recovery.spec.ts` (journeys-sync lane) — fresh device → owner-backed import → "Imported backup account required" → request A → OTP → Protected + imported data intact; repeat with B → mismatch → local data intact; existing `e2e/portable-backup.spec.ts` stays green.
- [ ] 5.6 Performance: re-measure normal + long-term fixture (export byteLength/time, validation time, import time); export-size check negligible; native pre-read rejection allocates/reads no body (spy evidence).
- [ ] 5.7 Full QA gates: `npm ci`, typecheck, lint, `npm test`, `qa:fast`, `qa:integration`, `qa:timezones`, `validate:themes`, `supabase:schema:validate`, `openspec:validate`, `qa:impact:validate`, `agent:plan:validate:all`, `build:web`, `build:sync`, `e2e:sync`, `e2e:full`, `qa:simulation --all --mode deterministic`, `expo-doctor`, `npm audit` (+omit=dev), `git diff --check`.
- [ ] 5.8 Android: build current-source release/E2E APK, install on Nitro_API_36 if available; verify portable import works, imported-owner recovery UI renders, real picker works for a valid file, oversized picked-file rejection at the test layer, imported data persists across restart; otherwise record the exact `ENVIRONMENT` limitation.

## 6. Documentation and closure

- [ ] 6.1 Update Portable V1 docs (README, `docs/PROJECT_STRUCTURE_MAP.md`, knowledge base, working rules as needed): owner-backed import on unclaimed device, source-account recovery flow, fingerprint = compatibility metadata not authentication, local-only import behavior, V1 maximum portable file size, every successful export fits the importer bound, oversized files fail safely, native import checks metadata before reading.
- [ ] 6.2 Complete ExecPlan (Validation Ledger, Changed Files, Outcomes & Retrospective) + OpenSpec tasks; `npm run agent:plan:validate:all` + `npm run openspec:validate` green.
- [ ] 6.3 Coherent commits → `git fetch origin --prune` → reconcile → push main (no force) → verify local == origin/main, remote main-only, clean tree → GitHub CI quality + e2e PASS on the final SHA → final English-only report (mission §51 format).
