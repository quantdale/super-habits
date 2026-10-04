## Context

See proposal.md for the motivation. Current `main` is `c1bc380`. Relevant state: `core/backup/backupRestore.ts` already has `isMissingV2RemoteTableError` (`:277`) and a second-opinion `probeV2TablesPresent` (`:300`), but both read the same error text from the same transport, and the legacy fall-through at `:410-428` therefore triggers on any error whose message is empty. The coverage state union is `v2_complete | v1_legacy | in_progress | invalid | unavailable` (`:171`), and the summary's `catch` at `:786-804` collapses every failure to `v1_legacy`. `missingEntities` is computed at `:879` and asserted in `tests/integration/backupRestore.test.ts:502` but has no UI consumer, while `describeBackupCoverage()` (`features/settings/SettingsBackupSection.tsx:43-67`) prints the "verified complete" claim. `backupCheckpoint.ts` re-checks a fully-empty durable outbox four times inside one transaction (`:183,:194,:232,:244,:246`), so a single un-pushable record blocks the checkpoint forever; `core/sync/sync.engine.ts:77-83` caps backoff at 30 minutes and never gives up. `core/sync/supabase.adapter.ts:217` upserts with `onConflict: 'id'`; under the owner policies a conflicting foreign row makes the statement affect zero rows with HTTP 2xx. `core/auth/accountCoordinator.ts:89-124` derives `ownerIds` from a query already filtered to `userId`, so the `remote_foreign_owner` branch at `:429-436` is unreachable. `scripts/validate-supabase-schema.mjs` already carries owner-scoped-uniqueness guards for `saved_meals` (`:286-311`) and `daily_plans`, and `tests/integration/backupCanonicalColumns.test.ts` already compares the local projection against `PRAGMA table_info` — this change extends both patterns rather than inventing new ones.

## Goals / Non-Goals

**Goals:**

- Make "we could not verify this" a first-class, user-visible outcome in the backup/restore state machine.
- Make a remote write that silently affected nothing a push failure, not a success.
- Make every ownership safety check reachable by construction, and make the guard surface cover every backup entity.
- Preserve every existing threshold, ceiling, checksum rule, and fail-closed path.

**Non-Goals:**

- Changing the Restore V2 checksum algorithm or its strictness, the one-way backup model, or soft-delete semantics.
- Adding bidirectional sync, a merge-on-restore mode, or any degraded-restore policy (gap 21 stays option A and stays an owner decision).
- Designing a dead-letter table with retention policy or an operator UI for inspecting poison records beyond the user-visible diagnosis.
- Touching production Supabase. This change is repository-side.

## Decisions

### 1. Independent evidence means a different capability, not a second identical probe

Replace the text-signature classification with a capability probe whose failure is distinguishable from a "tables absent" answer: a transport-level failure (DNS, timeout, HTTP 5xx, empty body, CORS) returns `indeterminate`; a well-formed response that reports the tables absent returns `legacy`. The existing `probeV2TablesPresent` is reframed as a capability probe that returns a three-valued result.

Alternative: make the second probe use a different endpoint. Rejected. Two endpoints can both fail through the same proxy with the same empty message; the discriminating property is whether the transport succeeded, not which URL was used. Alternative: classify empty messages as `legacy` but require two consecutive probes. Rejected. It still manufactures a legacy classification from no evidence.

### 2. An indeterminate state is added to the union, not encoded into an existing one

Add `unknown` to `BackupCoverageState` and to `BackupStateSummary.state`, and give it its own copy in `describeBackupCoverage()`. The existing `v1_legacy` copy stays exactly as written for the case it was written for.

Alternative: reuse `unavailable`. Rejected. That state already means "remote backup is not configured for this account", which is a different and already-correct claim.

### 3. Post-push read-back is scoped to the rows just written, and gated by a new adapter result

After `upsertEntityRows`, the adapter performs a single `select` for the written ids filtered to the current user, and compares the returned id set. A mismatch makes `push()` return a partial failure for that entity, which the existing `SyncPushPartialFailureError` handling already re-queues. The manifest path is untouched: it still requires a fully drained durable outbox.

Alternative: change the upsert target to `onConflict: 'user_id,id'`. Rejected — it needs a matching unique index that does not exist, and it would make a conflict an error rather than a silent skip without telling us which case occurred. Alternative: trust RLS to make the skip impossible. Rejected. RLS makes the skip invisible, not impossible, and the whole defect is that invisibility.

### 4. The uniqueness guard is generalized from the two existing per-table guards

Refactor the `saved_meals` / `daily_plans` uniqueness assertions into a table of `{ table, ownerColumns, remediation }` entries and add `habit_completions` with the constraint already declared at `supabase/migrations/20260815100000_add_backup_completeness_v2.sql:45`. The guard asserts the constraint is absent and an owner-scoped unique index exists.

