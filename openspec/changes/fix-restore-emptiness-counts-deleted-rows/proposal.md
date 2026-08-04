## Why

`add-real-world-user-simulation-testing` defined the decided restore-emptiness contract, CG-2 (**D10** in its design): **a device that has ever held rows in a synced table is not an empty device.** Restore v1 is allowed only when the device is empty for synced tables, and the import uses `INSERT OR REPLACE` keyed on `id`.

Today `getLocalSyncBackedCounts()` in `core/sync/restore.coordinator.ts` counts only rows where `deleted_at IS NULL`. A device whose todos were all soft-deleted therefore counts as empty, and restore proceeds — and because the import is `INSERT OR REPLACE`, a todo the user deleted while offline (a delete that was never pushed) is silently resurrected by rows the backup still holds as live. The user's most recent intent loses to a stale backup, silently, on a device they just set up. That is a data-integrity defect.

The regression for this contract already exists, written to the decided contract and quarantined: task 2.8a in `tests/integration/restore.test.ts` (`it.fails()`) and the third branch of `e2e/journeys/J5 new-phone.spec.ts`, tracked as contract gap **CG-2** in `docs/testing/known-gaps.md`. This change releases that quarantine.

## What Changes

- **Drop the `deleted_at IS NULL` filter** from `getLocalSyncBackedCounts()` in `core/sync/restore.coordinator.ts`, so the count reflects every row in each synced entity table (`todos`, `habits`, `calorie_entries`, `workout_routines`) regardless of soft-delete state.
- **Apply the same rule to the in-transaction re-check** that re-verifies emptiness inside the import transaction (the check that aborts the import if local rows appeared between the eligibility preview and the import). It must also count all rows, so a deleted-only device is still refused.
- Keep the restore import itself (`INSERT OR REPLACE`) and the rest of the eligibility flow unchanged. The intent is minimal: deleted history now blocks restore, exactly as the decided contract requires.
- Per-row merge semantics (compare `updated_at` during import, keep the local tombstone when it is newer) are **deliberately out of scope**: that would turn a one-shot import into a merge, i.e. two-way sync, which this product has not taken on. If restore v2 becomes a merge, that is the moment to revisit.
- **Release CG-2's quarantine**: remove the `it.fails()` from the integration `restore.test.ts` case and the `test.fixme()` from `J5`'s third branch, and remove the CG-2 entry's quarantine status from `docs/testing/known-gaps.md`. The gap is closed by this change, not weakened.

## Capabilities

### New Capabilities

- `restore-emptiness-counts-deleted-rows`: a device that has ever held rows in a synced table is not empty, so restore is refused and a local delete is never resurrected by a stale backup import.

### Modified Capabilities

- None. The restore eligibility flow and its disclosures are unchanged apart from the emptiness rule; the local-only-data disclosure (completions, saved meals, pomodoro sessions, workout logs do not come back) already exists and is asserted by `J5`.

## Impact

- **Modified files**: `core/sync/restore.coordinator.ts` (the `getLocalSyncBackedCounts()` query and the in-transaction re-check), `tests/integration/restore.test.ts` (remove quarantine from the 2.8a case), `e2e/journeys/J5*` (remove quarantine from the third branch), `docs/testing/known-gaps.md` (clear CG-2's quarantine status).
- **Behaviour change**: a device whose only synced rows are soft-deleted can no longer be restored onto. This is the intended, correct behaviour — the user's history blocks a restore that would silently resurrect deleted data.
- **No schema/migration impact**: no SQLite or `app_meta` changes.
- **Testing**: the previously-quarantined integration case and `J5` third branch become passing regression tests.
- **Follow-up changes**: none anticipated; this closes CG-2.