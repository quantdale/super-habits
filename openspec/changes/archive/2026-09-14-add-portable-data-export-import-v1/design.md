# Design — Portable Data Export & Import V1

## Context

Backup Completeness V2 established the authoritative recoverable scope,
validators, checksums, emptiness guard, side-effect-free import functions,
and staged theme recovery. Portable V1 reuses all of them; it adds the file
envelope, the payload integrity model, the export snapshot, the import
pipeline, the owner compatibility model, and the platform file I/O.

## Goals / Non-Goals

Goals: complete-scope export; validated, atomic, previewed, confirmed import;
offline (no Supabase/Auth dependency); no side-effect replay; owner-safe.

Non-goals: sync/merge, import onto populated devices, account transfer,
encryption (plain JSON with explicit disclosure), data deletion, Command
Center commands, remote schema changes.

## Decisions

### 1. File format

One versioned JSON envelope:

```
{
  "format": "superhabits-portable-backup",
  "formatVersion": 1,
  "backupSchemaVersion": 2,
  "exportedAt": "<ISO-8601>",
  "source": { "appVersion": "1.0.0", "platform": "web|android|ios",
              "ownerFingerprint": "<64-hex> | null" },
  "entities": { "todos": [...], ... },   // 12 entities, rows sorted by id
  "settings": { "calorieGoal": ..., "pomodoroSettings": ..., "theme": {...} },
  "integrity": {
    "entities": { "<entity>": { "count": n, "checksum": "<64-hex>" }, ... },
    "settings": { "version": 2, "checksum": "<64-hex>" },
    "payloadChecksum": "<64-hex>"
  }
}
```

- Extension `.json`, MIME `application/json` (web download; native share
  MIME `application/json`).
- Deterministic filename: `superhabits-backup-<exportedAt UTC, colons
replaced by dashes>.json`.
- `formatVersion` and `backupSchemaVersion` are independent: a future app
  rejects unknown portable versions and unknown domain schema versions
  safely; there is no V0 portable format.

### 2. Integrity model

- Per-entity: `checksumRows(rows, BACKUP_ENTITY_COLUMNS[entity])` — rows
  sorted by id, fixed column order, `undefined`→`null` (reuse, no fork).
- Settings: `canonicalizeSettingsPayload(settings)` (reuse) after
  `normalizeRecoverableSettings`.
- Payload checksum: SHA-256 over the documented canonical payload text,
  which covers the envelope identity fields (format, formatVersion,
  backupSchemaVersion, exportedAt, appVersion, platform, ownerFingerprint),
  every entity block (entity name + canonical row lines, entities in
  `BACKUP_ENTITIES` order), and the canonical settings text — EXCLUDING
  `integrity.payloadChecksum` itself (no self-reference). Any tamper with a
  row, the fingerprint, or the exportedAt is detected by the payload
  checksum; tampering with the integrity block is detected by recomputing
  entity/settings checksums.

### 3. Export snapshot

- All entities + SQLite settings + theme are read inside ONE
  `withSQLiteTransaction` (serialized read boundary on native; the web
  fallback runs the reads on the single shared connection).
- After commit, settings/theme are re-read; if the canonical settings text
  changed, retry once. Export performs NO writes (no sync enqueue, no
  `use_count` mutation, no app_meta writes).
- Owner fingerprint is derived from the DURABLE local owner binding
  (`account.owner_user_id`), never from the session.

### 4. Import pipeline

Zero local mutation before validation completes:

1. size check (≤ 100 MB) → 2. read text → 3. JSON.parse → 4. envelope
   validation → 5. format version → 6. backup schema version → 7. every
   entity array present (strict, no unknown entity keys) → 8. per-row
   `validateBackupRow` → 9. settings runtime validation/normalization → 10. entity checksums → 11. settings checksum + version → 12. payload
   checksum → 13. `validateBackupGraph` → 14. owner compatibility → 15. emptiness (`isDeviceEmptyForRestore`) → 16. human preview → 17. explicit user confirmation → 18. re-check emptiness + owner inside
   the transaction → 19. ONE atomic SQLite transaction (`applyRemote*` in
   Restore V2 dependency order + `applyRecoverableSettingsToSqlite` +
   `stagePendingThemeApplication` + import-origin metadata + owner-binding
   handling + backfill-marker reset + `backup.dirty`) → 20. post-commit
   reconciliation (`applyPendingThemeApplication`, habit reminder
   reconciliation, `ensureBackupBackfill` when a durable owner exists).

