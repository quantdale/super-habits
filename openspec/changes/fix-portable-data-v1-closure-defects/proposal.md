# Proposal — Fix Portable Data V1 closure defects

## Why

Portable Data Export & Import V1 shipped, but an independent post-session
review found three closure defects that keep V1 from being a production-ready
user data portability path:

1. **Owner-backed portable import can strand account recovery (HIGH).**
   After importing an owner-backed file on an unclaimed device, the dataset
   is populated but locally unbound, with the source owner fingerprint
   recorded as import-origin metadata. `decideAccountState()` correctly says
   only the matching account may bind, but
   `AccountCoordinator.requestRecovery()` only permits pristine-device
   recovery or permanent-owner sign-back-in — so there is no legal way to
   authenticate and bind the matching source account. The UI tells the user
   to sign in with the account that created the dataset, but the app rejects
   that action.
2. **Native file size check occurs after the full file read
   (MEDIUM/HIGH).** Web import checks `File.size` before `File.text()`, but
   Android/iOS import reads the entire file into a JS string first and only
   then compares the UTF-8 size against the 100 MB bound — defeating the
   resource bound for very large selections.
3. **Successful export is not guaranteed to be importable (MEDIUM).**
   Export serializes any dataset, but import rejects files above the V1 size
   bound; a large dataset can report "Export succeeded" while the produced
   file can never be imported by V1.

## What Changes

- **Imported-owner recovery.** A narrow, explicit state/capability
  (`canRecoverImportedOwner`) for a populated, unbound dataset that was
  produced by a validated Portable Import V1 of an owner-backed file
  (valid source fingerprint recorded, no conflicting owner-bound outbox).
  `requestRecovery()` gains a matching exception that bypasses the
  empty-device rule ONLY for this state; `PendingRecovery` records
  `expectedOwnerFingerprint`; after OTP authentication the VERIFIED UID's
  deterministic fingerprint must EXACTLY match the recorded origin
  fingerprint to bind the dataset permanently. Any other account is signed
  out and fails closed with local data, owner binding, and the source
  fingerprint untouched. The temporary anonymous session's remote backup
  footprint is checked before the switch (conflict if it has rows, retryable
  remote-unavailable if the check cannot run). Settings exposes
  "Imported backup account required — Sign in to source account" (no raw
  UUID/fingerprint). After a successful matching bind, Backup V2 backfill
  re-enqueues the imported state under the matched owner with no false
  cloud-completeness claim.
- **Native pre-read size bound.** Native import inspects picker metadata
  (`DocumentPickerAsset.size`) and, when absent, `expo-file-system` `File`
  stat metadata BEFORE any body read; an unverifiable size is a conservative
  typed rejection. The post-read actual UTF-8 byte verification remains as a
  second defense against under-reporting metadata.
- **One V1 size contract.** A single shared `PORTABLE_V1_MAX_BYTES` (100 MB,
  retained with justification) governs successful export eligibility, web
  import, native import, tests, and UI copy. Export returns a typed
  `too_large` failure (with byteLength/maxBytes) when the serialized file
  would exceed the V1 bound, never presenting a misleading "successful
  backup", never truncating data.

No portable file format change: `PORTABLE_BACKUP_FORMAT_VERSION` stays 1
(owner recovery and size handling are application semantics). No Supabase
schema migration is required.

## Capabilities

### New Capabilities

- **Imported-owner account recovery**: after a validated owner-backed
  portable import on an unclaimed device, the matching source account can
  authenticate through the standard OTP recovery flow and permanently bind
  the imported dataset; any nonmatching account is signed out and cannot
  bind; local data is preserved in every path.
- **Bounded native file reading**: native import rejects oversized or
  size-unverifiable files before loading the file body, with post-read byte
  verification as a second defense.

### Modified Capabilities

- **Portable backup export**: the V1 size contract is shared with import;
  oversized datasets fail safely with a typed `too_large` result instead of
  producing an unusable file.
- **Account ownership decision**: populated imported datasets surface the
  source-account recovery path (`canRecoverImportedOwner`) instead of a
  dead-end message; `requestRecovery`/`verifyRecovery` enforce the
  fingerprint-bound exception; general populated-device account switching
  remains unsupported.

## Impact

- Local only: no Supabase schema change, no new remote tables/columns, no
  new dependencies, no migration (app_meta key/value only).
- `core/portable/` (types/constants, export size gate, native file I/O),
  `core/auth/` (types, domain decision, coordinator recovery flows),
  `features/settings/SettingsBackupSection.tsx` (recovery UI), tests
  (unit + integration + E2E journeys), docs.
- Testing: coordinator-level regression (the previous domain-only coverage
  missed the dead end), real-SQLite end-to-end ownership test, imported-owner
  matrix A–J, temporary-session footprint cases, native size-bound seam
  tests with body-read spy evidence, export/import round-trip boundary tests,
  web E2E journey for matching and wrong accounts.
