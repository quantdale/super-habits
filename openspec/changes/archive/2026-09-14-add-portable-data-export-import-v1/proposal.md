# Proposal — Portable Data Export & Import V1

## Why

Super Habits is offline-first: SQLite is the source of truth and users may
never configure Supabase. Today the only way to move a dataset between
installations is the owner-scoped cloud Backup V2 + Restore V2 path, which
requires an account, an empty-device target, and remote availability. A user
who wants to keep their own copy of their data — or move it to a fresh
installation without any account — has no supported path.

This change adds a user-controlled, file-based portability path: Export
produces ONE self-contained, versioned, integrity-protected JSON file
containing the complete recoverable user state; Import validates that file
completely, shows a human preview, requires explicit confirmation, and
restores all supported state atomically on an eligible empty device. No
Supabase, no Auth, no network is required for either direction.

This is NOT cloud backup: it does not replace Backup Completeness V2, does
not route through Supabase, does not require an account, and does not import
onto populated data.

## What Changes

- A new `core/portable/` module: portable envelope types + canonical format
  (`portable.types.ts`, `portableFormat.ts`), coherent read-only export
  (`portableExport.ts`), the full validate → preview → confirm → atomic
  import pipeline (`portableImport.ts`), and platform file I/O
  (`portableFileIo.ts`: web Blob download + file input; native
  `expo-file-system` + `expo-sharing` + `expo-document-picker`).
- A pure owner-fingerprint primitive (`lib/portableOwnerFingerprint.ts`):
  one-way SHA-256 of the durable owner binding with a fixed domain
  separator. The file carries a fingerprint, never a raw user UUID, and the
  fingerprint is compatibility metadata only — it can never set
  `account.owner_user_id`.
- A small refactor of `canonicalizeSettingsPayload` to expose the canonical
  settings TEXT so the envelope payload checksum can cover it (byte-identical
  checksum).
- Import-origin metadata in `app_meta` (`portable.last_import_*`) recorded
  inside the import transaction, and a fail-closed owner gate in
  `decideAccountState`: a populated dataset with an import-origin fingerprint
  can only be bound by the matching account.
- Settings UI: a "Portable data" card under the existing
  Backup / Sync / Restore bucket (Export data / Import data + preview card),
  with a plain-text disclosure that exported files are unencrypted and
  contain personal data.
- Post-import cloud interaction: imported state never marks cloud backup
  complete; backfill markers are reset and `backup.dirty` is set so a
  compatible owner's next maintenance cycle uploads the imported state.
- Documentation reconciliation: stale README/structure-map/knowledge-base
  claims about Restore V1, local-only history, and Command Center draft
  kinds are corrected; Cloud V2 vs Portable V1 are documented as distinct.

## Capabilities

### New Capabilities

- **Portable backup export**: one coherent, read-only snapshot of the
  complete recoverable scope (12 entities + recoverable settings incl.
  theme) into a versioned, integrity-protected JSON file; web download and
  native share-sheet paths; no secrets, no auth dependency.
- **Portable backup import**: explicit file selection; 100 MB bound; full
  validation before any write (envelope, versions, rows, settings, entity +
  settings + payload checksums, dependency graph, owner compatibility,
  empty-device eligibility); human preview; explicit confirmation; one
  atomic SQLite transaction with no historical side effects; staged theme
  application; durable import-origin metadata.
- **Owner compatibility protection**: same-owner allow; different-owner
  block; owner-fingerprint file onto an unclaimed device allowed with
  import-origin metadata; local-only file allowed with explicit adoption
  disclosure; provisional anonymous binding dropped on import (device is
  unclaimed); a later unrelated account cannot silently bind an imported
  dataset.

### Modified Capabilities

- **Recoverable settings canonicalization**: the canonical settings text is
  now exported for reuse by the portable envelope checksum (checksum
  byte-identical).
- **Account ownership decision**: `decideAccountState` fails closed when a
  dataset carries an import-origin owner fingerprint that does not match the
  verified account.
- **Backup/restore Settings UI**: the Backup / Sync / Restore bucket gains
  the Portable data card.

## Impact

- Local only: no Supabase schema change, no new remote tables/columns.
- New npm dependencies: `expo-file-system`, `expo-document-picker`,
  `expo-sharing` (SDK 55-compatible; native-only usage).
- Migration: none (app_meta is a key/value store; new keys need no DDL).
- Testing: new unit tests (format/canonicalization/fingerprint/versions),
  integration tests (source→export→import equivalence for every domain,
  corruption matrix, owner matrix, large long-term dataset), and a web E2E
  round-trip (export download → re-import → verify).
