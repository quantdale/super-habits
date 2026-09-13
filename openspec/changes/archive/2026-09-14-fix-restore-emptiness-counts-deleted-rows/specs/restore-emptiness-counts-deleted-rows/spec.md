## ADDED Requirements

### Requirement: Emptiness counts every row in synced tables, including soft-deleted

`getLocalSyncBackedCounts()` in `core/sync/restore.coordinator.ts` SHALL count all rows in each synced entity table (`todos`, `habits`, `calorie_entries`, `workout_routines`) regardless of `deleted_at` state. A device that has ever held rows in a synced table SHALL NOT be considered empty, so restore is refused and a local soft-delete is never silently resurrected by a stale backup import.

#### Scenario: Deleted-only device is refused restore

- **WHEN** a device's only synced rows are soft-deleted (all rows have `deleted_at` set) and the restore-eligibility check runs
- **THEN** the device is reported as not empty and the restore prompt does not appear.

#### Scenario: Genuinely empty device remains eligible

- **WHEN** a device has never held any rows in the synced tables
- **THEN** the emptiness check reports empty and the restore flow proceeds exactly as before.

### Requirement: The in-transaction re-check applies the same rule

The emptiness re-check performed inside the import transaction SHALL also count all rows (including soft-deleted), so a device that gained rows — or whose only rows are deleted — between the eligibility preview and the import still aborts the import.

#### Scenario: Rows present at import time abort the import

- **WHEN** the eligibility preview reported empty but any row (live or soft-deleted) exists in a synced table when the import transaction runs
- **THEN** the import aborts and no rows are written.

### Requirement: Import semantics stay a one-shot `INSERT OR REPLACE`

The restore import SHALL remain a one-shot `INSERT OR REPLACE` keyed on `id`. Per-row merge semantics (comparing `updated_at` to keep a newer local tombstone) SHALL NOT be introduced by this change — that is reserved for a future restore v2 merge design.

#### Scenario: Import behaviour for eligible devices is unchanged

- **WHEN** restore runs on a genuinely empty device
- **THEN** rows are imported via `INSERT OR REPLACE` exactly as today, with no per-row timestamp comparison.
