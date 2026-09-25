# Gap 21 — remote data can outrun the backup manifest

**Status:** owner decision required. **Prepared:** 2026-09-25. No restore policy or schema change is made by this record.

## Current contract and failure window

Local SQLite is authoritative. A configured device pushes recoverable rows and allowlisted settings to Supabase, then publishes one owner-scoped `backup_manifest` row containing counts and checksums. The manifest has a generation number but no retained generation history. If a device is permanently lost after remote rows/settings have advanced and before the next complete manifest is published, the remote data no longer matches the singleton manifest. Restore V2 returns `invalid` before local import; it cannot reconstruct the earlier coherent generation. A living device can repair the window on its next successful checkpoint. [Known gap 21](../../../docs/testing/known-gaps.md) records this mechanism and its accepted fail-closed behavior.

The current invalid result protects against importing a mismatched or partial dataset. It also means the last backup may be unrecoverable after permanent device loss in this narrow timing window. Portable file backup remains a separate recovery path when the user has a valid file. No change here accepts remote edits as a second source of truth.

## Decision the owner must make

| Choice                                  | Recovery behavior                                                                                                                                       | Product and implementation consequence                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Keep fail-closed                     | A manifest mismatch remains `invalid`; no local rows are imported.                                                                                      | State the recovery limitation in user-facing backup status and release disclosures. Add a device-death-in-window regression and monitor checkpoint lag. This is the current behavior.                                                                                                                                          |
| B. Retain coherent manifest generations | Restore selects the newest _complete, retained_ generation and rejects rows/settings not certified by it.                                               | Requires versioned remote row/settings snapshots or an equivalent immutable generation design, storage and retention limits, migration/backfill, RLS, cleanup, and proof that an older generation is actually reconstructible. Merely retaining old manifest JSON while overwriting singleton data would not solve the window. |
| C. Define an explicit degraded mode     | Strict restore remains the default; an owner-approved, user-visible recovery mode may import a specified subset with an exact missing/extra-row report. | Requires a new product contract for allowed loss, conflict/tombstone handling, consent, integrity checks, preview, and atomic import. It must never silently treat an invalid manifest as complete.                                                                                                                            |

**Owner response to record:** choose A, B, or C; define an acceptable recovery-point objective and maximum loss; decide whether partial recovery may omit or include workouts, health-adjacent data, settings, and deletions; approve the user-facing status and support language. If B or C is chosen, open a separate OpenSpec change before implementation. This closure keeps A's existing fail-closed runtime behavior until that decision is recorded.

## Required proof for a later implementation

1. Real SQLite test: remote rows or settings become a strict superset of the published manifest, the source device is treated as permanently unavailable, and strict Restore V2 returns `invalid` without any local write.
2. If B is chosen: prove a prior generation can be fetched and validated as a full coherent scope, including settings, nested Gym V2 records, tombstones/hard deletes, and owner isolation; test partial upload and generation cleanup.
3. If C is chosen: prove the approved preview names every omitted/extra entity, destructive changes cannot be silently resurrected, import is atomic, and cancel/error leaves the target empty.
4. Re-run J8 and D14 at their existing 800 ms section-switch and 500 ms diary-search ceilings. Preserve one-way backup, account ownership, Restore V2, and portable backup; do not add bidirectional sync.

## Current closure disposition

Decision `PENDING_OWNER`. Restore stays fail-closed. No production schema write, degraded import, override, or threshold change is authorized by this document.