No file read or network call happens inside the transaction.

### 5. Owner compatibility model

Computed from the durable binding (no network):

| Source file fingerprint | Destination durable state                             | Decision                                                           |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| `F`                     | same owner binding (fingerprint == F)                 | Allow (Case A)                                                     |
| `F`                     | permanent binding with different fingerprint          | BLOCK (Case B)                                                     |
| `F`                     | no binding, or provisional binding on pristine device | Allow, drop provisional binding, record import-origin `F` (Case C) |
| `null`                  | any eligible (empty) device                           | Allow with adoption disclosure when a binding exists (Case D/E)    |

- A provisional anonymous binding on a pristine device is treated as
  unclaimed: import drops it and records the import-origin fingerprint so a
  later unrelated account cannot silently claim the dataset
  (`decideAccountState` fails closed on mismatch).
- The file NEVER sets `account.owner_user_id`; the fingerprint is
  compatibility metadata only.

### 6. Post-import backup state

- Never mark backfill complete. Delete `backup.backfill_done_entities` /
  `backup.scope_version` + stale `backup.pending_manifest` /
  `backup.pending_settings`, set `backup.dirty = 1`, then run
  `ensureBackupBackfill()` when a durable owner exists so the imported state
  is enqueued and the next maintenance cycle publishes a fresh checkpoint.
  Without a durable owner the import remains fully local; when the matching
  owner later signs in, the coordinator binds and the backfill runs.

### 7. Platform file I/O

- Web: Blob + object URL + anchor download (revoked after a delay); hidden
  `<input type="file">` for import; no server, no upload.
- Native: `expo-file-system` `File` in cache directory + `expo-sharing`
  share sheet (export; temp file deleted best-effort after share);
  `expo-document-picker` (import, explicit user selection only).
- 100 MB import bound; memory ~2× file size transiently is acceptable and
  documented.

### 8. UI

- Portable data card inside the existing Backup / Sync / Restore bucket:
  disclosure text ("This file contains your Super Habits data. Store it
  somewhere you trust." + "The exported file is not encrypted."), Export
  button, Import button (disabled with reason when the device has data),
  preview card after selection (created date, human domain counts, settings
  included, integrity, owner compatibility, warnings) with Cancel/Import;
  busy states; accessible labels; errors announced via the shared
  ValidationError component.

### 9. app_meta additions

`portable.last_import_at`, `portable.last_import_format_version`,
`portable.last_import_owner_fingerprint` (owner `sync`, no migration
needed — app_meta is a key/value store). Plus a `deleteAppMetaKey` helper
and `clearLocalDatasetOwner` in `core/auth/account.data.ts`.

## Risks / Trade-offs

- Plain-text JSON: data is human-readable but unencrypted — explicit
  disclosure; no false encryption claims.
- Coherence: theme lives in AsyncStorage, so SQLite + theme are captured
  close together with a one-retry verification loop — documented
  best-effort cross-store strategy, identical in spirit to the backup
  checkpoint's settings capture.
- 100 MB parse on low-end devices may take seconds — bounded, one-shot,
  user-initiated.
- New native modules require a native rebuild (EAS profile `e2e-test`).

## Migration Plan

None — no DDL. New app_meta keys are inert on older app versions.

## Rollback / Recovery

- Import rollback: the single SQLite transaction rolls back on any failure;
  theme marker stays durable and is retried on bootstrap.
- Export failure: nothing was written.
- Feature rollback: revert commits; the portable files remain readable by
  the app (format is additive).