Alternative: write a regex scan for any `UNIQUE` without a `user_id` column. Rejected. It false-positives on legitimate single-column unique indexes that are not backup entities and cannot distinguish an owner-scoped index from an unrelated one. The explicit table is honest about which tables are in scope, which is the property the guard exists to protect.

### 5. The remote-ownership check queries distinct owners instead of counting one

Replace the `ownerIds` derivation with a query that returns the distinct `user_id` values present across the remote backup tables, with no `.eq('user_id', …)` filter, bounded by a small limit. RLS still scopes what the caller can see; the point is that the query no longer presupposes its own answer. The implemented bound is explicit and deliberately small: `OWNER_PROBE_ENTITIES = ['todos', 'habits', 'calorie_entries']` sampled at up to `DISTINCT_OWNER_PROBE_LIMIT = 20` rows each — three of the twenty-one recoverable entities, with a missing pre-migration table skipped rather than treated as a foreign owner. It is bounded sampled defense-in-depth, strictly better than the vacuous check it replaced but not exhaustive; the local owner-binding branch of the same check remains the primary guard.

Alternative: delete the remote check and rely on RLS. Rejected. It is the only remote-side signal the protection flow has, and the local branch of the same check is genuinely reachable; removing the remote half would leave a real gap. Alternative: keep the count and compare against a locally recorded count. Rejected. Counts change freely and the comment already says so.

### 6. A terminal outbox classification is a bounded attempt counter plus one new state

Add a durable attempt counter per outbox record; when an entity's records exceed the bound with persistent, distinguishable failures (a missing remote table, a permanently-rejected record, a local row that no longer exists), mark them `blocked` with the failure reason, exclude them from the completeness gate, and add a `blocked` backup state whose copy names the entity and the reason. Transient failures keep the existing backoff and never reach the terminal state.

Alternative: a separate dead-letter table. Rejected for this change. It is a larger schema surface with retention and re-drive semantics; the attempt counter plus a state is the smallest change that removes the frozen-forever symptom, and a DLQ can follow if the diagnosis proves insufficient. Alternative: give up after a fixed time. Rejected. A clock-based bound would classify a slow-but-working sync as blocked.

### 7. Migration integrity is a loud failure, not a silent re-run

A non-numeric or missing `db_schema_version` on a populated database throws. The chain asserts it landed on the expected maximum. The `sort_order` backfill gains an `addedSortOrder`-style guard copied from the pattern migration 24 already uses.

Alternative: synthesize version 0 and re-run, as today. Rejected. The comment asserts that is "the safe recovery", but block 6's backfill recomputes user-authored ordering; safety has to be earned, not asserted. Alternative: only guard block 6 and leave the version handling. Rejected. The re-run path is the trigger; leaving it unguarded leaves the guard unexercised in the only case that matters.

## Risks / Trade-offs

- [The read-back doubles the requests per flush on the hot sync path] → One `select` per entity per flush, ids bounded by the batch size already in use; measured against the existing per-entity round trips rather than added blindly.
- [A blocked terminal state could fire on a genuinely slow backend] → The bound counts distinguishable, persistent failure classes, not elapsed time; transient and rate-limit failures keep retrying forever as today.
- [The capability probe cannot distinguish "tables absent" from "tables present but empty"] → Both are well-formed responses and both mean the V2 path cannot proceed for a different reason; the probe reports them distinctly so the caller chooses, and only a well-formed "absent" yields legacy.
- [Generalizing the uniqueness guard may fail on a table with a legitimate global index] → The table is explicit, so a false positive is a one-line correction with a stated reason, not a silent widening of scope.
- [Correcting the restore prompt and `pendingChangeCount` changes user-visible copy and numbers] → Both become more accurate; neither is gated on a threshold or a ceiling.
- [Removing the vacuous remote check could make protection stricter] → A foreign owner now actually pauses the backup. That is the documented intent of the branch, reached for the first time.

## Migration Plan

No data or schema migration; no migration file is added. Apply order: (1) the three-valued capability probe and the indeterminate classification; (2) the `unknown` coverage state, its copy, and the `missingEntities` disclosure; (3) per-entity restored-count reporting on V2 restore; (4) the outbox attempt counter, `blocked` state, and diagnosis; (5) the post-push read-back and the partial-failure path; (6) the generalized uniqueness guard including `habit_completions`; (7) the distinct-owner remote fingerprint; (8) the pristine-owner resolution fix; (9) migration integrity (version assertion, block-6 guard, corrupted-version failure); (10) the remote-projection guard; (11) restore-prompt copy and owner-scoped `pendingChangeCount`. Each step lands with its own regression test. Rollback is a revert of the single commit; no persisted format changes, so no forward-compatibility shim is required.

## Open Questions

None that change the specs or the task split. The exact attempt bound and the set of "distinguishable persistent failure" classes are implementation constants recorded in the ExecPlan at apply time, not spec decisions.
