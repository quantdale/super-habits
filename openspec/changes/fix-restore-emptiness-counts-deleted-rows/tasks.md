# Tasks — fix-restore-emptiness-counts-deleted-rows

## 1. Fix restore emptiness to count deleted rows

- [ ] 1.1 Drop the `WHERE deleted_at IS NULL` filter from `getLocalSyncBackedCounts()` in `core/sync/restore.coordinator.ts` (~line 111), so each synced entity table (`todos`, `habits`, `calorie_entries`, `workout_routines`) is counted on every row regardless of soft-delete state.
- [ ] 1.2 Confirm the in-transaction re-check inside `restoreFromRemoteBackup()` (~line 393) inherits the rule via its `getLocalSyncBackedCounts()` call, so a deleted-only device still aborts the import; grep the file to ensure no other count query with a `deleted_at IS NULL` filter remains.
- [ ] 1.3 Leave the import itself (`INSERT OR REPLACE`, `applyRemoteTodos`/`applyRemoteHabits`/`applyRemoteCalorieEntries`) and the rest of the eligibility flow (`getRestorePreview`, `buildEligibility`) unchanged; do not introduce per-row `updated_at` merge semantics — that is explicitly out of scope (push-only backup, not two-way sync).

## 2. Tests — release the CG-2 quarantine

- [ ] 2.1 In `tests/integration/restore.test.ts`, remove `it.fails()` from both CG-2 cases in the "CG-2: restore emptiness counts deleted rows" describe block (~lines 326 and 351), rename the block to drop "(quarantined, it.fails)", and update the task-2.8a header comment (~line 23) — keeping every assertion identical and unweakened.
- [ ] 2.2 In `e2e/journeys/new-phone.spec.ts` (J5), remove the hard `test.fixme(true, ...)` from the third branch (~line 509) and update the branch comment so it no longer claims the quarantine; the branch runs against the remote boundary in the journeys-sync lane (`npm run e2e:sync`, dist-sync/ on :8082).
- [ ] 2.3 In `docs/testing/known-gaps.md`, close the CG-2 entry (section "CG-2 — Restore emptiness must count deleted rows"): replace the quarantine status with a resolution note naming this change, following the closed-entry pattern used by entries 8/9.

## 3. Verification

- [ ] 3.1 `npm run typecheck` and `npm run lint` clean.
- [ ] 3.2 `npm test` passes, including the previously-quarantined `tests/integration/restore.test.ts` CG-2 cases now running green.
- [ ] 3.3 `npm run e2e` (standard suite) passes; the released J5 third branch passes in its lane via `npm run e2e:sync` (journeys-sync project, dist-sync/ build on :8082) — the branch still asserts no restore prompt, the local-data-present gate in Settings, and a disabled Restore button.
